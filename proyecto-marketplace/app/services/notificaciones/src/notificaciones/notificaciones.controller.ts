import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { RabbitmqService } from './rabbitmq.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificaciones: NotificacionesService,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listar(@Req() request: any) {
    return this.notificaciones.listar(request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/leida')
  marcarLeida(@Param('id') id: string, @Req() request: any) {
    return this.notificaciones.marcarLeida(id, request.usuario.sub);
  }

  // Endpoint de demostracion de la Fase 3, documentado en el Cap. IV.4: expone el
  // log en memoria de los ultimos eventos recibidos, incluyendo los de POST /ordenes/demo
  // que no generan una notificacion persistida (no traen un comprador real).
  @Get('demo/log')
  getLog() {
    return { eventos: this.rabbitmq.getLog() };
  }
}
