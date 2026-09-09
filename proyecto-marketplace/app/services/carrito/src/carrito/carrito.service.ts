import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';
import { AgregarItemDto } from './dto/agregar-item.dto';
import { ActualizarCantidadDto } from './dto/actualizar-cantidad.dto';

const CATALOGO_URL = process.env.CATALOGO_URL || 'http://catalogo:3000';

interface ProductoCatalogo {
  _id: string;
  tipo: 'producto' | 'servicio';
  nombre: string;
  precio: number;
  stock: number;
  imagenUrl?: string;
  imagenes?: string[];
  vendedorId: string;
}

interface ReservaCatalogo {
  _id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: 'retenida' | 'confirmada' | 'cancelada';
}

@Injectable()
export class CarritoService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private clave(usuarioId: string) {
    return `carrito:${usuarioId}`;
  }

  private claveReservas(usuarioId: string) {
    return `carrito:${usuarioId}:reservas`;
  }

  private async obtenerProducto(productoId: string): Promise<ProductoCatalogo | null> {
    const resp = await fetch(`${CATALOGO_URL}/catalogo/${productoId}`);
    if (!resp.ok) return null;
    return resp.json();
  }

  private async obtenerReserva(
    productoId: string,
    reservaId: string,
    authorizationHeader: string,
  ): Promise<ReservaCatalogo | null> {
    const resp = await fetch(`${CATALOGO_URL}/catalogo/${productoId}/reservas/${reservaId}`, {
      headers: { Authorization: authorizationHeader },
    });
    if (!resp.ok) return null;
    return resp.json();
  }

  private async cancelarReserva(productoId: string, reservaId: string, authorizationHeader: string) {
    try {
      await fetch(`${CATALOGO_URL}/catalogo/${productoId}/reservas/${reservaId}/cancelar`, {
        method: 'PATCH',
        headers: { Authorization: authorizationHeader },
      });
    } catch {
      // Best-effort: si catalogo no responde, el hold vence solo por su expiraEn.
    }
  }

  async agregarItem(usuarioId: string, dto: AgregarItemDto, authorizationHeader: string) {
    const producto = await this.obtenerProducto(dto.productoId);
    if (!producto) {
      throw new BadRequestException('El producto o servicio no existe');
    }

    const clave = this.clave(usuarioId);

    if (producto.tipo === 'servicio') {
      if (!dto.reservaId) {
        throw new BadRequestException('Debes reservar un horario antes de agregar este servicio');
      }
      const claveReservas = this.claveReservas(usuarioId);
      const reservaAnterior = await this.redis.hget(claveReservas, dto.productoId);
      if (reservaAnterior && reservaAnterior !== dto.reservaId) {
        await this.cancelarReserva(dto.productoId, reservaAnterior, authorizationHeader);
      }
      await this.redis.hset(clave, dto.productoId, 1);
      await this.redis.hset(claveReservas, dto.productoId, dto.reservaId);
      return this.obtenerCarrito(usuarioId, authorizationHeader);
    }

    const cantidadActual = parseInt((await this.redis.hget(clave, dto.productoId)) || '0', 10);
    const nuevaCantidad = cantidadActual + dto.cantidad;

    if (nuevaCantidad > producto.stock) {
      throw new BadRequestException(`Solo hay ${producto.stock} unidades disponibles`);
    }

    await this.redis.hset(clave, dto.productoId, nuevaCantidad);
    return this.obtenerCarrito(usuarioId, authorizationHeader);
  }

  async actualizarCantidad(usuarioId: string, productoId: string, dto: ActualizarCantidadDto, authorizationHeader: string) {
    const clave = this.clave(usuarioId);
    const existe = await this.redis.hexists(clave, productoId);
    if (!existe) {
      throw new BadRequestException('Ese artículo no está en el carrito');
    }

    const producto = await this.obtenerProducto(productoId);
    if (producto?.tipo === 'servicio') {
      throw new BadRequestException('Un servicio agendado no tiene cantidad; reserva un nuevo horario si quieres cambiarlo');
    }
    if (producto?.tipo === 'producto' && dto.cantidad > producto.stock) {
      throw new BadRequestException(`Solo hay ${producto.stock} unidades disponibles`);
    }

    await this.redis.hset(clave, productoId, dto.cantidad);
    return this.obtenerCarrito(usuarioId, authorizationHeader);
  }

  async eliminarItem(usuarioId: string, productoId: string, authorizationHeader: string) {
    const claveReservas = this.claveReservas(usuarioId);
    const reservaId = await this.redis.hget(claveReservas, productoId);
    if (reservaId) {
      await this.cancelarReserva(productoId, reservaId, authorizationHeader);
      await this.redis.hdel(claveReservas, productoId);
    }
    await this.redis.hdel(this.clave(usuarioId), productoId);
    return this.obtenerCarrito(usuarioId, authorizationHeader);
  }

  async vaciar(usuarioId: string, authorizationHeader: string) {
    const claveReservas = this.claveReservas(usuarioId);
    const reservas = await this.redis.hgetall(claveReservas);
    for (const [productoId, reservaId] of Object.entries(reservas)) {
      await this.cancelarReserva(productoId, reservaId, authorizationHeader);
    }
    await this.redis.del(this.clave(usuarioId));
    await this.redis.del(claveReservas);
    return { items: [], subtotal: 0, envio: 0, total: 0 };
  }

  async obtenerCarrito(usuarioId: string, authorizationHeader: string) {
    const clave = this.clave(usuarioId);
    const claveReservas = this.claveReservas(usuarioId);
    const crudo = await this.redis.hgetall(clave);
    const reservasCrudo = await this.redis.hgetall(claveReservas);

    const items: Array<{
      productoId: string;
      tipo: 'producto' | 'servicio';
      nombre: string;
      precio: number;
      cantidad: number;
      subtotal: number;
      imagenUrl?: string;
      vendedorId: string;
      cita?: { reservaId: string; fecha: string; horaInicio: string; horaFin: string; estado: string };
    }> = [];

    for (const [productoId, cantidadStr] of Object.entries(crudo)) {
      const producto = await this.obtenerProducto(productoId);
      if (!producto) {
        // El producto ya no existe en el catálogo: se autolimpia del carrito.
        await this.redis.hdel(clave, productoId);
        await this.redis.hdel(claveReservas, productoId);
        continue;
      }
      const cantidad = parseInt(cantidadStr, 10);

      let cita: { reservaId: string; fecha: string; horaInicio: string; horaFin: string; estado: string } | undefined;
      const reservaId = reservasCrudo[productoId];
      if (reservaId) {
        const reserva = await this.obtenerReserva(productoId, reservaId, authorizationHeader);
        if (reserva) {
          cita = { reservaId, fecha: reserva.fecha, horaInicio: reserva.horaInicio, horaFin: reserva.horaFin, estado: reserva.estado };
        }
      }

      items.push({
        productoId,
        tipo: producto.tipo,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad,
        subtotal: Number((producto.precio * cantidad).toFixed(2)),
        imagenUrl: producto.imagenes?.[0] || producto.imagenUrl,
        vendedorId: producto.vendedorId,
        cita,
      });
    }

    const subtotal = Number(items.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2));
    // Sin gestión logística de envíos (fuera de alcance del anteproyecto, sección 1.3):
    // el envío no se calcula ni se cobra en este prototipo.
    const envio = 0;
    return { items, subtotal, envio, total: Number((subtotal + envio).toFixed(2)) };
  }
}
