import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { NotificacionesService } from './notificaciones.service';
import { AdjuntoCorreo, EmailService } from './email.service';
import { DatosCorreo, ItemCorreo } from './plantilla-correo';
import { TipoNotificacion } from './notificacion.entity';

const EXCHANGE = 'eventos';
const QUEUE = 'notificaciones.eventos';
const ROUTING_KEYS = ['orden.creada', 'pago.confirmado', 'pago.rechazado', 'orden.entregada'];
const MAX_LOG = 20;
const AUTH_URL = process.env.AUTH_URL || 'http://auth:3000';
const ORDENES_URL = process.env.ORDENES_URL || 'http://ordenes:3000';
const CATALOGO_URL = process.env.CATALOGO_URL || 'http://catalogo:3000';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

interface ItemOrdenInterna {
  productoId: string;
  vendedorId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  tipo?: string;
  cita?: { fecha: string; horaInicio: string; horaFin: string };
}

interface OrdenInterna {
  id: string;
  total: number;
  items: ItemOrdenInterna[];
}

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

interface EventoEntrega {
  ordenId: string;
  compradorId: string;
  items?: Array<{ productoId: string; nombre: string; esCita?: boolean }>;
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

    if (routingKey === 'orden.entregada') {
      await this.avisarResena(payload as unknown as EventoEntrega);
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

    const url = `${FRONTEND_URL}/ordenes`;
    const correo: Record<string, { asunto: string; datos: Omit<DatosCorreo, 'ordenId' | 'items' | 'total'> }> = {
      // orden_creada NO manda correo: el checkout cobra al instante y el de "pago aprobado/rechazado" llega
      // en el mismo segundo (dos correos casi iguales, y a veces en orden invertido). Queda solo la notificación in-app.
      pago_confirmado: {
        asunto: 'TodoEnUno — pago aprobado',
        datos: { etiqueta: 'Pago aprobado', tono: 'ok', titulo: '¡Tu pago fue aprobado!', mensaje: `Recibimos tu pago de $${payload.monto ?? '--'}. Los vendedores ya fueron avisados y se pondrán en marcha.`, boton: { texto: 'Ver mi orden', url } },
      },
      pago_rechazado: {
        asunto: 'TodoEnUno — pago rechazado',
        datos: { etiqueta: 'Pago rechazado', tono: 'error', titulo: 'No pudimos procesar tu pago', mensaje: `Tu pago fue rechazado${payload.motivo ? `: ${payload.motivo}` : '.'} Puedes reintentarlo desde tus órdenes.`, boton: { texto: 'Reintentar pago', url: `${FRONTEND_URL}/checkout?orden=${payload.ordenId}` } },
      },
    };
    const c = correo[tipo];
    if (c) await this.correoDeOrden(payload.compradorId, c.asunto, c.datos, payload.ordenId, mensaje);

    if (routingKey === 'pago.confirmado') {
      await this.notificarVendedores(payload.ordenId);
    }
  }

