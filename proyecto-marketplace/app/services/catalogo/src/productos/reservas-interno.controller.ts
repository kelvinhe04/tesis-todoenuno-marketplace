import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { ReservasService } from './reservas.service';

interface ItemStock {
  productoId: string;
  cantidad: number;
}

// Uso exclusivo de otros microservicios dentro de la red de Docker (no se expone en el API Gateway).
@Controller('catalogo/internal')
export class ReservasInternoController {
  constructor(
    private readonly reservas: ReservasService,
    private readonly productos: ProductosService,
  ) {}

  // Ordenes lo llama cuando el pago se rechaza: el horario vuelve a quedar libre.
  @Patch('liberar-reservas/:ordenId')
  liberar(@Param('ordenId') ordenId: string) {
    return this.reservas.liberarPorOrden(ordenId);
  }

  // Ordenes lo llama al crear/reabrir una orden: descuenta el stock (400 si no alcanza).
  @Post('descontar-stock')
  descontarStock(@Body() body: { items: ItemStock[] }) {
    return this.productos.descontarStock(body.items ?? []);
  }

  // Ordenes lo llama cuando el pago se rechaza: el stock vuelve al catálogo.
  @Post('devolver-stock')
  devolverStock(@Body() body: { items: ItemStock[] }) {
    return this.productos.devolverStock(body.items ?? []);
  }
}
