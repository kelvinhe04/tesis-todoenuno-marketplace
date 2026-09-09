import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { Usuario } from './usuarios/usuario.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Usuario],
      synchronize: true,
    }),
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
