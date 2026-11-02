import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { Usuario } from './usuarios/usuario.entity';
import { Direccion } from './guardados/direccion.entity';
import { TarjetaGuardada } from './guardados/tarjeta.entity';
import { GuardadosModule } from './guardados/guardados.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Usuario, Direccion, TarjetaGuardada],
      synchronize: true,
    }),
    AuthModule,
    GuardadosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
