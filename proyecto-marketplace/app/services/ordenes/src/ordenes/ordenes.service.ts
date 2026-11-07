import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoEntrega, EstadoPago, ItemOrden, Orden } from './orden.entity';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { ActualizarEstadoEntregaDto } from './dto/actualizar-estado-entrega.dto';
import { RabbitmqService } from './rabbitmq.service';

const CARRITO_URL = process.env.CARRITO_URL || 'http://carrito:3000';
const CATALOGO_URL = process.env.CATALOGO_URL || 'http://catalogo:3000';
const AUTH_URL = process.env.AUTH_URL || 'http://auth:3000';

// Una cita se puede cancelar hasta estas horas antes de su inicio
const HORAS_MIN_CANCELACION = 1;
// Panamá no tiene horario de verano: UTC-5 fijo (las fechas/horas de las citas están en hora de Panamá)
const OFFSET_PANAMA = '-05:00';
// Estados de pago en los que el vendedor ya ve la orden (hay una venta o una cita agendada, incluso si luego se canceló)
const ESTADOS_VISIBLES_VENDEDOR: EstadoPago[] = ['pagada', 'por_cobrar', 'reembolsada', 'cancelada'];

interface ItemCarrito {
  productoId: string;
  tipo?: 'producto' | 'servicio';
  modalidadEntrega?: 'domicilio_cliente' | 'local_vendedor';
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
  vendedorId: string;
  cita?: { reservaId: string; fecha: string; horaInicio: string; horaFin: string; estado: string; expiraEn?: string };
}

interface CarritoRespuesta {
  items: ItemCarrito[];
  subtotal: number;
  envio: number;
  total: number;
}

@Injectable()
export class OrdenesService {
  constructor(
    @InjectRepository(Orden) private readonly ordenes: Repository<Orden>,
    @Inject(forwardRef(() => RabbitmqService)) private readonly rabbitmq: RabbitmqService,
  ) {}

