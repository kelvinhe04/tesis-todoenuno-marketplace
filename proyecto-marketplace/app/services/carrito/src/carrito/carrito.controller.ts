import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CarritoService } from './carrito.service';
import { AgregarItemDto } from './dto/agregar-item.dto';
import { ActualizarCantidadDto } from './dto/actualizar-cantidad.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('carrito')
export class CarritoController {
  constructor(private readonly carrito: CarritoService) {}

  @Get()
  obtener(@Req() request: any) {
    return this.carrito.obtenerCarrito(request.usuario.sub, request.headers['authorization']);
  }

  @Post('items')
  agregar(@Body() dto: AgregarItemDto, @Req() request: any) {
    return this.carrito.agregarItem(request.usuario.sub, dto, request.headers['authorization']);
  }

  @Patch('items/:productoId')
  actualizar(@Param('productoId') productoId: string, @Body() dto: ActualizarCantidadDto, @Req() request: any) {
    return this.carrito.actualizarCantidad(request.usuario.sub, productoId, dto, request.headers['authorization']);
  }

  @Delete('items/:productoId')
  eliminarItem(@Param('productoId') productoId: string, @Req() request: any) {
    return this.carrito.eliminarItem(request.usuario.sub, productoId, request.headers['authorization']);
  }

  @Delete()
  vaciar(@Req() request: any) {
    return this.carrito.vaciar(request.usuario.sub, request.headers['authorization']);
  }
}
