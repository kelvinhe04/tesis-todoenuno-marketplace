import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion, TipoNotificacion } from './notificacion.entity';

@Injectable()
export class NotificacionesService {
  constructor(@InjectRepository(Notificacion) private readonly notificaciones: Repository<Notificacion>) {}

  async crear(usuarioId: string, tipo: TipoNotificacion, mensaje: string, ordenId: string) {
    return this.notificaciones.save(this.notificaciones.create({ usuarioId, tipo, mensaje, ordenId }));
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
}