  // Comprar exige tener el correo verificado (EXIGIR_VERIFICACION_CORREO=false lo desactiva). Si auth no
  // responde no se bloquea la compra: la verificación no es un dato crítico.
  private async exigirCorreoVerificado(compradorId: string) {
    if (process.env.EXIGIR_VERIFICACION_CORREO === 'false') return;
    try {
      const resp = await fetch(`${AUTH_URL}/auth/internal/email/${compradorId}`);
      if (resp.ok && (await resp.json()).emailVerificado === false) {
        throw new ForbiddenException('Verifica tu correo electrónico para poder comprar. Te enviamos un enlace al registrarte.');
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
    }
  }

  async crear(dto: CrearOrdenDto, compradorId: string, authorizationHeader: string) {
    await this.exigirCorreoVerificado(compradorId);
    const carrito = await this.obtenerCarrito(authorizationHeader);
    const parcial = !!dto.productoIds;
    const elegidos = parcial ? carrito.items.filter((it) => dto.productoIds!.includes(it.productoId)) : carrito.items;
    if (!elegidos.length) {
      throw new BadRequestException(parcial ? 'No hay productos seleccionados en el carrito' : 'El carrito está vacío');
    }
    // Un servicio solo se puede pagar mientras su horario siga retenido (o ya confirmado)
    for (const it of elegidos) {
      if (it.tipo !== 'servicio') continue;
      const c = it.cita;
      const vigente =
        !!c && (c.estado === 'confirmada' || (c.estado === 'retenida' && (!c.expiraEn || new Date(c.expiraEn).getTime() > Date.now())));
      if (!vigente) {
        throw new BadRequestException(`El horario de "${it.nombre}" ya no está retenido. Vuelve al servicio y elige un horario de nuevo.`);
      }
    }
    const subtotal = Number(elegidos.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2));
    const total = Number((subtotal + carrito.envio).toFixed(2));

    const items: ItemOrden[] = elegidos.map((it) => ({
      productoId: it.productoId,
      vendedorId: it.vendedorId,
      nombre: it.nombre,
      precio: it.precio,
      cantidad: it.cantidad,
      subtotal: it.subtotal,
      tipo: it.tipo,
      modalidadEntrega: it.modalidadEntrega,
      estadoEntrega: 'pendiente',
      cita: it.cita ? { reservaId: it.cita.reservaId, fecha: it.cita.fecha, horaInicio: it.cita.horaInicio, horaFin: it.cita.horaFin } : undefined,
    }));

    if (items.some((it) => it.vendedorId === compradorId)) {
      throw new BadRequestException('No puedes comprar tus propias publicaciones');
    }

    // Descontar el stock ANTES de crear la orden (atómico en catalogo): si otro comprador se llevó
    // la última unidad, aquí responde 400 y no se crea nada.
    await this.descontarStock(items);

    let orden: Orden;
    try {
      orden = await this.ordenes.save(
        this.ordenes.create({
          compradorId,
          items,
          direccion: dto.direccion,
          subtotal,
          envio: carrito.envio,
          total,
          estadoPago: 'pendiente',
          estadoEntrega: 'pendiente',
        }),
      );
    } catch (err) {
      await this.devolverStock(items).catch(() => undefined);
      throw err;
    }

    // Confirmar las reservas de servicio ANTES de vaciar el carrito: vaciar cancela
    // holds "retenida" del comprador, y una reserva ya confirmada no se debe cancelar.
    try {
      await this.confirmarReservas(items, orden.id, authorizationHeader);
    } catch (err) {
      // Si no se pudo confirmar algún horario no se deja la orden a medias
      await this.liberarReservas(orden.id).catch(() => undefined);
      await this.devolverStock(items).catch(() => undefined);
      await this.ordenes.delete(orden.id).catch(() => undefined);
      throw err;
    }
    if (parcial) await this.quitarDelCarrito(items, authorizationHeader);
    else await this.vaciarCarrito(authorizationHeader);
    await this.rabbitmq.publish('orden.creada', {
      ordenId: orden.id,
      compradorId,
      total: orden.total,
      creadoEn: orden.creadoEn,
    });

    return orden;
  }

  private itemsConStock(items: ItemOrden[]) {
    return items.filter((it) => it.tipo === 'producto').map((it) => ({ productoId: it.productoId, cantidad: it.cantidad }));
  }

