import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CrearReservaDto } from './dto/crear-reserva.dto';
import { ConfirmarReservaDto } from './dto/confirmar-reserva.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('catalogo/:productoId')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  @Get('disponibilidad')
  disponibilidad(@Param('productoId') productoId: string, @Query('fecha') fecha: string) {
    return this.reservas.disponibilidad(productoId, fecha);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reservas')
  crear(@Param('productoId') productoId: string, @Body() dto: CrearReservaDto, @Req() request: any) {
    return this.reservas.crear(productoId, dto, request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reservas/:reservaId')
  obtener(@Param('productoId') productoId: string, @Param('reservaId') reservaId: string, @Req() request: any) {
    return this.reservas.obtener(productoId, reservaId, request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reservas/:reservaId/confirmar')
  confirmar(
    @Param('productoId') productoId: string,
    @Param('reservaId') reservaId: string,
    @Body() dto: ConfirmarReservaDto,
    @Req() request: any,
  ) {
    return this.reservas.confirmar(productoId, reservaId, dto, request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reservas/:reservaId/cancelar')
  cancelar(@Param('productoId') productoId: string, @Param('reservaId') reservaId: string, @Req() request: any) {
    return this.reservas.cancelar(productoId, reservaId, request.usuario.sub);
  }
}
