import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { OrdenesModule } from './ordenes/ordenes.module';
import { Orden } from './ordenes/orden.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Orden],
      synchronize: true,
    }),
    OrdenesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
