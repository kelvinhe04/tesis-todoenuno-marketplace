import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Pago } from './pago.entity';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { RabbitmqService } from './rabbitmq.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pago]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
    }),
  ],
  controllers: [PagosController],
  providers: [PagosService, RabbitmqService, JwtAuthGuard],
})
export class PagosModule {}
