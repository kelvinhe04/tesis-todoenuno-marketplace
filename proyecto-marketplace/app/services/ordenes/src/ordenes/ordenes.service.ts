import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoPago, ItemOrden, Orden } from './orden.entity';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { ActualizarEstadoEntregaDto } from './dto/actualizar-estado-entrega.dto';
import { RabbitmqService } from './rabbitmq.service';

const CARRITO_URL = process.env.CARRITO_URL || 'http://carrito:3000';
const CATALOGO_URL = process.env.CATALOGO_URL || 'http://catalogo:3000';

interface ItemCarrito {
  productoId: string;
  tipo?: 'producto' | 'servicio';
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
  vendedorId: string;
  cita?: { reservaId: string; fecha: string; horaInicio: string; horaFin: string; estado: string };
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

  async crear(dto: CrearOrdenDto, compradorId: string, authorizationHeader: string) {
    const carrito = await this.obtenerCarrito(authorizationHeader);
    if (!carrito.items.length) {
      throw new BadRequestException('El carrito está vacío');
    }

    const items: ItemOrden[] = carrito.items.map((it) => ({
      productoId: it.productoId,
      vendedorId: it.vendedorId,
      nombre: it.nombre,
      precio: it.precio,
      cantidad: it.cantidad,
      subtotal: it.subtotal,
      tipo: it.tipo,
      cita: it.cita ? { reservaId: it.cita.reservaId, fecha: it.cita.fecha, horaInicio: it.cita.horaInicio, horaFin: it.cita.horaFin } : undefined,
    }));

    const orden = await this.ordenes.save(
      this.ordenes.create({
        compradorId,
        items,
        direccion: dto.direccion,
        subtotal: carrito.subtotal,
        envio: carrito.envio,
        total: carrito.total,
        estadoPago: 'pendiente',
        estadoEntrega: 'pendiente',
      }),
    );

    // Confirmar las reservas de servicio ANTES de vaciar el carrito: vaciar cancela
    // holds "retenida" del comprador, y una reserva ya confirmada no se debe cancelar.
    await this.confirmarReservas(items, orden.id, authorizationHeader);
    await this.vaciarCarrito(authorizationHeader);
    await this.rabbitmq.publish('orden.creada', {
      ordenId: orden.id,
      compradorId,
      total: orden.total,
      creadoEn: orden.creadoEn,
    });

    return orden;
  }

  private async confirmarReservas(items: ItemOrden[], ordenId: string, authorizationHeader: string) {
    for (const item of items) {
      if (!item.cita) continue;
      await fetch(`${CATALOGO_URL}/catalogo/${item.productoId}/reservas/${item.cita.reservaId}/confirmar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: authorizationHeader },
        body: JSON.stringify({ ordenId }),
      });
    }
  }

  async listarComprador(compradorId: string) {
    return this.ordenes.find({ where: { compradorId }, order: { creadoEn: 'DESC' } });
  }

  async listarVendedor(vendedorId: string) {
    return this.ordenes
      .createQueryBuilder('orden')
      .where("EXISTS (SELECT 1 FROM jsonb_array_elements(orden.items) elem WHERE elem->>'vendedorId' = :vendedorId)", {
        vendedorId,
      })
      .orderBy('orden.creadoEn', 'DESC')
      .getMany();
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
    return orden;
  }

  async actualizarEstadoEntrega(id: string, dto: ActualizarEstadoEntregaDto, vendedorId: string) {
    const orden = await this.ordenes.findOne({ where: { id } });
    if (!orden) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (!orden.items.some((it) => it.vendedorId === vendedorId)) {
      throw new ForbiddenException('Esta orden no tiene publicaciones tuyas');
    }
    orden.estadoEntrega = dto.estadoEntrega;
    return this.ordenes.save(orden);
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

  async actualizarEstadoPago(ordenId: string, estadoPago: EstadoPago) {
    const orden = await this.ordenes.findOne({ where: { id: ordenId } });
    if (!orden) return; // evento de una orden que no existe (no debería pasar en flujo normal)
    orden.estadoPago = estadoPago;
    await this.ordenes.save(orden);
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

  private async vaciarCarrito(authorizationHeader: string) {
    await fetch(`${CARRITO_URL}/carrito`, {
      method: 'DELETE',
      headers: { Authorization: authorizationHeader },
    });
  }
}
