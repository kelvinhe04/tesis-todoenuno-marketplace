import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuardadosService } from './guardados.service';
import { CrearDireccionDto } from './dto/crear-direccion.dto';
import { ActualizarDireccionDto } from './dto/actualizar-direccion.dto';
import { CrearTarjetaDto } from './dto/crear-tarjeta.dto';

@UseGuards(JwtAuthGuard)
@Controller('auth/me')
export class GuardadosController {
  constructor(private readonly guardados: GuardadosService) {}

  @Get('direcciones')
  listarDirecciones(@Req() req: any) {
    return this.guardados.listarDirecciones(req.usuario.sub);
  }

  @Post('direcciones')
  crearDireccion(@Req() req: any, @Body() dto: CrearDireccionDto) {
    return this.guardados.crearDireccion(req.usuario.sub, dto);
  }

  @Patch('direcciones/:id')
  actualizarDireccion(@Req() req: any, @Param('id') id: string, @Body() dto: ActualizarDireccionDto) {
    return this.guardados.actualizarDireccion(req.usuario.sub, id, dto);
  }

  @Delete('direcciones/:id')
  eliminarDireccion(@Req() req: any, @Param('id') id: string) {
    return this.guardados.eliminarDireccion(req.usuario.sub, id);
  }

  @Get('tarjetas')
  listarTarjetas(@Req() req: any) {
    return this.guardados.listarTarjetas(req.usuario.sub);
  }

  @Post('tarjetas')
  crearTarjeta(@Req() req: any, @Body() dto: CrearTarjetaDto) {
    return this.guardados.crearTarjeta(req.usuario.sub, dto);
  }

  @Patch('tarjetas/:id/predeterminada')
  hacerPredeterminada(@Req() req: any, @Param('id') id: string) {
    return this.guardados.hacerTarjetaPredeterminada(req.usuario.sub, id);
  }

  @Delete('tarjetas/:id')
  eliminarTarjeta(@Req() req: any, @Param('id') id: string) {
    return this.guardados.eliminarTarjeta(req.usuario.sub, id);
  }
}
