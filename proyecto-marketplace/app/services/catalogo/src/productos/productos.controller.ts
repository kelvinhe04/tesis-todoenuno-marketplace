import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { FiltrosCatalogoDto } from './dto/filtros-catalogo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VendedorGuard } from '../auth/vendedor.guard';

@Controller('catalogo')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  listar(@Query() filtros: FiltrosCatalogoDto) {
    return this.productos.listar(filtros);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.productos.obtener(id);
  }

  @UseGuards(JwtAuthGuard, VendedorGuard)
  @Post()
  crear(@Body() dto: CrearProductoDto, @Req() request: any) {
    return this.productos.crear(dto, request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard, VendedorGuard)
  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarProductoDto, @Req() request: any) {
    return this.productos.actualizar(id, dto, request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard, VendedorGuard)
  @Delete(':id')
  eliminar(@Param('id') id: string, @Req() request: any) {
    return this.productos.eliminar(id, request.usuario.sub);
  }
}
