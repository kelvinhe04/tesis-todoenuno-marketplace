import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { Notificacion } from './notificaciones/notificacion.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Notificacion],
      synchronize: true,
    }),
    NotificacionesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
