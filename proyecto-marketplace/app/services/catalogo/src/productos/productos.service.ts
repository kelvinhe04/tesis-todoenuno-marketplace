import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Producto } from './producto.schema';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { FiltrosCatalogoDto } from './dto/filtros-catalogo.dto';

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class ProductosService {
  constructor(@InjectModel(Producto.name) private readonly modelo: Model<Producto>) {}

  async crear(dto: CrearProductoDto, vendedorId: string) {
    return this.modelo.create({ ...dto, vendedorId });
  }

  async listar(filtros: FiltrosCatalogoDto) {
    const query: FilterQuery<Producto> = {};
    if (filtros.tipo) query.tipo = filtros.tipo;
    if (filtros.categoria) query.categoria = filtros.categoria;
    if (filtros.vendedorId) query.vendedorId = filtros.vendedorId;
    if (filtros.calificacionMin !== undefined) query.calificacionPromedio = { $gte: filtros.calificacionMin };
    if (filtros.precioMin !== undefined || filtros.precioMax !== undefined) {
      query.precio = {};
      if (filtros.precioMin !== undefined) query.precio.$gte = filtros.precioMin;
      if (filtros.precioMax !== undefined) query.precio.$lte = filtros.precioMax;
    }
    if (filtros.buscar) {
      const regex = new RegExp(escaparRegex(filtros.buscar), 'i');
      query.$or = [{ nombre: regex }, { descripcion: regex }, { marca: regex }];
    }

    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 12;
    const [items, total] = await Promise.all([
      this.modelo
        .find(query)
        .sort({ creadoEn: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .exec(),
      this.modelo.countDocuments(query),
    ]);

    return { items, total, pagina, limite, totalPaginas: Math.max(1, Math.ceil(total / limite)) };
  }

  async obtener(id: string) {
    const producto = await this.modelo.findById(id).exec();
    if (!producto) {
      throw new NotFoundException('Publicación no encontrada');
    }
    return producto;
  }

  async actualizar(id: string, dto: ActualizarProductoDto, usuarioId: string) {
    const producto = await this.obtener(id);
    this.verificarPropietario(producto, usuarioId);
    Object.assign(producto, dto);
    return producto.save();
  }

  async eliminar(id: string, usuarioId: string) {
    const producto = await this.obtener(id);
    this.verificarPropietario(producto, usuarioId);
    await producto.deleteOne();
    return { eliminado: true };
  }

  private verificarPropietario(producto: Producto, usuarioId: string) {
    if (producto.vendedorId !== usuarioId) {
      throw new ForbiddenException('No puedes modificar una publicación de otro vendedor');
    }
  }
}
