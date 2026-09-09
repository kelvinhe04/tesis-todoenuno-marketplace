import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ResenasService } from './resenas.service';
import { CrearResenaDto } from './dto/crear-resena.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('catalogo/:productoId/resenas')
export class ResenasController {
  constructor(private readonly resenas: ResenasService) {}

  @Get()
  listar(@Param('productoId') productoId: string) {
    return this.resenas.listar(productoId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  crear(@Param('productoId') productoId: string, @Body() dto: CrearResenaDto, @Req() request: any) {
    return this.resenas.crear(productoId, dto, request.usuario.sub, request.usuario.email, request.headers['authorization']);
  }
}
