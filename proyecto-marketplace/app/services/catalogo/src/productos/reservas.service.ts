import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reserva } from './reserva.schema';
import { Producto } from './producto.schema';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ConfirmarReservaDto } from './dto/confirmar-reserva.dto';

const MINUTOS_HOLD = 15;

function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function diaSemanaDe(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // Construido con componentes locales (no ISO directo) para que el día de la
  // semana no se corra por el offset UTC de `new Date('YYYY-MM-DD')`.
  return new Date(anio, mes - 1, dia).getDay();
}

@Injectable()
export class ReservasService {
  constructor(
    @InjectModel(Reserva.name) private readonly reservas: Model<Reserva>,
    @InjectModel(Producto.name) private readonly productos: Model<Producto>,
  ) {}

  async disponibilidad(productoId: string, fecha: string) {
    const producto = await this.productos.findById(productoId);
    if (!producto) {
      throw new NotFoundException('Publicación no encontrada');
    }
    if (producto.tipo !== 'servicio' || !producto.disponibilidad) {
      return [];
    }

    const dia = diaSemanaDe(fecha);
    const reglasDelDia = producto.disponibilidad.reglas.filter((r) => r.diaSemana === dia);
    if (!reglasDelDia.length) {
      return [];
    }
    const duracion = producto.disponibilidad.duracionMinutos;

    // Limpia holds vencidos de ese producto+fecha antes de calcular ocupación,
    // así un slot con reserva "retenida" pero expirada vuelve a contar como libre.
    await this.reservas.deleteMany({
      productoId,
      fecha,
      estado: 'retenida',
      expiraEn: { $lt: new Date() },
    });

    const ocupadas = await this.reservas
      .find({ productoId, fecha, estado: { $in: ['retenida', 'confirmada'] } })
      .exec();
    const horasOcupadas = new Set(ocupadas.map((r) => r.horaInicio));

    const slots: { horaInicio: string; horaFin: string }[] = [];
    for (const regla of reglasDelDia) {
      let cursor = regla.horaInicio;
      while (sumarMinutos(cursor, duracion) <= regla.horaFin) {
        const horaFin = sumarMinutos(cursor, duracion);
        if (!horasOcupadas.has(cursor)) {
          slots.push({ horaInicio: cursor, horaFin });
        }
        cursor = horaFin;
      }
    }
    return slots;
  }

  async crear(productoId: string, dto: CrearReservaDto, compradorId: string) {
    const producto = await this.productos.findById(productoId);
    if (!producto) {
      throw new NotFoundException('Publicación no encontrada');
    }
    if (producto.tipo !== 'servicio' || !producto.disponibilidad) {
      throw new BadRequestException('Esta publicación no acepta reservas');
    }

    const dia = diaSemanaDe(dto.fecha);
    const reglaValida = producto.disponibilidad.reglas.find(
      (r) =>
        r.diaSemana === dia &&
        dto.horaInicio >= r.horaInicio &&
        sumarMinutos(dto.horaInicio, producto.disponibilidad!.duracionMinutos) <= r.horaFin,
    );
    if (!reglaValida) {
      throw new BadRequestException('Ese horario no está dentro de la disponibilidad del vendedor');
    }

    await this.reservas.deleteMany({
      productoId,
      fecha: dto.fecha,
      estado: 'retenida',
      expiraEn: { $lt: new Date() },
    });

    try {
      const reserva = await this.reservas.create({
        productoId,
        vendedorId: producto.vendedorId,
        compradorId,
        fecha: dto.fecha,
        horaInicio: dto.horaInicio,
        horaFin: sumarMinutos(dto.horaInicio, producto.disponibilidad.duracionMinutos),
        estado: 'retenida',
        expiraEn: new Date(Date.now() + MINUTOS_HOLD * 60_000),
      });
      return reserva;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('Ese horario ya no está disponible');
      }
      throw err;
    }
  }

  async obtener(productoId: string, reservaId: string, usuarioId: string) {
    const reserva = await this.buscar(productoId, reservaId);
    if (reserva.compradorId !== usuarioId && reserva.vendedorId !== usuarioId) {
      throw new ForbiddenException('No tienes acceso a esta reserva');
    }
    return reserva;
  }

  async confirmar(productoId: string, reservaId: string, dto: ConfirmarReservaDto, usuarioId: string) {
    const reserva = await this.buscar(productoId, reservaId);
    if (reserva.compradorId !== usuarioId) {
      throw new ForbiddenException('No puedes confirmar la reserva de otro comprador');
    }
    reserva.estado = 'confirmada';
    reserva.ordenId = dto.ordenId;
    reserva.expiraEn = undefined;
    return reserva.save();
  }

  async cancelar(productoId: string, reservaId: string, usuarioId: string) {
    const reserva = await this.buscar(productoId, reservaId);
    if (reserva.compradorId !== usuarioId) {
      throw new ForbiddenException('No puedes cancelar la reserva de otro comprador');
    }
    // Una reserva ya confirmada (orden creada) no se cancela por esta vía — evita que
    // el carrito la cancele por accidente al vaciarse justo después de confirmar la orden.
    if (reserva.estado !== 'retenida') {
      return reserva;
    }
    reserva.estado = 'cancelada';
    return reserva.save();
  }

  private async buscar(productoId: string, reservaId: string) {
    const reserva = await this.reservas.findOne({ _id: reservaId, productoId });
    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }
    return reserva;
  }
}
