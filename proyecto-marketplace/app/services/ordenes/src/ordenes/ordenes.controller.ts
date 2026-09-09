import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { OrdenesService } from './ordenes.service';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { ActualizarEstadoEntregaDto } from './dto/actualizar-estado-entrega.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RabbitmqService } from './rabbitmq.service';

@Controller('ordenes')
export class OrdenesController {
  constructor(
    private readonly ordenes: OrdenesService,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  crear(@Body() dto: CrearOrdenDto, @Req() request: any) {
    return this.ordenes.crear(dto, request.usuario.sub, request.headers['authorization']);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listarComprador(@Req() request: any) {
    return this.ordenes.listarComprador(request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('vendedor')
  listarVendedor(@Req() request: any) {
    return this.ordenes.listarVendedor(request.usuario.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  obtener(@Param('id') id: string, @Req() request: any) {
    return this.ordenes.obtener(id, request.usuario.sub, request.usuario.rol);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/estado-entrega')
  actualizarEstadoEntrega(
    @Param('id') id: string,
    @Body() dto: ActualizarEstadoEntregaDto,
    @Req() request: any,
  ) {
    return this.ordenes.actualizarEstadoEntrega(id, dto, request.usuario.sub);
  }

  // Endpoint de demostracion de la Fase 3 (infraestructura y comunicacion), documentado
  // en el Cap. IV.4 del informe: publica un evento orden.creada de ejemplo sin pasar por
  // el flujo real de creacion de ordenes. Se conserva para no invalidar esa evidencia.
  @Post('demo')
  async crearOrdenDemo() {
    const orden = {
      id: `demo-${Date.now()}`,
      total: 49.99,
      estado: 'pendiente',
      creadoEn: new Date().toISOString(),
    };
    await this.rabbitmq.publish('orden.creada', orden);
    return { mensaje: 'Evento orden.creada publicado', orden };
  }
}
