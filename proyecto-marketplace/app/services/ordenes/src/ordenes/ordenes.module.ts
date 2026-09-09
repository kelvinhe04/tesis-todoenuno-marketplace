import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Orden } from './orden.entity';
import { OrdenesController } from './ordenes.controller';
import { OrdenesService } from './ordenes.service';
import { RabbitmqService } from './rabbitmq.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Orden]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
    }),
  ],
  controllers: [OrdenesController],
  providers: [OrdenesService, RabbitmqService, JwtAuthGuard],
})
export class OrdenesModule {}
