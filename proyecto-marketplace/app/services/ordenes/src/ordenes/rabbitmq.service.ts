import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { OrdenesService } from './ordenes.service';

const EXCHANGE = 'eventos';
const QUEUE = 'ordenes.pagos';

@Injectable()
export class RabbitmqService implements OnModuleInit {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;

  constructor(
    @Inject(forwardRef(() => OrdenesService))
    private readonly ordenesService: OrdenesService,
  ) {}

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
    this.connection = await this.connectWithRetry(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    const q = await this.channel.assertQueue(QUEUE, { durable: true });
    await this.channel.bindQueue(q.queue, EXCHANGE, 'pago.confirmado');
    await this.channel.bindQueue(q.queue, EXCHANGE, 'pago.rechazado');

    this.channel.consume(q.queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        const nuevoEstado = msg.fields.routingKey === 'pago.confirmado' ? 'pagada' : 'rechazada';
        await this.ordenesService.actualizarEstadoPago(payload.ordenId, nuevoEstado);
        this.logger.log(`Orden ${payload.ordenId} actualizada a estadoPago="${nuevoEstado}" por evento "${msg.fields.routingKey}"`);
        this.channel.ack(msg);
      } catch (err) {
        this.logger.error(`Error procesando evento de pago: ${err}`);
        this.channel.nack(msg, false, false);
      }
    });

    this.logger.log(`Conectado a RabbitMQ, escuchando "${QUEUE}" (pago.confirmado / pago.rechazado)`);
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

  async publish(routingKey: string, payload: Record<string, unknown>) {
    const body = Buffer.from(JSON.stringify(payload));
    this.channel.publish(EXCHANGE, routingKey, body, { contentType: 'application/json' });
    this.logger.log(`Publicado evento "${routingKey}": ${JSON.stringify(payload)}`);
  }
}
