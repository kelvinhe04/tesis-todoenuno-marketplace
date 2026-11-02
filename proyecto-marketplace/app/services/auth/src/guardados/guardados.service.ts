import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Direccion } from './direccion.entity';
import { TarjetaGuardada } from './tarjeta.entity';
import { CrearDireccionDto } from './dto/crear-direccion.dto';
import { ActualizarDireccionDto } from './dto/actualizar-direccion.dto';
import { CrearTarjetaDto } from './dto/crear-tarjeta.dto';

// Direcciones y tarjetas guardadas del usuario. De la tarjeta solo se conserva marca, últimos 4
// y vencimiento; el número completo y el CVV nunca llegan a este servicio.
@Injectable()
export class GuardadosService {
  constructor(
    @InjectRepository(Direccion) private readonly direcciones: Repository<Direccion>,
    @InjectRepository(TarjetaGuardada) private readonly tarjetas: Repository<TarjetaGuardada>,
  ) {}

  // ---------- direcciones ----------

  listarDirecciones(usuarioId: string) {
    return this.direcciones.find({ where: { usuarioId }, order: { predeterminada: 'DESC', creadoEn: 'DESC' } });
  }

  async crearDireccion(usuarioId: string, dto: CrearDireccionDto) {
    const hay = await this.direcciones.count({ where: { usuarioId } });
    const predeterminada = hay === 0 || !!dto.predeterminada;
    if (predeterminada) await this.direcciones.update({ usuarioId }, { predeterminada: false });
    return this.direcciones.save(
      this.direcciones.create({ usuarioId, nombre: dto.nombre, telefono: dto.telefono, direccion: dto.direccion, predeterminada }),
    );
  }

  async actualizarDireccion(usuarioId: string, id: string, dto: ActualizarDireccionDto) {
    const dir = await this.direcciones.findOne({ where: { id, usuarioId } });
    if (!dir) throw new NotFoundException('Dirección no encontrada');
    const { predeterminada, ...datos } = dto;
    Object.assign(dir, datos);
    if (predeterminada === true) {
      await this.direcciones.update({ usuarioId }, { predeterminada: false });
      dir.predeterminada = true;
    }
    return this.direcciones.save(dir);
  }

  async eliminarDireccion(usuarioId: string, id: string) {
    const dir = await this.direcciones.findOne({ where: { id, usuarioId } });
    if (!dir) throw new NotFoundException('Dirección no encontrada');
    await this.direcciones.remove(dir);
    if (dir.predeterminada) {
      // Si se borra la predeterminada, la más reciente que quede pasa a serlo
      const [masReciente] = await this.direcciones.find({ where: { usuarioId }, order: { creadoEn: 'DESC' }, take: 1 });
      if (masReciente) await this.direcciones.update({ id: masReciente.id }, { predeterminada: true });
    }
    return { eliminada: true };
  }

  // ---------- tarjetas ----------

  listarTarjetas(usuarioId: string) {
    return this.tarjetas.find({ where: { usuarioId }, order: { predeterminada: 'DESC', creadoEn: 'DESC' } });
  }

  async crearTarjeta(usuarioId: string, dto: CrearTarjetaDto) {
    // El formato MM/AA ya se valida en el DTO (mes 01-12); aquí se rechaza una tarjeta vencida
    const [mes, anio] = dto.vencimiento.split('/').map(Number);
    const hoy = new Date();
    if ((2000 + anio) * 12 + (mes - 1) < hoy.getFullYear() * 12 + hoy.getMonth()) {
      throw new BadRequestException('La tarjeta está vencida');
    }
    // La misma tarjeta (mismos últimos 4 y vencimiento) no se duplica
    const existente = await this.tarjetas.findOne({ where: { usuarioId, ultimos4: dto.ultimos4, vencimiento: dto.vencimiento } });
    if (existente) return existente;

    const hay = await this.tarjetas.count({ where: { usuarioId } });
    const predeterminada = hay === 0 || !!dto.predeterminada;
    if (predeterminada) await this.tarjetas.update({ usuarioId }, { predeterminada: false });
    return this.tarjetas.save(
      this.tarjetas.create({ usuarioId, marca: dto.marca, ultimos4: dto.ultimos4, vencimiento: dto.vencimiento, predeterminada }),
    );
  }

  async hacerTarjetaPredeterminada(usuarioId: string, id: string) {
    const tarjeta = await this.tarjetas.findOne({ where: { id, usuarioId } });
    if (!tarjeta) throw new NotFoundException('Tarjeta no encontrada');
    await this.tarjetas.update({ usuarioId }, { predeterminada: false });
    tarjeta.predeterminada = true;
    return this.tarjetas.save(tarjeta);
  }

  async eliminarTarjeta(usuarioId: string, id: string) {
    const tarjeta = await this.tarjetas.findOne({ where: { id, usuarioId } });
    if (!tarjeta) throw new NotFoundException('Tarjeta no encontrada');
    await this.tarjetas.remove(tarjeta);
    if (tarjeta.predeterminada) {
      const [masReciente] = await this.tarjetas.find({ where: { usuarioId }, order: { creadoEn: 'DESC' }, take: 1 });
      if (masReciente) await this.tarjetas.update({ id: masReciente.id }, { predeterminada: true });
    }
    return { eliminada: true };
  }
}