  // Cuando el vendedor marca un ítem como entregado, el comprador recibe un aviso para reseñarlo
  private async avisarResena(evento: EventoEntrega) {
    for (const item of evento.items ?? []) {
      if (await this.notificacionesService.existeAvisoResena(evento.compradorId, evento.ordenId, item.productoId)) continue;
      // Una cita no se "entrega": se completa
      const hecho = item.esCita ? `Tu cita «${item.nombre}» fue completada` : `Tu pedido «${item.nombre}» fue entregado`;
      const mensaje = `${hecho}. ¿Qué tal te fue? Deja tu reseña.`;
      await this.notificacionesService.crear(evento.compradorId, 'resena_pendiente', mensaje, evento.ordenId, item.productoId);
      await this.correoDeOrden(
        evento.compradorId,
        'TodoEnUno — cuéntanos qué te pareció',
        {
          etiqueta: item.esCita ? 'Completada' : 'Entregado',
          tono: 'ok',
          titulo: '¿Qué tal te fue?',
          mensaje: `${hecho}. Tu opinión ayuda a otros compradores y al vendedor.`,
          boton: { texto: 'Dejar mi reseña', url: `${FRONTEND_URL}/productos/${item.productoId}#resenas` },
        },
        evento.ordenId,
        mensaje,
        (it) => it.productoId === item.productoId,
      );
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
        await this.correoDeOrden(
          vendedorId,
          'TodoEnUno — nueva orden pagada',
          {
            etiqueta: 'Nueva orden',
            tono: 'ok',
            titulo: '¡Tienes una nueva venta!',
            mensaje: 'Un comprador pagó por tus publicaciones. Prepara la entrega o atiende la cita y marca el estado en tu panel.',
            boton: { texto: 'Ir a mis órdenes de venta', url: `${FRONTEND_URL}/vendedor/ordenes` },
          },
          ordenId,
          mensaje,
          (it) => it.vendedorId === vendedorId,
        );
      }
    } catch (err) {
      this.logger.warn(`No se pudo notificar a los vendedores de la orden ${ordenId}: ${err}`);
    }
  }

  // Correo con diseño: lista los ítems de la orden con su foto (adjunto en línea) y, en servicios, la fecha
  // y hora de la cita. Si no se puede leer la orden, sale un correo sencillo con el mensaje.
  // "filtro" deja solo ciertos ítems (cada vendedor ve solo los suyos; la reseña, solo el entregado).
  private async correoDeOrden(
    usuarioId: string,
    asunto: string,
    datos: Omit<DatosCorreo, 'ordenId' | 'items' | 'total'>,
    ordenId: string,
    mensajeSimple: string,
    filtro?: (it: ItemOrdenInterna) => boolean,
  ) {
    try {
      const [{ email }, orden] = await Promise.all([this.obtenerEmailUsuario(usuarioId), this.obtenerOrdenInterna(ordenId)]);
      const propios = filtro ? orden.items.filter(filtro) : orden.items;
      const adjuntos: AdjuntoCorreo[] = [];
      const items: ItemCorreo[] = await Promise.all(
        propios.map(async (it, i) => {
          const adjunto = await this.fotoDe(it.productoId, `item${i}@todoenuno`);
          if (adjunto) adjuntos.push(adjunto);
          return { nombre: it.nombre, cantidad: it.cantidad, precio: it.precio, cita: it.cita, imagenCid: adjunto?.cid };
        }),
      );
      const total = filtro ? Number(propios.reduce((a, it) => a + it.precio * it.cantidad, 0).toFixed(2)) : orden.total;
      await this.email.enviar(email, asunto, mensajeSimple, { ...datos, ordenId, items, total }, adjuntos);
    } catch (err) {
      this.logger.warn(`No se pudo armar el correo con diseño (usuario ${usuarioId}); se envía el sencillo: ${err}`);
      await this.notificarPorCorreo(usuarioId, asunto, mensajeSimple);
    }
  }

  // Foto principal de la publicación como adjunto en línea (cid). Si no hay foto o falla, el correo sale sin ella.
  private async fotoDe(productoId: string, cid: string): Promise<AdjuntoCorreo | null> {
    try {
      const resp = await fetch(`${CATALOGO_URL}/catalogo/${productoId}`);
      if (!resp.ok) return null;
      const p = (await resp.json()) as { imagenes?: string[]; imagenUrl?: string };
      const img = p.imagenes?.[0] || p.imagenUrl;
      if (!img) return null;
      const m = img.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
      if (m) return { filename: `${cid.split('@')[0]}.${m[1].split('/')[1].replace('jpeg', 'jpg')}`, cid, content: Buffer.from(m[2], 'base64'), contentType: m[1], contentDisposition: 'inline' };
      if (/^https?:\/\//i.test(img)) return { filename: `${cid.split('@')[0]}.jpg`, cid, path: img, contentDisposition: 'inline' };
      return null;
    } catch {
      return null;
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

  private async obtenerOrdenInterna(ordenId: string): Promise<OrdenInterna> {
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
