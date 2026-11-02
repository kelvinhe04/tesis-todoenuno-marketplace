import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Direccion } from './direccion.entity';
import { TarjetaGuardada } from './tarjeta.entity';
import { GuardadosController } from './guardados.controller';
import { GuardadosService } from './guardados.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Direccion, TarjetaGuardada]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [GuardadosController],
  providers: [GuardadosService, JwtAuthGuard],
})
export class GuardadosModule {}
