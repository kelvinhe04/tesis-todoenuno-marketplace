import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resena } from './resena.schema';
import { Producto } from './producto.schema';
import { CrearResenaDto } from './dto/crear-resena.dto';

const ORDENES_URL = process.env.ORDENES_URL || 'http://ordenes:3000';
const AUTH_URL = process.env.AUTH_URL || 'http://auth:3000';

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

  // Lista PUBLICA: nunca incluye el correo del comprador, solo su nombre (se consulta a auth, que expone
  // unicamente id y nombre) para mostrar quien escribio la resena.
  async listar(productoId: string) {
    const docs = await this.resenas.find({ productoId }).sort({ creadoEn: -1 }).lean().exec();
    const ids = [...new Set(docs.filter((d) => !d.nombreVisible).map((d) => d.compradorId))];
    const nombres = new Map<string, string>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const resp = await fetch(`${AUTH_URL}/auth/usuarios/${id}`);
          if (resp.ok) nombres.set(id, (await resp.json()).nombre);
        } catch {
          // sin nombre: se muestra "Comprador"
        }
      }),
    );
    return docs.map(({ compradorEmail: _correo, ...resto }) => ({
      ...resto,
      compradorNombre: resto.nombreVisible ?? nombres.get(resto.compradorId) ?? 'Comprador',
      utiles: resto.utiles ?? [],
    }));
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

  // "Útil": alterna el voto de la persona (un voto por reseña); no se puede votar la propia reseña.
  async alternarUtil(productoId: string, resenaId: string, usuarioId: string) {
    const resena = await this.resenas.findOne({ _id: resenaId, productoId });
    if (!resena) {
      throw new NotFoundException('Reseña no encontrada');
    }
    if (resena.compradorId === usuarioId) {
      throw new BadRequestException('No puedes votar tu propia reseña');
    }
    const yaVoto = (resena.utiles ?? []).includes(usuarioId);
    const actualizada = await this.resenas.findByIdAndUpdate(
      resenaId,
      yaVoto ? { $pull: { utiles: usuarioId } } : { $addToSet: { utiles: usuarioId } },
      { new: true },
    );
    return { utiles: actualizada?.utiles ?? [] };
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
