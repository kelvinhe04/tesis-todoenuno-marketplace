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
  Res,
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

  // `fotos=originales` (uso entre servicios, no está expuesto en el gateway): devuelve las fotos completas en base64
  @Get(':id')
  obtener(@Param('id') id: string, @Query('fotos') fotos?: string) {
    return this.productos.obtener(id, fotos === 'originales');
  }

  // Una foto de la publicación; `w` = ancho en píxeles para pedir una miniatura (se cachea en el navegador)
  @Get(':id/imagen/:n')
  async imagen(@Param('id') id: string, @Param('n') n: string, @Query('w') w: string | undefined, @Req() req: any, @Res() res: any) {
    if (!/^(\d+|u)$/.test(n)) return res.status(404).json({ message: 'Foto no encontrada' });
    const ancho = w ? Math.min(1600, Math.max(48, parseInt(w, 10) || 0)) || undefined : undefined;
    const r = await this.productos.foto(id, n, ancho);
    if ('redirigir' in r) return res.redirect(302, r.redirigir);
    res.setHeader('ETag', r.etag);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (req.headers['if-none-match'] === r.etag) return res.status(304).end();
    const foto = await r.cargar();
    if (!foto) return res.status(404).json({ message: 'Foto no encontrada' });
    res.setHeader('Content-Type', foto.tipo);
    return res.send(foto.cuerpo);
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
