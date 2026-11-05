import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Notificacion, TipoNotificacion } from './notificacion.entity';

// Las notificaciones se borran solas pasados estos dias (leidas o no)
const DIAS_RETENCION = Number(process.env.NOTIF_DIAS_RETENCION) || 30;
const CADA_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NotificacionesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificacionesService.name);
  private temporizador?: NodeJS.Timeout;

  constructor(@InjectRepository(Notificacion) private readonly notificaciones: Repository<Notificacion>) {}

  onModuleInit() {
    void this.limpiarAntiguas();
    this.temporizador = setInterval(() => void this.limpiarAntiguas(), CADA_MS);
  }

  onModuleDestroy() {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  async limpiarAntiguas() {
    try {
      const limite = new Date(Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000);
      const r = await this.notificaciones.delete({ creadoEn: LessThan(limite) });
      if (r.affected) this.logger.log(`Notificaciones de mas de ${DIAS_RETENCION} dias eliminadas: ${r.affected}`);
    } catch (err) {
      this.logger.error(`No se pudo limpiar notificaciones antiguas: ${(err as Error).message}`);
    }
  }

  async crear(usuarioId: string, tipo: TipoNotificacion, mensaje: string, ordenId: string, productoId: string | null = null) {
    return this.notificaciones.save(this.notificaciones.create({ usuarioId, tipo, mensaje, ordenId, productoId }));
  }

  // Un solo aviso de reseña por publicación y orden, aunque el vendedor cambie la entrega varias veces
  async existeAvisoResena(usuarioId: string, ordenId: string, productoId: string) {
    return this.notificaciones.exist({ where: { usuarioId, tipo: 'resena_pendiente', ordenId, productoId } });
  }

  async listar(usuarioId: string) {
    return this.notificaciones.find({ where: { usuarioId }, order: { creadoEn: 'DESC' } });
  }

  async marcarLeida(id: string, usuarioId: string) {
    const notificacion = await this.notificaciones.findOne({ where: { id } });
    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada');
    }
    if (notificacion.usuarioId !== usuarioId) {
      throw new ForbiddenException('Esta notificación no te pertenece');
    }
    notificacion.leida = true;
    return this.notificaciones.save(notificacion);
  }

  async marcarTodasLeidas(usuarioId: string) {
    const r = await this.notificaciones.update({ usuarioId, leida: false }, { leida: true });
    return { actualizadas: r.affected ?? 0 };
  }

  async eliminar(id: string, usuarioId: string) {
    const notificacion = await this.notificaciones.findOne({ where: { id } });
    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada');
    }
    if (notificacion.usuarioId !== usuarioId) {
      throw new ForbiddenException('Esta notificación no te pertenece');
    }
    await this.notificaciones.delete({ id });
    return { eliminada: true };
  }

  async eliminarTodas(usuarioId: string) {
    const r = await this.notificaciones.delete({ usuarioId });
    return { eliminadas: r.affected ?? 0 };
  }
}
