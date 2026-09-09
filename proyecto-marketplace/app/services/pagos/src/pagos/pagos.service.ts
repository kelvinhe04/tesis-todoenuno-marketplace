import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pago } from './pago.entity';
import { ProcesarPagoDto } from './dto/procesar-pago.dto';
import { RabbitmqService } from './rabbitmq.service';

const ORDENES_URL = process.env.ORDENES_URL || 'http://ordenes:3000';

interface OrdenRemota {
  id: string;
  compradorId: string;
  total: number;
  estadoPago: 'pendiente' | 'pagada' | 'rechazada';
}

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  async procesar(ordenId: string, dto: ProcesarPagoDto, usuarioId: string, authorizationHeader: string) {
    const orden = await this.obtenerOrden(ordenId, authorizationHeader);
    if (orden.compradorId !== usuarioId) {
      throw new ForbiddenException('Esta orden no te pertenece');
    }
    if (orden.estadoPago !== 'pendiente') {
      throw new BadRequestException(`La orden ya fue procesada (estado actual: ${orden.estadoPago})`);
    }

    const { aprobado, motivo } = this.simularPasarela(dto);

    const pago = await this.pagos.save(
      this.pagos.create({
        ordenId,
        compradorId: usuarioId,
        monto: orden.total,
        metodo: dto.metodo,
        estado: aprobado ? 'aprobado' : 'rechazado',
        motivoRechazo: aprobado ? undefined : motivo,
        tarjetaUltimos4: dto.numeroTarjeta ? dto.numeroTarjeta.slice(-4) : undefined,
      }),
    );

    await this.rabbitmq.publish(aprobado ? 'pago.confirmado' : 'pago.rechazado', {
      ordenId,
      compradorId: orden.compradorId,
      pagoId: pago.id,
      monto: pago.monto,
      motivo: pago.motivoRechazo,
    });

    return pago;
  }

  async listarPorOrden(ordenId: string, usuarioId: string) {
    const pagos = await this.pagos.find({ where: { ordenId }, order: { creadoEn: 'DESC' } });
    if (pagos.length && pagos[0].compradorId !== usuarioId) {
      throw new ForbiddenException('No tienes acceso a los pagos de esta orden');
    }
    return pagos;
  }

  // Simulador de pasarela en modo sandbox: sigue la convencion de tarjetas de
  // prueba de Stripe (una tarjeta terminada en 0002 simula "rechazada por el
  // banco"; cualquier otra se aprueba). No hay integracion con una pasarela real
  // ni se procesan pagos en produccion, conforme al alcance del anteproyecto
  // (seccion 1.3).
  private simularPasarela(dto: ProcesarPagoDto): { aprobado: boolean; motivo?: string } {
    if (dto.metodo === 'tarjeta') {
      if (!dto.numeroTarjeta) {
        throw new BadRequestException('numeroTarjeta es requerido para el método tarjeta');
      }
      if (dto.numeroTarjeta.endsWith('0002')) {
        return { aprobado: false, motivo: 'Tarjeta rechazada por el banco emisor (sandbox)' };
      }
    }
    return { aprobado: true };
  }

  private async obtenerOrden(ordenId: string, authorizationHeader: string): Promise<OrdenRemota> {
    const resp = await fetch(`${ORDENES_URL}/ordenes/${ordenId}`, {
      headers: { Authorization: authorizationHeader },
    });
    if (resp.status === 404) {
      throw new NotFoundException('Orden no encontrada');
    }
    if (resp.status === 403) {
      throw new ForbiddenException('Esta orden no te pertenece');
    }
    if (!resp.ok) {
      throw new BadRequestException('No se pudo verificar la orden');
    }
    return resp.json();
  }
}
