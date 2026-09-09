import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

const EXCHANGE = 'eventos';

@Injectable()
export class RabbitmqService implements OnModuleInit {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
    this.connection = await this.connectWithRetry(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    this.logger.log(`Conectado a RabbitMQ, exchange "${EXCHANGE}" listo`);
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
