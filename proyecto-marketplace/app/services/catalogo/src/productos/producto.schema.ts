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
