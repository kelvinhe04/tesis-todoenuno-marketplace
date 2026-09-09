import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { PagosModule } from './pagos/pagos.module';
import { Pago } from './pagos/pago.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Pago],
      synchronize: true,
    }),
    PagosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
