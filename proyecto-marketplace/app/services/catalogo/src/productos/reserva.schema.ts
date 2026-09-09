import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EstadoReserva = 'retenida' | 'confirmada' | 'cancelada';

@Schema({ timestamps: { createdAt: 'creadoEn', updatedAt: false } })
export class Reserva extends Document {
  @Prop({ required: true, index: true })
  productoId: string;

  @Prop({ required: true })
  vendedorId: string;

  @Prop({ required: true })
  compradorId: string;

  @Prop({ required: true })
  fecha: string;

  @Prop({ required: true })
  horaInicio: string;

  @Prop({ required: true })
  horaFin: string;

  @Prop({ required: true, enum: ['retenida', 'confirmada', 'cancelada'], default: 'retenida' })
  estado: EstadoReserva;

  @Prop({ required: false })
  ordenId?: string;

  @Prop({ required: false })
  expiraEn?: Date;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);
// Evita doble reserva del mismo horario: solo se aplica a reservas activas (retenida/confirmada),
// una cancelada no bloquea el índice y el horario vuelve a quedar disponible.
ReservaSchema.index(
  { productoId: 1, fecha: 1, horaInicio: 1 },
  { unique: true, partialFilterExpression: { estado: { $in: ['retenida', 'confirmada'] } } },
);
