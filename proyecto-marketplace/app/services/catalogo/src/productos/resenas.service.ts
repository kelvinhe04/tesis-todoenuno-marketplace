import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resena } from './resena.schema';
import { Producto } from './producto.schema';
import { CrearResenaDto } from './dto/crear-resena.dto';

const ORDENES_URL = process.env.ORDENES_URL || 'http://ordenes:3000';

interface OrdenRespuesta {
  compradorId: string;
  estadoPago: string;
  items: Array<{ productoId: string }>;
}

@Injectable()
export class ResenasService {
  constructor(
    @InjectModel(Resena.name) private readonly resenas: Model<Resena>,
    @InjectModel(Producto.name) private readonly productos: Model<Producto>,
  ) {}

  async listar(productoId: string) {
    return this.resenas.find({ productoId }).sort({ creadoEn: -1 }).exec();
  }

  async crear(productoId: string, dto: CrearResenaDto, compradorId: string, compradorEmail: string, authorizationHeader: string) {
    const producto = await this.productos.findById(productoId);
    if (!producto) {
      throw new NotFoundException('Publicación no encontrada');
    }

    const puedeResenar = await this.verificarCompra(productoId, compradorId, dto.ordenId, authorizationHeader);
    if (!puedeResenar) {
      throw new ForbiddenException('Solo puedes reseñar productos que hayas comprado y pagado');
    }

    try {
      await this.resenas.create({
        productoId,
        compradorId,
        compradorEmail,
        ordenId: dto.ordenId,
        calificacion: dto.calificacion,
        comentario: dto.comentario,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('Ya reseñaste este producto para esa orden');
      }
      throw err;
    }

    await this.recalcularPromedio(productoId);
    return this.listar(productoId);
  }

  private async verificarCompra(productoId: string, compradorId: string, ordenId: string, authorizationHeader: string) {
    const resp = await fetch(`${ORDENES_URL}/ordenes/${ordenId}`, {
      headers: { Authorization: authorizationHeader },
    });
    if (!resp.ok) return false;
    const orden: OrdenRespuesta = await resp.json();
    return (
      orden.compradorId === compradorId &&
      orden.estadoPago === 'pagada' &&
      orden.items.some((it) => it.productoId === productoId)
    );
  }

  private async recalcularPromedio(productoId: string) {
    const [stats] = await this.resenas.aggregate([
      { $match: { productoId } },
      { $group: { _id: null, promedio: { $avg: '$calificacion' }, total: { $sum: 1 } } },
    ]);
    const promedio = stats ? Math.round(stats.promedio * 10) / 10 : 0;
    const total = stats ? stats.total : 0;
    await this.productos.updateOne({ _id: productoId }, { $set: { calificacionPromedio: promedio, numResenas: total } });
  }
}
