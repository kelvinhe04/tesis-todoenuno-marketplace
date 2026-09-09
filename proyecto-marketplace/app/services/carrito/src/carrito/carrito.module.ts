import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CarritoController } from './carrito.controller';
import { CarritoService } from './carrito.service';
import { RedisProvider } from './redis.provider';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
    }),
  ],
  controllers: [CarritoController],
  providers: [CarritoService, RedisProvider, JwtAuthGuard],
})
export class CarritoModule {}
