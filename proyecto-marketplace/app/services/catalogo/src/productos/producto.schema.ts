import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoPublicacion = 'producto' | 'servicio';
export type ModalidadEntrega = 'domicilio_cliente' | 'local_vendedor';

@Schema({ _id: false })
export class ReglaDisponibilidad {
  @Prop({ required: true, min: 0, max: 6 })
  diaSemana: number;

  @Prop({ required: true })
  horaInicio: string;

  @Prop({ required: true })
  horaFin: string;
}
export const ReglaDisponibilidadSchema = SchemaFactory.createForClass(ReglaDisponibilidad);

@Schema({ _id: false })
export class Disponibilidad {
  @Prop({ required: true, min: 15 })
  duracionMinutos: number;

  @Prop({ type: [ReglaDisponibilidadSchema], required: true })
  reglas: ReglaDisponibilidad[];

  // Cuántas citas puede atender a la vez a la misma hora (personas trabajando en paralelo)
  @Prop({ default: 1, min: 1 })
  cupos: number;

  // Minutos de respiro entre una cita y la siguiente (traslado, preparación, limpieza)
  @Prop({ default: 0, min: 0 })
  margenMinutos: number;

  // Fechas concretas (AAAA-MM-DD) en las que el vendedor no atiende (feriados, vacaciones...)
  @Prop({ type: [String], default: [] })
  diasNoDisponibles: string[];
}
export const DisponibilidadSchema = SchemaFactory.createForClass(Disponibilidad);

@Schema({ _id: false })
export class Ubicacion {
  @Prop({ required: true, min: -90, max: 90 })
  lat: number;

  @Prop({ required: true, min: -180, max: 180 })
  lng: number;
}
export const UbicacionSchema = SchemaFactory.createForClass(Ubicacion);

@Schema({ timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' } })
export class Producto extends Document {
  @Prop({ required: true, enum: ['producto', 'servicio'] })
  tipo: TipoPublicacion;

  @Prop({ required: true })
  nombre: string;

  @Prop({ required: false })
  marca?: string;

  @Prop({ required: true })
  descripcion: string;

  @Prop({ required: true })
  categoria: string;

  @Prop({ required: true, min: 0 })
  precio: number;

  @Prop({ min: 0, default: 0 })
  stock: number;

  // Pausada: el vendedor la oculta del catálogo y no se puede comprar/reservar, pero la conserva
  @Prop({ default: false })
  pausada: boolean;

  @Prop({ enum: ['domicilio_cliente', 'local_vendedor'], required: false })
  modalidadEntrega?: ModalidadEntrega;

  @Prop({ required: false })
  direccionLocal?: string;

  @Prop({ type: UbicacionSchema, required: false })
  ubicacion?: Ubicacion;

  @Prop({ type: DisponibilidadSchema, required: false })
  disponibilidad?: Disponibilidad;

  @Prop({ required: false })
  imagenUrl?: string;

  @Prop({ type: [String], default: [] })
  imagenes: string[];

  @Prop({ required: true })
  vendedorId: string;

  @Prop({ default: 0, min: 0, max: 5 })
  calificacionPromedio: number;

  @Prop({ default: 0, min: 0 })
  numResenas: number;
}

export const ProductoSchema = SchemaFactory.createForClass(Producto);
ProductoSchema.index({ nombre: 'text', descripcion: 'text' });
