import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { NotificacionesService } from './notificaciones.service';
import { EmailService } from './email.service';
import { TipoNotificacion } from './notificacion.entity';

const EXCHANGE = 'eventos';
const QUEUE = 'notificaciones.eventos';
const ROUTING_KEYS = ['orden.creada', 'pago.confirmado', 'pago.rechazado'];
const MAX_LOG = 20;
const AUTH_URL = process.env.AUTH_URL || 'http://auth:3000';
const ORDENES_URL = process.env.ORDENES_URL || 'http://ordenes:3000';

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
    private readonly email: EmailService,
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
    await this.notificarPorCorreo(payload.compradorId, 'TodoEnUno — actualización de tu orden', mensaje);

    if (routingKey === 'pago.confirmado') {
      await this.notificarVendedores(payload.ordenId);
    }
  }

  // RF-21: al confirmarse el pago, cada vendedor con al menos un item en la
  // orden recibe su propia notificacion (in-app y por correo).
  private async notificarVendedores(ordenId: string) {
    try {
      const orden = await this.obtenerOrdenInterna(ordenId);
      const vendedores = [...new Set(orden.items.map((it) => it.vendedorId))];
      for (const vendedorId of vendedores) {
        const mensaje = `Recibiste una nueva orden pagada (#${ordenId.slice(0, 8)}).`;
        await this.notificacionesService.crear(vendedorId, 'nueva_orden_vendedor', mensaje, ordenId);
        await this.notificarPorCorreo(vendedorId, 'TodoEnUno — nueva orden pagada', mensaje);
      }
    } catch (err) {
      this.logger.warn(`No se pudo notificar a los vendedores de la orden ${ordenId}: ${err}`);
    }
  }

  private async notificarPorCorreo(usuarioId: string, asunto: string, mensaje: string) {
    try {
      const { email } = await this.obtenerEmailUsuario(usuarioId);
      await this.email.enviar(email, asunto, mensaje);
    } catch (err) {
      this.logger.warn(`No se pudo enviar el correo al usuario ${usuarioId}: ${err}`);
    }
  }

  private async obtenerEmailUsuario(usuarioId: string): Promise<{ email: string }> {
    const resp = await fetch(`${AUTH_URL}/auth/internal/email/${usuarioId}`);
    if (!resp.ok) throw new Error(`auth respondió ${resp.status}`);
    return resp.json();
  }

  private async obtenerOrdenInterna(ordenId: string): Promise<{ items: Array<{ vendedorId: string }> }> {
    const resp = await fetch(`${ORDENES_URL}/ordenes/internal/${ordenId}`);
    if (!resp.ok) throw new Error(`ordenes respondió ${resp.status}`);
    return resp.json();
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
