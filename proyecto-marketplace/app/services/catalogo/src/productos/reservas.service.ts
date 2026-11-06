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
import { ahoraEnNegocio, aMinutos, yaPaso } from './tiempo';

const MINUTOS_HOLD = 15;

// 870 -> '14:30'. Sin dar la vuelta a las 24 h: un horario nunca cruza la medianoche.
function deMinutos(total: number): string {
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function sumarMinutos(hora: string, minutos: number): string {
  return deMinutos(aMinutos(hora) + minutos);
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') || Number.isNaN(new Date(`${fecha}T00:00:00`).getTime())) {
      throw new BadRequestException('La fecha es obligatoria y debe tener formato AAAA-MM-DD');
    }
    const producto = await this.productos.findById(productoId);
    if (!producto) {
      throw new NotFoundException('Publicación no encontrada');
    }
    if (producto.tipo !== 'servicio' || !producto.disponibilidad) {
      return [];
    }

    if (producto.disponibilidad.diasNoDisponibles?.includes(fecha)) {
      return [];
    }
    const dia = diaSemanaDe(fecha);
    const reglasDelDia = producto.disponibilidad.reglas.filter((r) => r.diaSemana === dia);
    if (!reglasDelDia.length) {
      return [];
    }
    const duracion = producto.disponibilidad.duracionMinutos;
    const ahora = ahoraEnNegocio();
    if (fecha < ahora.fecha) {
      return [];
    }

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
    const cupos = producto.disponibilidad.cupos ?? 1;
    const margen = producto.disponibilidad.margenMinutos ?? 0;
    const usados = new Map<string, number>();
    for (const r of ocupadas) usados.set(r.horaInicio, (usados.get(r.horaInicio) ?? 0) + 1);

    const slots: { horaInicio: string; horaFin: string; cuposLibres: number }[] = [];
    for (const regla of reglasDelDia) {
      // Aritmética numérica (minutos) y no sobre texto: así el bucle siempre termina
      const finMin = aMinutos(regla.horaFin);
      for (let ini = aMinutos(regla.horaInicio); ini + duracion <= finMin; ini += duracion + margen) {
        const horaInicio = deMinutos(ini);
        // Hoy solo se ofrecen los horarios que todavía no empezaron
        if ((usados.get(horaInicio) ?? 0) < cupos && !yaPaso(fecha, horaInicio, ahora)) {
          slots.push({ horaInicio, horaFin: deMinutos(ini + duracion), cuposLibres: cupos - (usados.get(horaInicio) ?? 0) });
        }
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
    if (producto.vendedorId === compradorId) {
      throw new BadRequestException('No puedes reservar tus propios servicios');
    }
    if (producto.pausada) {
      throw new BadRequestException('Este servicio está pausado y no acepta reservas por ahora');
    }

    if (yaPaso(dto.fecha, dto.horaInicio, ahoraEnNegocio())) {
      throw new BadRequestException('Ese horario ya pasó. Elige uno posterior.');
    }

    if (producto.disponibilidad.diasNoDisponibles?.includes(dto.fecha)) {
      throw new BadRequestException('El vendedor no atiende ese día');
    }
    const dia = diaSemanaDe(dto.fecha);
    // El horario debe caer exactamente en la rejilla de la regla (inicio + n x duración): si no,
    // se podrían solapar citas (p. ej. 09:00-10:00 y 09:30-10:30).
    const duracionCita = producto.disponibilidad.duracionMinutos;
    const inicioCita = aMinutos(dto.horaInicio);
    const reglaValida = producto.disponibilidad.reglas.find(
      (r) =>
        r.diaSemana === dia &&
        inicioCita >= aMinutos(r.horaInicio) &&
        inicioCita + duracionCita <= aMinutos(r.horaFin) &&
        (inicioCita - aMinutos(r.horaInicio)) % (duracionCita + (producto.disponibilidad.margenMinutos ?? 0)) === 0,
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

    // Se toma el primer cupo libre de ese horario; el índice único (producto, fecha, hora, cupo)
    // impide que dos compradores tomen el mismo cupo a la vez: si pierde la carrera, prueba el siguiente.
    const cupos = producto.disponibilidad.cupos ?? 1;
    for (let intento = 0; intento < cupos; intento++) {
      const tomados = await this.reservas
        .find({ productoId, fecha: dto.fecha, horaInicio: dto.horaInicio, estado: { $in: ['retenida', 'confirmada'] } })
        .distinct('cupo');
      let cupo = 1;
      while (tomados.includes(cupo) && cupo <= cupos) cupo++;
      if (cupo > cupos) break;
      try {
        return await this.reservas.create({
          productoId,
          vendedorId: producto.vendedorId,
          compradorId,
          fecha: dto.fecha,
          horaInicio: dto.horaInicio,
          horaFin: sumarMinutos(dto.horaInicio, producto.disponibilidad.duracionMinutos),
          cupo,
          estado: 'retenida',
          expiraEn: new Date(Date.now() + MINUTOS_HOLD * 60_000),
        });
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
      }
    }
    throw new BadRequestException('Ese horario ya no está disponible');
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
    if (reserva.estado === 'confirmada' && reserva.ordenId === dto.ordenId) {
      return reserva; // idempotente: ya estaba confirmada para esa misma orden
    }
    if (reserva.estado !== 'retenida') {
      throw new BadRequestException('Esa reserva ya no está vigente. Elige otro horario.');
    }
    // Los holds vencidos se borran "perezosamente" (al consultar la disponibilidad); si este aún no se
    // limpió, igual hay que rechazarlo: el tiempo de retención terminó.
    if (reserva.expiraEn && reserva.expiraEn.getTime() <= Date.now()) {
      reserva.estado = 'cancelada';
      await reserva.save();
      throw new BadRequestException('El tiempo de retención de tu horario terminó. Elige un horario de nuevo.');
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

  // Pago rechazado: las reservas confirmadas de esa orden se cancelan y el horario queda libre
  async liberarPorOrden(ordenId: string) {
    const r = await this.reservas.updateMany({ ordenId, estado: 'confirmada' }, { $set: { estado: 'cancelada' } });
    return { liberadas: r.modifiedCount };
  }

  // Cita cancelada por el comprador: la reserva deja de contar y el cupo queda disponible otra vez
  async liberarReserva(reservaId: string) {
    const reserva = await this.reservas.findById(reservaId);
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    if (reserva.estado === 'confirmada' || reserva.estado === 'retenida') {
      reserva.estado = 'cancelada';
      await reserva.save();
    }
    return { liberada: true };
  }

  private async buscar(productoId: string, reservaId: string) {
    const reserva = await this.reservas.findOne({ _id: reservaId, productoId });
    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada');
    }
    return reserva;
  }
}
