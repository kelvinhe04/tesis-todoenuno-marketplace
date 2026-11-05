import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetodoPago, Pago } from './pago.entity';
import { ProcesarPagoDto } from './dto/procesar-pago.dto';
import { RabbitmqService } from './rabbitmq.service';
import { PaypalService } from './paypal.service';
import { PayuService } from './payu.service';

const ORDENES_URL = process.env.ORDENES_URL || 'http://ordenes:3000';
const AUTH_URL = process.env.AUTH_URL || 'http://auth:3000';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

interface OrdenRemota {
  id: string;
  compradorId: string;
  total: number;
  estadoPago: 'pendiente' | 'pagada' | 'rechazada';
}

interface ResultadoCobro {
  aprobado: boolean;
  motivo?: string;
  metodo: MetodoPago;
  tarjetaUltimos4?: string;
  referenciaExterna?: string;
}

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    private readonly rabbitmq: RabbitmqService,
    private readonly paypal: PaypalService,
    private readonly payu: PayuService,
  ) {}

  // Modo de cada pasarela: PayPal "sandbox" (real) o "simulado"; PayU "sandbox" o "no-configurado"
  config() {
    return {
      paypal: this.paypal.habilitado ? 'sandbox' : 'simulado',
      payu: this.payu.habilitado ? 'sandbox' : 'no-configurado',
      payuPrueba: this.payu.habilitado ? this.payu.tarjetaPrueba : undefined,
    };
  }

  // Simulador local (tarjeta y PayPal simulado)
  async procesar(ordenId: string, dto: ProcesarPagoDto, usuarioId: string, authorizationHeader: string) {
    const orden = await this.obtenerOrdenPendiente(ordenId, usuarioId, authorizationHeader);
    if (dto.metodo === 'paypal' && this.paypal.habilitado) {
      // Con PayPal Sandbox activo el pago solo se confirma por el flujo real (crear -> aprobar -> capturar)
      throw new BadRequestException('Para pagar con PayPal usa el flujo de aprobación de PayPal');
    }
    const { aprobado, motivo } = this.simularPasarela(dto);
    return this.registrarCobro(orden, usuarioId, {
      aprobado,
      motivo,
      metodo: dto.metodo,
      tarjetaUltimos4: dto.numeroTarjeta ? dto.numeroTarjeta.slice(-4) : dto.tarjetaUltimos4,
    });
  }

  // PayPal Sandbox, paso 1: crea la orden en PayPal con el total REAL de la orden (nunca uno enviado por el
  // cliente) y devuelve el enlace donde el comprador la aprueba. Sin credenciales responde "simulado".
  async paypalCrear(ordenId: string, usuarioId: string, authorizationHeader: string) {
    const orden = await this.obtenerOrdenPendiente(ordenId, usuarioId, authorizationHeader);
    if (!this.paypal.habilitado) return { modo: 'simulado' as const };
    const base = `${FRONTEND_URL}/checkout?orden=${ordenId}`;
    const creada = await this.paypal.crearOrden(ordenId, orden.total, `${base}&paypal=ok`, `${base}&paypal=cancelado`);
    return { modo: 'sandbox' as const, paypalOrderId: creada.paypalOrderId, aprobacionUrl: creada.aprobacionUrl };
  }

  // PayPal Sandbox, paso 2: el comprador volvió de PayPal; se captura el pago y se verifica que corresponda a
  // ESTA orden y por el monto exacto antes de darlo por aprobado.
  async paypalCapturar(ordenId: string, paypalOrderId: string, usuarioId: string, authorizationHeader: string) {
    if (!this.paypal.habilitado) throw new BadRequestException('PayPal Sandbox no está configurado');
    const orden = await this.obtenerOrden(ordenId, authorizationHeader);
    if (orden.compradorId !== usuarioId) throw new ForbiddenException('Esta orden no te pertenece');

    // Idempotente: si ese mismo pago de PayPal ya se registró (p. ej. se recargó la página), se devuelve
    const previo = await this.pagos.findOne({ where: { ordenId, referenciaExterna: paypalOrderId, estado: 'aprobado' } });
    if (previo) return previo;
    if (orden.estadoPago !== 'pendiente') {
      throw new BadRequestException(`La orden ya fue procesada (estado actual: ${orden.estadoPago})`);
    }

    const captura = await this.paypal.capturar(paypalOrderId);
    let aprobado = captura.completada;
    let motivo = captura.motivo;
    if (aprobado && (captura.referenciaOrden !== ordenId || captura.moneda !== 'USD' || Number(captura.monto?.toFixed(2)) !== Number(orden.total.toFixed(2)))) {
      // Un pago de PayPal que no corresponde a esta orden o a este monto jamás se acepta
      aprobado = false;
      motivo = 'El pago de PayPal no coincide con la orden';
    }
    return this.registrarCobro(orden, usuarioId, { aprobado, motivo, metodo: 'paypal', referenciaExterna: paypalOrderId });
  }

  // PayU Latam (WebCheckout, sandbox), paso 1: devuelve los campos firmados del formulario al que el navegador hace
  // POST para ir a la página de PayU (el número de tarjeta se escribe allá, nunca en nuestro servidor).
  async payuCrear(ordenId: string, usuarioId: string, authorizationHeader: string) {
    const orden = await this.obtenerOrdenPendiente(ordenId, usuarioId, authorizationHeader);
    if (!this.payu.habilitado) return { modo: 'no-configurado' as const };
    let buyerEmail = 'comprador@todoenuno.test';
    try {
      const resp = await fetch(`${AUTH_URL}/auth/internal/email/${usuarioId}`);
      if (resp.ok) buyerEmail = (await resp.json()).email ?? buyerEmail;
    } catch {
      // sin correo real PayU igual funciona en sandbox
    }
    const formulario = this.payu.prepararFormulario({
      ordenId,
      total: orden.total,
      buyerEmail,
      descripcion: `TodoEnUno orden ${ordenId.slice(0, 8)}`,
      responseUrl: `${FRONTEND_URL}/checkout/payu`,
    });
    return { modo: 'sandbox' as const, ...formulario };
  }

  // PayU, paso 2: el comprador volvió de PayU a nuestra página de respuesta con los parámetros firmados. Se valida la
  // firma, que corresponda a una orden SUYA, la moneda y el monto exacto, antes de dar el pago por aprobado.
  async payuConfirmar(params: Record<string, string>, usuarioId: string, authorizationHeader: string) {
    if (!this.payu.habilitado) throw new BadRequestException('PayU Sandbox no está configurado');
    const ordenId = this.payu.ordenIdDe(params.referenceCode);
    if (!ordenId) throw new BadRequestException('Referencia de pago inválida');
    if (!this.payu.firmaRespuestaValida(params)) throw new BadRequestException('La firma de PayU no es válida');

    const orden = await this.obtenerOrden(ordenId, authorizationHeader);
    if (orden.compradorId !== usuarioId) throw new ForbiddenException('Esta orden no te pertenece');

    const referencia = params.reference_pol || params.transactionId || params.referenceCode;
    const previo = await this.pagos.findOne({ where: { ordenId, referenciaExterna: referencia, estado: 'aprobado' } });
    if (previo) return previo; // recarga de la página de respuesta: idempotente
    if (orden.estadoPago !== 'pendiente') {
      throw new BadRequestException(`La orden ya fue procesada (estado actual: ${orden.estadoPago})`);
    }
    if (params.transactionState === '7') {
      throw new BadRequestException('PayU dejó el pago pendiente de confirmación. Revisa Mis órdenes en unos minutos.');
    }

    let aprobado = params.transactionState === '4';
    let motivo: string | undefined = aprobado ? undefined : `${params.message || 'PayU no aprobó el pago'}${params.lapResponseCode ? ` (${params.lapResponseCode})` : ''}`;
    if (aprobado && (params.currency !== 'USD' || Number(params.TX_VALUE) !== Number(orden.total.toFixed(2)))) {
      aprobado = false;
      motivo = 'El pago de PayU no coincide con la orden';
    }
    return this.registrarCobro(orden, usuarioId, { aprobado, motivo, metodo: 'payu', referenciaExterna: referencia });
  }

  // Registrar el pago y verificar "¿ya está pagada?" debe ser atómico: el estado de la orden se actualiza
  // por un evento (llega unos ms después), así que dos clics rápidos o dos peticiones simultáneas
  // podrían aprobar dos cobros. El candado por orden (advisory lock) serializa esas peticiones.
  private async registrarCobro(orden: OrdenRemota, usuarioId: string, r: ResultadoCobro) {
    const pago = await this.pagos.manager.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [orden.id]);
      const yaAprobados = await m.count(Pago, { where: { ordenId: orden.id, estado: 'aprobado' } });
      if (yaAprobados > 0) {
        throw new BadRequestException('Esta orden ya fue pagada');
      }
      return m.save(
        m.create(Pago, {
          ordenId: orden.id,
          compradorId: usuarioId,
          monto: orden.total,
          metodo: r.metodo,
          estado: r.aprobado ? 'aprobado' : 'rechazado',
          motivoRechazo: r.aprobado ? undefined : r.motivo,
          tarjetaUltimos4: r.tarjetaUltimos4,
          referenciaExterna: r.referenciaExterna,
        }),
      );
    });

    await this.rabbitmq.publish(r.aprobado ? 'pago.confirmado' : 'pago.rechazado', {
      ordenId: orden.id,
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
  // banco"; cualquier otra se aprueba). Para PayPal existe ademas la integracion con
  // PayPal Sandbox (paypalCrear / paypalCapturar). Nunca se procesan pagos en produccion,
  // conforme al alcance del anteproyecto (seccion 1.3).
  private simularPasarela(dto: ProcesarPagoDto): { aprobado: boolean; motivo?: string } {
    if (dto.metodo === 'tarjeta') {
      if (!dto.numeroTarjeta && !dto.tarjetaUltimos4) {
        throw new BadRequestException('numeroTarjeta o tarjetaUltimos4 es requerido para el método tarjeta');
      }
      const ultimos4 = dto.numeroTarjeta ? dto.numeroTarjeta.slice(-4) : dto.tarjetaUltimos4;
      if (ultimos4 === '0002') {
        return { aprobado: false, motivo: 'Tarjeta rechazada por el banco emisor (sandbox)' };
      }
    }
    return { aprobado: true };
  }

  private async obtenerOrdenPendiente(ordenId: string, usuarioId: string, authorizationHeader: string) {
    const orden = await this.obtenerOrden(ordenId, authorizationHeader);
    if (orden.compradorId !== usuarioId) {
      throw new ForbiddenException('Esta orden no te pertenece');
    }
    if (orden.estadoPago !== 'pendiente') {
      throw new BadRequestException(`La orden ya fue procesada (estado actual: ${orden.estadoPago})`);
    }
    return orden;
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
