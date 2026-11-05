import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { RabbitmqService } from './rabbitmq.service';
import { EmailService } from './email.service';
import { EnviarCorreoDto } from './dto/enviar-correo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificaciones: NotificacionesService,
    private readonly rabbitmq: RabbitmqService,
    private readonly email: EmailService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listar(@Req() request: any) {
    return this.notificaciones.listar(request.usuario.sub);
  }

  // Uso exclusivo de otros microservicios (p. ej. auth para el correo de verificación): NO está en el
  // API Gateway, solo es alcanzable dentro de la red de Docker.
  @Post('internal/correo')
  async enviarCorreo(@Body() dto: EnviarCorreoDto) {
    await this.email.enviar(dto.destinatario, dto.asunto, dto.texto);
    return { enviado: true };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('leidas')
  marcarTodasLeidas(@Req() request: any) {
    return this.notificaciones.marcarTodasLeidas(request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  eliminarTodas(@Req() request: any) {
    return this.notificaciones.eliminarTodas(request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  eliminar(@Param('id') id: string, @Req() request: any) {
    return this.notificaciones.eliminar(id, request.usuario.sub);
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