  private async descontarStock(items: ItemOrden[]) {
    const lista = this.itemsConStock(items);
    if (!lista.length) return;
    const resp = await fetch(`${CATALOGO_URL}/catalogo/internal/descontar-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: lista }),
    });
    if (!resp.ok) {
      const cuerpo = await resp.json().catch(() => ({}));
      throw new BadRequestException(cuerpo.message || 'No hay stock suficiente');
    }
  }

  private async devolverStock(items: ItemOrden[]) {
    const lista = this.itemsConStock(items);
    if (!lista.length) return;
    await fetch(`${CATALOGO_URL}/catalogo/internal/devolver-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: lista }),
    });
  }

  private async confirmarReservas(items: ItemOrden[], ordenId: string, authorizationHeader: string) {
    for (const item of items) {
      if (!item.cita) continue;
      const resp = await fetch(`${CATALOGO_URL}/catalogo/${item.productoId}/reservas/${item.cita.reservaId}/confirmar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authorizationHeader },
        body: JSON.stringify({ ordenId }),
      });
      if (!resp.ok) {
        const cuerpo = await resp.json().catch(() => ({}));
        throw new BadRequestException(cuerpo.message || `El horario de "${item.nombre}" ya no está disponible. Elige otro.`);
      }
    }
  }

  async listarComprador(compradorId: string) {
    return this.ordenes.find({ where: { compradorId }, order: { creadoEn: 'DESC' } });
  }

  // Un ítem es una cita si es un servicio (las órdenes antiguas pueden no traer `tipo`, pero sí la cita).
  private esCita(it: ItemOrden): boolean {
    return it.tipo === 'servicio' || !!it.cita;
  }

  // Estado de entrega de una orden a partir de sus ítems: entregada si todos lo están, pendiente si
  // ninguno ha salido, "no_asistio" si todas las citas quedaron sin asistir, y "en camino" en cualquier
  // punto intermedio. Una mezcla de entregadas y no asistidas ya no tiene nada pendiente: cuenta como entregada.
  private agregarEntrega(items: ItemOrden[], respaldo: EstadoEntrega): EstadoEntrega {
    if (!items.length) return respaldo;
    const activos = items.filter((it) => (it.estadoEntrega ?? respaldo) !== 'cancelada');
    if (!activos.length) return 'cancelada';
    const estados = activos.map((it) => it.estadoEntrega ?? respaldo);
    if (estados.every((e) => e === 'entregada')) return 'entregada';
    if (estados.every((e) => e === 'pendiente')) return 'pendiente';
    if (estados.every((e) => e === 'no_asistio')) return 'no_asistio';
    if (estados.every((e) => e === 'entregada' || e === 'no_asistio')) return 'entregada';
    return 'en_camino';
  }

  // Lo que ve un vendedor de una orden: solo SUS ítems, con subtotal/total propios y su propio estado de
  // entrega (no se le muestran los productos ni los precios de otros vendedores).
  private vistaVendedor(orden: Orden, vendedorId: string): Orden {
    const propios = orden.items.filter((it) => it.vendedorId === vendedorId);
    const subtotal = Number(propios.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2));
    return {
      ...orden,
      items: propios.map((it) => ({ ...it, estadoEntrega: it.estadoEntrega ?? orden.estadoEntrega })),
      subtotal,
      envio: 0,
      total: subtotal,
      estadoEntrega: this.agregarEntrega(propios, orden.estadoEntrega),
    };
  }

  // Solo órdenes PAGADAS (o con pago en el lugar): una orden pendiente o rechazada todavía no es una venta y el
  // vendedor no debe recibir la dirección y el teléfono de alguien que no ha pagado ni agendado.
  async listarVendedor(vendedorId: string) {
    const ordenes = await this.ordenes
      .createQueryBuilder('orden')
      .where("EXISTS (SELECT 1 FROM jsonb_array_elements(orden.items) elem WHERE elem->>'vendedorId' = :vendedorId)", {
        vendedorId,
      })
      .andWhere("orden.estadoPago IN ('pagada', 'por_cobrar', 'reembolsada', 'cancelada')")
      .orderBy('orden.creadoEn', 'DESC')
      .getMany();
    return ordenes.map((o) => this.vistaVendedor(o, vendedorId));
  }

  async obtener(id: string, usuarioId: string, rol: string) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) {
      throw new NotFoundException('Orden no encontrada');
    }
    const esComprador = orden.compradorId === usuarioId;
    const esVendedorDeAlgunItem = orden.items.some((it) => it.vendedorId === usuarioId);
    if (!esComprador && !esVendedorDeAlgunItem) {
      throw new ForbiddenException('No tienes acceso a esta orden');
    }
    if (esComprador) {
      return { ...orden, items: orden.items.map((it) => ({ ...it, estadoEntrega: it.estadoEntrega ?? orden.estadoEntrega })) };
    }
    if (!ESTADOS_VISIBLES_VENDEDOR.includes(orden.estadoPago)) {
      throw new ForbiddenException('No tienes acceso a esta orden');
    }
    return this.vistaVendedor(orden, usuarioId);
  }

  async actualizarEstadoEntrega(id: string, dto: ActualizarEstadoEntregaDto, vendedorId: string) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (!orden.items.some((it) => it.vendedorId === vendedorId)) {
      throw new ForbiddenException('Esta orden no tiene publicaciones tuyas');
    }
    if (orden.estadoPago !== 'pagada' && orden.estadoPago !== 'por_cobrar') {
      throw new BadRequestException('Solo se puede actualizar la entrega de una orden pagada o con pago en el lugar');
    }
    const propiosActivos = orden.items.filter((it) => it.vendedorId === vendedorId && (it.estadoEntrega ?? orden.estadoEntrega) !== 'cancelada');
    if (!propiosActivos.length) {
      throw new BadRequestException('El cliente canceló todas tus citas de esta orden');
    }
    // "No asistió" solo tiene sentido para citas de servicio, no para productos.
    if (dto.estadoEntrega === 'no_asistio' && !orden.items.filter((it) => it.vendedorId === vendedorId).every((it) => this.esCita(it))) {
      throw new BadRequestException('"No asistió" solo se puede usar en citas de servicios');
    }
    // Una cita no se puede dar por completada ni por "no asistió" antes de que llegue su día y hora
    if (dto.estadoEntrega === 'entregada' || dto.estadoEntrega === 'no_asistio') {
      const futura = propiosActivos.find((it) => it.cita && Date.parse(`${it.cita.fecha}T${it.cita.horaInicio}:00${OFFSET_PANAMA}`) > Date.now());
      if (futura?.cita) {
        const [a, m, d] = futura.cita.fecha.split('-');
        throw new BadRequestException(
          `La cita de "${futura.nombre}" es el ${d}/${m}/${a} a las ${futura.cita.horaInicio}. Podrás marcarla como completada o no asistió cuando llegue esa hora.`,
        );
      }
    }
    // Cada vendedor cambia solo la entrega de SUS ítems; la de la orden se recalcula con todos.
    const itemsActualizados = orden.items.map((it) =>
      it.vendedorId === vendedorId && (it.estadoEntrega ?? orden.estadoEntrega) !== 'cancelada'
        ? { ...it, estadoEntrega: dto.estadoEntrega }
        : { ...it, estadoEntrega: it.estadoEntrega ?? orden.estadoEntrega },
    );
    // Ítems de este vendedor que pasan a "entregada" ahora (no los que ya lo estaban)
    const recienEntregados =
      dto.estadoEntrega === 'entregada'
        ? orden.items.filter((it) => it.vendedorId === vendedorId && !['entregada', 'cancelada'].includes(it.estadoEntrega ?? orden.estadoEntrega))
        : [];
    orden.items = itemsActualizados;
    orden.estadoEntrega = this.agregarEntrega(itemsActualizados, orden.estadoEntrega);
    // Pago en el lugar: al completarse todas las citas se da por cobrado
    if (orden.estadoPago === 'por_cobrar' && orden.estadoEntrega === 'entregada') orden.estadoPago = 'pagada';
    const guardada = await this.ordenes.save(orden);
    if (recienEntregados.length) {
      // Notificaciones avisa al comprador que ya puede dejar su reseña
      await this.rabbitmq
        .publish('orden.entregada', {
          ordenId: orden.id,
          compradorId: orden.compradorId,
          items: recienEntregados.map((it) => ({ productoId: it.productoId, nombre: it.nombre, esCita: this.esCita(it) })),
        })
        .catch(() => undefined);
    }
    return this.vistaVendedor(guardada, vendedorId);
  }

  // Uso exclusivo de otros microservicios (p. ej. Notificaciones para saber a
  // qué vendedores avisar) — no se expone en el API Gateway.
  async obtenerInterno(id: string) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) {
      throw new NotFoundException('Orden no encontrada');
    }
    return orden;
  }

  // Reintentar el pago de una orden pendiente o rechazada: vuelve a retener los horarios de sus
  // citas (si siguen libres) y la deja "pendiente" para poder cobrarla otra vez.
  async reabrir(id: string, usuarioId: string, authorizationHeader: string) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (orden.compradorId !== usuarioId) throw new ForbiddenException('Esta orden no te pertenece');
    if (orden.estadoPago !== 'pendiente' && orden.estadoPago !== 'rechazada') {
      throw new BadRequestException('Esta orden ya no admite reintentar el pago');
    }

    // Al rechazarse el pago el stock se devolvió: hay que volver a descontarlo (400 si ya no alcanza)
    const reponerStock = orden.estadoPago === 'rechazada';
    if (reponerStock) await this.descontarStock(orden.items);

    const creadas: { productoId: string; reservaId: string }[] = [];
    try {
      for (const item of orden.items) {
        if (!item.cita) continue;
        const base = `${CATALOGO_URL}/catalogo/${item.productoId}/reservas`;
        const headers = { 'Content-Type': 'application/json', Authorization: authorizationHeader };
        const actual = await fetch(`${base}/${item.cita.reservaId}`, { headers });
        if (actual.ok && (await actual.json()).estado === 'confirmada') continue; // sigue apartada
        const nueva = await fetch(base, {
          method: 'POST',
          headers,
          body: JSON.stringify({ fecha: item.cita.fecha, horaInicio: item.cita.horaInicio }),
        });
        if (!nueva.ok) {
          throw new BadRequestException(`El horario de "${item.nombre}" ya no está disponible. Haz una nueva compra eligiendo otro horario.`);
        }
        const reserva = await nueva.json();
        creadas.push({ productoId: item.productoId, reservaId: reserva._id });
        await fetch(`${base}/${reserva._id}/confirmar`, { method: 'PATCH', headers, body: JSON.stringify({ ordenId: orden.id }) });
        item.cita.reservaId = reserva._id;
      }
    } catch (err) {
      for (const c of creadas) {
        await fetch(`${CATALOGO_URL}/catalogo/${c.productoId}/reservas/${c.reservaId}/cancelar`, {
          method: 'PATCH',
          headers: { Authorization: authorizationHeader },
        }).catch(() => undefined);
      }
      if (reponerStock) await this.devolverStock(orden.items).catch(() => undefined);
      throw err;
    }
    orden.estadoPago = 'pendiente';
    return this.ordenes.save(orden);
  }

  // Pago en el lugar (efectivo en el local o al llegar a domicilio): solo para órdenes de servicios. Los horarios ya
  // quedaron confirmados al crear la orden; queda "por cobrar" hasta que el vendedor complete la cita.
  async pagarEnElLugar(id: string, usuarioId: string) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (orden.compradorId !== usuarioId) throw new ForbiddenException('Esta orden no te pertenece');
    if (orden.estadoPago !== 'pendiente') throw new BadRequestException('Esta orden ya no está pendiente de pago');
    if (!orden.items.every((it) => this.esCita(it))) {
      throw new BadRequestException('El pago en el lugar solo está disponible para órdenes de servicios');
    }
    orden.estadoPago = 'por_cobrar';
    const guardada = await this.ordenes.save(orden);
    await this.rabbitmq
      .publish('orden.por_cobrar', { ordenId: orden.id, compradorId: orden.compradorId, total: orden.total })
      .catch(() => undefined);
    return guardada;
  }

  // El comprador cancela una de sus citas (hasta HORAS_MIN_CANCELACION antes): el horario vuelve a quedar libre
  // (el cupo se recupera) y, si ya había pagado, se registra un reembolso SIMULADO.
  async cancelarCita(id: string, productoId: string, usuarioId: string) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    if (orden.compradorId !== usuarioId) throw new ForbiddenException('Esta orden no te pertenece');
    if (orden.estadoPago !== 'pagada' && orden.estadoPago !== 'por_cobrar') {
      throw new BadRequestException('Solo se pueden cancelar citas de órdenes pagadas o con pago en el lugar');
    }
    const item = orden.items.find((it) => it.productoId === productoId && this.esCita(it) && it.cita);
    if (!item || !item.cita) throw new NotFoundException('No se encontró esa cita en la orden');
    if ((item.estadoEntrega ?? orden.estadoEntrega) !== 'pendiente') {
      throw new BadRequestException('Solo se puede cancelar una cita que sigue agendada');
    }
    const inicio = Date.parse(`${item.cita.fecha}T${item.cita.horaInicio}:00${OFFSET_PANAMA}`);
    if (Number.isNaN(inicio) || inicio - Date.now() < HORAS_MIN_CANCELACION * 3_600_000) {
      throw new BadRequestException(`Solo puedes cancelar una cita hasta ${HORAS_MIN_CANCELACION} ${HORAS_MIN_CANCELACION === 1 ? 'hora' : 'horas'} antes de que empiece`);
    }

    // Primero se libera el horario en catálogo: si falla, la orden queda intacta
    const resp = await fetch(`${CATALOGO_URL}/catalogo/internal/liberar-reserva/${item.cita.reservaId}`, { method: 'PATCH' });
    if (!resp.ok) throw new BadRequestException('No se pudo liberar el horario. Inténtalo de nuevo en un momento.');

    const habiaPagado = orden.estadoPago === 'pagada';
    const reembolso = habiaPagado ? item.subtotal : undefined;
    const items = orden.items.map((it) =>
      it === item
        ? { ...it, estadoEntrega: 'cancelada' as const, canceladaEn: new Date().toISOString(), reembolso }
        : { ...it, estadoEntrega: it.estadoEntrega ?? orden.estadoEntrega },
    );
    orden.items = items;
    orden.estadoEntrega = this.agregarEntrega(items, orden.estadoEntrega);
    if (orden.estadoEntrega === 'cancelada') orden.estadoPago = habiaPagado ? 'reembolsada' : 'cancelada';
    else if (orden.estadoPago === 'por_cobrar' && orden.estadoEntrega === 'entregada') orden.estadoPago = 'pagada';
    const guardada = await this.ordenes.save(orden);

    await this.rabbitmq
      .publish('orden.cita_cancelada', {
        ordenId: orden.id,
        compradorId: orden.compradorId,
        productoId: item.productoId,
        nombre: item.nombre,
        vendedorId: item.vendedorId,
        fecha: item.cita.fecha,
        horaInicio: item.cita.horaInicio,
        reembolso: reembolso ?? 0,
      })
      .catch(() => undefined);
    return guardada;
  }

  // Pago rechazado: devuelve al catálogo los horarios de las citas de esa orden
  async liberarReservas(ordenId: string) {
    await fetch(`${CATALOGO_URL}/catalogo/internal/liberar-reservas/${ordenId}`, { method: 'PATCH' });
  }

  // Devuelve true si el estado cambió (así un evento repetido no devuelve el stock dos veces)
  async actualizarEstadoPago(ordenId: string, estadoPago: EstadoPago): Promise<boolean> {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    if (!orden) return false; // evento de una orden que no existe (no debería pasar en flujo normal)
    const cambio = orden.estadoPago !== estadoPago;
    orden.estadoPago = estadoPago;
    await this.ordenes.save(orden);
    if (cambio && estadoPago === 'rechazada') await this.devolverStock(orden.items).catch(() => undefined);
    return cambio;
  }

  private async obtenerCarrito(authorizationHeader: string): Promise<CarritoRespuesta> {
    const resp = await fetch(`${CARRITO_URL}/carrito`, {
      headers: { Authorization: authorizationHeader },
    });
    if (!resp.ok) {
      throw new BadRequestException('No se pudo leer el carrito');
    }
    return resp.json();
  }

  // Compra parcial: solo salen del carrito los ítems comprados (los demás se quedan)
  private async quitarDelCarrito(items: ItemOrden[], authorizationHeader: string) {
    for (const it of items) {
      await fetch(`${CARRITO_URL}/carrito/items/${it.productoId}`, {
        method: 'DELETE',
        headers: { Authorization: authorizationHeader },
      });
    }
  }

  private async vaciarCarrito(authorizationHeader: string) {
    await fetch(`${CARRITO_URL}/carrito`, {
      method: 'DELETE',
      headers: { Authorization: authorizationHeader },
    });
  }
}
