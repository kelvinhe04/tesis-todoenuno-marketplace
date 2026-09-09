import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';
import { ProductosModule } from './productos/productos.module';

@Module({
  imports: [MongooseModule.forRoot(process.env.MONGO_URL), ProductosModule],
  controllers: [HealthController],
})
export class AppModule {}
