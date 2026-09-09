import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { ProcesarPagoDto } from './dto/procesar-pago.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('ordenes/:ordenId')
  procesar(@Param('ordenId') ordenId: string, @Body() dto: ProcesarPagoDto, @Req() request: any) {
    return this.pagosService.procesar(ordenId, dto, request.usuario.sub, request.headers['authorization']);
  }

  @Get('ordenes/:ordenId')
  listar(@Param('ordenId') ordenId: string, @Req() request: any) {
    return this.pagosService.listarPorOrden(ordenId, request.usuario.sub);
  }
}
