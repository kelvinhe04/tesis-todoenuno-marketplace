import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Notificacion } from './notificacion.entity';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { RabbitmqService } from './rabbitmq.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notificacion]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
    }),
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, RabbitmqService, EmailService, JwtAuthGuard],
})
export class NotificacionesModule {}
