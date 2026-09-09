import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Producto, ProductoSchema } from './producto.schema';
import { Resena, ResenaSchema } from './resena.schema';
import { Reserva, ReservaSchema } from './reserva.schema';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { ResenasController } from './resenas.controller';
import { ResenasService } from './resenas.service';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VendedorGuard } from '../auth/vendedor.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Producto.name, schema: ProductoSchema },
      { name: Resena.name, schema: ResenaSchema },
      { name: Reserva.name, schema: ReservaSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion',
    }),
  ],
  controllers: [ProductosController, ResenasController, ReservasController],
  providers: [ProductosService, ResenasService, ReservasService, JwtAuthGuard, VendedorGuard],
})
export class ProductosModule {}
