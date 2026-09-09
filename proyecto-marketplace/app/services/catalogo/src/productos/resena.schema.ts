import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: { createdAt: 'creadoEn', updatedAt: false } })
export class Resena extends Document {
  @Prop({ required: true, index: true })
  productoId: string;

  @Prop({ required: true })
  compradorId: string;

  @Prop({ required: true })
  compradorEmail: string;

  @Prop({ required: true })
  ordenId: string;

  @Prop({ required: true, min: 1, max: 5 })
  calificacion: number;

  @Prop({ required: false, maxlength: 500 })
  comentario?: string;
}

export const ResenaSchema = SchemaFactory.createForClass(Resena);
ResenaSchema.index({ productoId: 1, compradorId: 1, ordenId: 1 }, { unique: true });
