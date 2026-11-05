import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

// Integración con PayPal SANDBOX (entorno de pruebas de PayPal: no se mueve dinero real; el comprador entra con
// una cuenta de prueba creada en developer.paypal.com). Usa la API REST v2 de Orders: crear la orden, el
// comprador la aprueba en el sitio de PayPal y el servidor la captura. Si no hay PAYPAL_CLIENT_ID /
// PAYPAL_CLIENT_SECRET, el servicio de pagos sigue con el simulador local. Alcance del anteproyecto (1.3):
// nunca producción — PAYPAL_API_BASE apunta al sandbox por defecto.
export interface OrdenPaypalCreada {
  paypalOrderId: string;
  aprobacionUrl: string;
}

export interface CapturaPaypal {
  completada: boolean;
  referenciaOrden?: string; // reference_id de la unidad de compra (nuestro ordenId)
  monto?: number;
  moneda?: string;
  motivo?: string; // si no se completó
}

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly base = (process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com').replace(/\/$/, '');
  private tokenCache?: { valor: string; expira: number };

  get habilitado(): boolean {
    return !!(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
  }

  private async token(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expira > Date.now() + 30_000) return this.tokenCache.valor;
    const credenciales = Buffer.from(`${process.env.PAYPAL_CLIENT_ID!.trim()}:${process.env.PAYPAL_CLIENT_SECRET!.trim()}`).toString('base64');
    const resp = await fetch(`${this.base}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credenciales}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!resp.ok) {
      this.logger.error(`PayPal rechazó las credenciales (${resp.status}): ${await resp.text()}`);
      throw new BadGatewayException('No se pudo conectar con PayPal (credenciales inválidas)');
    }
    const d = (await resp.json()) as { access_token: string; expires_in: number };
    this.tokenCache = { valor: d.access_token, expira: Date.now() + d.expires_in * 1000 };
    return d.access_token;
  }

  async crearOrden(ordenId: string, total: number, returnUrl: string, cancelUrl: string): Promise<OrdenPaypalCreada> {
    const resp = await fetch(`${this.base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
        // Idempotencia: un doble clic (mismo minuto) no crea dos órdenes de PayPal; un reintento posterior sí crea una nueva
        'PayPal-Request-Id': `todoenuno-${ordenId}-${total.toFixed(2)}-${Math.floor(Date.now() / 60000)}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: ordenId,
            custom_id: ordenId,
            description: `TodoEnUno - orden ${ordenId.slice(0, 8)}`,
            amount: { currency_code: 'USD', value: total.toFixed(2) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'TodoEnUno',
              locale: 'es-PA',
              landing_page: 'LOGIN',
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
              return_url: returnUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      }),
    });
    if (!resp.ok) {
      this.logger.error(`PayPal no creó la orden (${resp.status}): ${await resp.text()}`);
      throw new BadGatewayException('PayPal no pudo crear el pago');
    }
    const d = (await resp.json()) as { id: string; links?: Array<{ rel: string; href: string }> };
    const enlace = d.links?.find((l) => l.rel === 'payer-action') ?? d.links?.find((l) => l.rel === 'approve');
    if (!enlace) throw new BadGatewayException('PayPal no devolvió el enlace de aprobación');
    return { paypalOrderId: d.id, aprobacionUrl: enlace.href };
  }

  // Captura el pago ya aprobado por el comprador. Es idempotente: si PayPal dice que ya estaba capturada,
  // se consulta la orden y se devuelve ese resultado.
  async capturar(paypalOrderId: string): Promise<CapturaPaypal> {
    const token = await this.token();
    const resp = await fetch(`${this.base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `captura-${paypalOrderId}` },
    });
    const cuerpo = (await resp.json().catch(() => ({}))) as any;
    if (resp.ok) return this.resumir(cuerpo);

    const detalle: string | undefined = cuerpo?.details?.[0]?.issue;
    if (detalle === 'ORDER_ALREADY_CAPTURED') {
      const consulta = await fetch(`${this.base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (consulta.ok) return this.resumir(await consulta.json());
    }
    this.logger.warn(`PayPal no capturó ${paypalOrderId} (${resp.status}): ${JSON.stringify(cuerpo).slice(0, 400)}`);
    const motivos: Record<string, string> = {
      INSTRUMENT_DECLINED: 'PayPal rechazó el medio de pago',
      PAYER_ACTION_REQUIRED: 'No terminaste de aprobar el pago en PayPal',
      ORDER_NOT_APPROVED: 'No terminaste de aprobar el pago en PayPal',
    };
    return { completada: false, motivo: (detalle && motivos[detalle]) || cuerpo?.details?.[0]?.description || cuerpo?.message || 'PayPal no completó el pago' };
  }

  private resumir(d: any): CapturaPaypal {
    const unidad = d?.purchase_units?.[0];
    const captura = unidad?.payments?.captures?.[0];
    const completada = d?.status === 'COMPLETED' && captura?.status === 'COMPLETED';
    return {
      completada,
      referenciaOrden: unidad?.reference_id,
      monto: captura?.amount?.value !== undefined ? Number(captura.amount.value) : undefined,
      moneda: captura?.amount?.currency_code,
      motivo: completada ? undefined : `PayPal dejó el pago en estado ${captura?.status ?? d?.status ?? 'desconocido'}`,
    };
  }
}
