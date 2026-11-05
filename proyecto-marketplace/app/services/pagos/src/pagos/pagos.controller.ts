import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { PagosService } from './pagos.service';
import { ProcesarPagoDto } from './dto/procesar-pago.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CapturarPaypalDto {
  @IsString()
  @MinLength(5)
  paypalOrderId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('ordenes/:ordenId')
  procesar(@Param('ordenId') ordenId: string, @Body() dto: ProcesarPagoDto, @Req() request: any) {
    return this.pagosService.procesar(ordenId, dto, request.usuario.sub, request.headers['authorization']);
  }

  // Modo activo de PayPal ("sandbox" real o "simulado"), para que el checkout sepa si redirige a PayPal
  @Get('config')
  config() {
    return this.pagosService.config();
  }

  @Post('ordenes/:ordenId/paypal/crear')
  paypalCrear(@Param('ordenId') ordenId: string, @Req() request: any) {
    return this.pagosService.paypalCrear(ordenId, request.usuario.sub, request.headers['authorization']);
  }

  @Post('ordenes/:ordenId/paypal/capturar')
  paypalCapturar(@Param('ordenId') ordenId: string, @Body() dto: CapturarPaypalDto, @Req() request: any) {
    return this.pagosService.paypalCapturar(ordenId, dto.paypalOrderId, request.usuario.sub, request.headers['authorization']);
  }

  @Get('ordenes/:ordenId')
  listar(@Param('ordenId') ordenId: string, @Req() request: any) {
    return this.pagosService.listarPorOrden(ordenId, request.usuario.sub);
  }
}
