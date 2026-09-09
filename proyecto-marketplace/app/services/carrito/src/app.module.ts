import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CarritoModule } from './carrito/carrito.module';

@Module({
  imports: [CarritoModule],
  controllers: [HealthController],
})
export class AppModule {}
