import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Producto } from './producto.schema';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { FiltrosCatalogoDto } from './dto/filtros-catalogo.dto';
import { RUTA_IMAGEN, aVista, esDataUri, etagDe, prepararFoto, restaurarOriginales } from './imagenes.util';

const CATEGORIAS_PRODUCTO = ['Electrónica', 'Hogar', 'Moda', 'Belleza'];
const CATEGORIAS_SERVICIO = ['Servicios profesionales', 'Belleza'];

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class ProductosService {
  constructor(@InjectModel(Producto.name) private readonly modelo: Model<Producto>) {}

  // Cada regla debe terminar después de empezar y dejar espacio para al menos una cita
  private validarDisponibilidad(d?: { duracionMinutos: number; reglas: { horaInicio: string; horaFin: string }[] }) {
    if (!d) return;
    for (const r of d.reglas) {
      const [hi, mi] = r.horaInicio.split(':').map(Number);
      const [hf, mf] = r.horaFin.split(':').map(Number);
      if (hf * 60 + mf - (hi * 60 + mi) < d.duracionMinutos) {
        throw new BadRequestException(
          `El horario ${r.horaInicio}-${r.horaFin} no alcanza para una cita de ${d.duracionMinutos} min: la hora fin debe ser posterior a la de inicio`,
        );
      }
    }
  }

  // Reglas de negocio de una publicación: categoría acorde al tipo y, si es servicio, que se pueda agendar
  private validarPublicacion(
    f: Pick<CrearProductoDto, 'tipo' | 'categoria' | 'modalidadEntrega' | 'direccionLocal' | 'ubicacion' | 'disponibilidad'>,
    revisar: { categoria: boolean; servicio: boolean },
  ) {
    if (revisar.categoria) {
      const validas = f.tipo === 'servicio' ? CATEGORIAS_SERVICIO : CATEGORIAS_PRODUCTO;
      if (!validas.includes(f.categoria)) {
        throw new BadRequestException(`Categoría no válida para ${f.tipo === 'servicio' ? 'un servicio' : 'un producto'}. Opciones: ${validas.join(', ')}`);
      }
    }
    if (f.tipo === 'servicio' && revisar.servicio) {
      if (!f.disponibilidad?.reglas?.length) {
        throw new BadRequestException('Un servicio necesita al menos un día y horario de atención para poder agendarlo');
      }
      if (!f.modalidadEntrega) {
        throw new BadRequestException('Indica si el servicio es a domicilio o en tu local');
      }
      if (f.modalidadEntrega === 'local_vendedor' && (!f.direccionLocal?.trim() || !f.ubicacion)) {
        throw new BadRequestException('Un servicio en tu local necesita la dirección y la ubicación en el mapa');
      }
      this.validarDisponibilidad(f.disponibilidad);
    }
  }

  async crear(dto: CrearProductoDto, vendedorId: string) {
    this.validarPublicacion(dto, { categoria: true, servicio: true });
    if (!(dto.imagenes?.length || dto.imagenUrl)) {
      throw new BadRequestException('Agrega al menos una foto de tu publicación');
    }
    const creada = await this.modelo.create({ ...dto, vendedorId });
    return aVista(creada, true);
  }

  async listar(filtros: FiltrosCatalogoDto) {
    const query: FilterQuery<Producto> = {};
    if (filtros.tipo) query.tipo = filtros.tipo;
    if (filtros.categoria) query.categoria = filtros.categoria;
    if (filtros.vendedorId) query.vendedorId = filtros.vendedorId;
    if (!(filtros.incluirPausadas && filtros.vendedorId)) query.pausada = { $ne: true };
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
        .sort(
          filtros.orden === 'mejor_calificados'
            ? { calificacionPromedio: -1, numResenas: -1, creadoEn: -1 }
            : { creadoEn: -1 },
        )
        .skip((pagina - 1) * limite)
        .limit(limite)
        .select('-imagenes -imagenUrl') // las fotos no se leen: el listado manda la URL de la principal
        .exec(),
      this.modelo.countDocuments(query),
    ]);

    const vistas = items.map((p) => {
      const o = p.toObject() as any;
      o.imagenes = [RUTA_IMAGEN(String(o._id), 0)];
      return o;
    });
    return { items: vistas, total, pagina, limite, totalPaginas: Math.max(1, Math.ceil(total / limite)) };
  }

  // Documento completo de Mongo (con las fotos originales): uso interno y servicios que piden `fotos=originales`
  async obtenerDoc(id: string) {
    const producto = await this.modelo.findById(id).exec();
    if (!producto) {
      throw new NotFoundException('Publicación no encontrada');
    }
    return producto;
  }

  async obtener(id: string, originales = false) {
    const producto = await this.obtenerDoc(id);
    return originales ? producto : aVista(producto, true);
  }

  // Una foto de la publicación (n = posición, o "u" para la imagenUrl antigua), opcionalmente en miniatura.
  async foto(id: string, n: string, ancho?: number) {
    const proyeccion: any = n === 'u' ? { imagenUrl: 1 } : { imagenes: { $slice: [Number(n), 1] }, imagenUrl: 1 };
    const p = await this.modelo.findById(id, proyeccion).lean<{ imagenes?: string[]; imagenUrl?: string }>();
    const img = n === 'u' ? p?.imagenUrl : p?.imagenes?.[0] ?? (Number(n) === 0 ? p?.imagenUrl : undefined);
    if (!img) throw new NotFoundException('Foto no encontrada');
    if (!esDataUri(img)) return { redirigir: img };
    const etag = etagDe(id, n, img, ancho);
    return { etag, cargar: () => prepararFoto(img, ancho, etag) };
  }

  async actualizar(id: string, dto: ActualizarProductoDto, usuarioId: string) {
    const producto = await this.obtenerDoc(id);
    this.verificarPropietario(producto, usuarioId);
    // Si el formulario devolvió las URLs de las fotos de antes, se restauran las originales
    if (dto.imagenes) dto.imagenes = restaurarOriginales(dto.imagenes, producto.imagenes, producto.imagenUrl);
    // Solo se revisa lo que el vendedor está tocando (no se bloquean ediciones simples como pausar
    // por datos antiguos que ya estaban incompletos)
    const toca = (...campos: string[]) => campos.some((c) => c in dto);
    this.validarPublicacion({ ...(producto.toObject() as any), ...dto }, {
      categoria: toca('categoria', 'tipo'),
      servicio: toca('tipo', 'modalidadEntrega', 'direccionLocal', 'ubicacion', 'disponibilidad'),
    });
    Object.assign(producto, dto);
    if (!(producto.imagenes?.length || producto.imagenUrl)) {
      throw new BadRequestException('La publicación debe tener al menos una foto');
    }
    const guardada = await producto.save();
    return aVista(guardada, true);
  }

  // Descuenta stock de forma atómica (un solo update condicionado a stock >= cantidad, así dos
  // compradores no pueden llevarse la misma última unidad). Todo o nada: si un ítem no alcanza,
  // se devuelve lo ya descontado y se responde 400.
  async descontarStock(items: { productoId: string; cantidad: number }[]) {
    const hechos: { productoId: string; cantidad: number }[] = [];
    for (const it of items) {
      const r = await this.modelo.updateOne(
        { _id: it.productoId, tipo: 'producto', pausada: { $ne: true }, stock: { $gte: it.cantidad } },
        { $inc: { stock: -it.cantidad } },
      );
      if (r.modifiedCount !== 1) {
        await this.devolverStock(hechos);
        const p = await this.modelo.findById(it.productoId, { nombre: 1, stock: 1, pausada: 1 }).lean();
        const nombre = p?.nombre ?? 'un producto';
        const quedan = p?.stock ?? 0;
        if (p?.pausada) {
          throw new BadRequestException(`"${nombre}" ya no está disponible. Quítalo de tu carrito para continuar.`);
        }
        throw new BadRequestException(
          quedan > 0
            ? `Solo quedan ${quedan} unidades de "${nombre}". Ajusta la cantidad en tu carrito.`
            : `"${nombre}" se agotó. Quítalo de tu carrito para continuar.`,
        );
      }
      hechos.push(it);
    }
    return { ok: true };
  }

  async devolverStock(items: { productoId: string; cantidad: number }[]) {
    for (const it of items) {
      await this.modelo.updateOne({ _id: it.productoId, tipo: 'producto' }, { $inc: { stock: it.cantidad } });
    }
    return { ok: true };
  }

  async eliminar(id: string, usuarioId: string) {
    const producto = await this.obtenerDoc(id);
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
