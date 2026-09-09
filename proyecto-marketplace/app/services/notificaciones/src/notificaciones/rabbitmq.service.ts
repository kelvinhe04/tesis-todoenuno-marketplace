import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { NotificacionesService } from './notificaciones.service';
import { TipoNotificacion } from './notificacion.entity';

const EXCHANGE = 'eventos';
const QUEUE = 'notificaciones.eventos';
const ROUTING_KEYS = ['orden.creada', 'pago.confirmado', 'pago.rechazado'];
const MAX_LOG = 20;

interface EventoOrdenCreada {
  ordenId?: string;
  compradorId?: string;
  total?: number;
}

interface EventoPago {
  ordenId?: string;
  compradorId?: string;
  monto?: number;
  motivo?: string;
}

@Injectable()
export class RabbitmqService implements OnModuleInit {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;
  private readonly eventLog: Array<{ routingKey: string; payload: unknown; recibidoEn: string }> = [];

  constructor(
    @Inject(forwardRef(() => NotificacionesService))
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
    this.connection = await this.connectWithRetry(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    const q = await this.channel.assertQueue(QUEUE, { durable: true });
    for (const routingKey of ROUTING_KEYS) {
      await this.channel.bindQueue(q.queue, EXCHANGE, routingKey);
    }

    this.channel.consume(q.queue, async (msg) => {
      if (!msg) return;
      const routingKey = msg.fields.routingKey;
      try {
        const payload = JSON.parse(msg.content.toString());

        this.eventLog.unshift({ routingKey, payload, recibidoEn: new Date().toISOString() });
        if (this.eventLog.length > MAX_LOG) this.eventLog.pop();

        await this.procesarEvento(routingKey, payload);

        this.logger.log(`Notificación generada por evento "${routingKey}": ${JSON.stringify(payload)}`);
        this.channel.ack(msg);
      } catch (err) {
        this.logger.error(`Error procesando evento "${routingKey}": ${err}`);
        this.channel.nack(msg, false, false);
      }
    });

    this.logger.log(`Escuchando cola "${QUEUE}" ligada a [${ROUTING_KEYS.join(', ')}] en el exchange "${EXCHANGE}"`);
  }

  private async connectWithRetry(url: string, maxAttempts = 10, delayMs = 3000): Promise<amqp.ChannelModel> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await amqp.connect(url);
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        this.logger.warn(`No se pudo conectar a RabbitMQ (intento ${attempt}/${maxAttempts}), reintentando en ${delayMs}ms: ${err}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('unreachable');
  }

  private async procesarEvento(routingKey: string, payload: EventoOrdenCreada & EventoPago) {
    if (!payload.compradorId || !payload.ordenId) {
      // Eventos de demostracion (POST /ordenes/demo) no traen compradorId real:
      // quedan solo en el log en memoria, sin notificacion persistida.
      return;
    }

    let tipo: TipoNotificacion;
    let mensaje: string;
    if (routingKey === 'orden.creada') {
      tipo = 'orden_creada';
      mensaje = `Tu orden #${payload.ordenId.slice(0, 8)} fue creada por un total de $${payload.total ?? '--'}.`;
    } else if (routingKey === 'pago.confirmado') {
      tipo = 'pago_confirmado';
      mensaje = `Tu pago de $${payload.monto ?? '--'} para la orden #${payload.ordenId.slice(0, 8)} fue aprobado.`;
    } else {
      tipo = 'pago_rechazado';
      mensaje = `Tu pago para la orden #${payload.ordenId.slice(0, 8)} fue rechazado${payload.motivo ? `: ${payload.motivo}` : '.'}`;
    }

    await this.notificacionesService.crear(payload.compradorId, tipo, mensaje, payload.ordenId);
  }

  async publish(routingKey: string, payload: Record<string, unknown>) {
    const body = Buffer.from(JSON.stringify(payload));
    this.channel.publish(EXCHANGE, routingKey, body, { contentType: 'application/json' });
    this.logger.log(`Publicado evento "${routingKey}": ${JSON.stringify(payload)}`);
  }

  getLog() {
    return this.eventLog;
  }
}
