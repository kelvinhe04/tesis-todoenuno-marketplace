import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

// Integración con PayU Latam en modo SANDBOX mediante WebCheckout (el comprador es redirigido a la página de PayU y
// escribe ahí su tarjeta: el número NUNCA pasa por este servidor). Se usan las credenciales de prueba públicas que PayU
// publica por país (Panamá: accountId 512326). Sin PAYU_API_KEY el método queda desactivado. Nunca producción:
// conforme al alcance del anteproyecto (1.3) PAYU_CHECKOUT_URL apunta al sandbox por defecto.
export interface FormularioPayu {
  actionUrl: string;
  campos: Record<string, string>;
}

const PREFIJO = 'TEU'; // referenceCode = TEU + id de la orden sin guiones + T + marca de tiempo (sin caracteres especiales)

@Injectable()
export class PayuService {
  private readonly checkoutUrl = process.env.PAYU_CHECKOUT_URL || 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/';

  get habilitado(): boolean {
    return !!(process.env.PAYU_API_KEY?.trim() && process.env.PAYU_MERCHANT_ID?.trim() && process.env.PAYU_ACCOUNT_ID?.trim());
  }

  // Tarjeta de prueba que corresponde a la cuenta sandbox configurada (cada país tiene la suya en la guía de PayU)
  get tarjetaPrueba(): { pais: string; marca: string; numero: string } {
    return process.env.PAYU_ACCOUNT_ID?.trim() === '512326'
      ? { pais: 'Panamá', marca: 'Visa', numero: '4723 0300 0000 0005' }
      : { pais: 'Colombia', marca: 'Visa', numero: '4097 4400 0000 0004' };
  }

  private md5(texto: string) {
    return createHash('md5').update(texto).digest('hex');
  }

  // Un referenceCode distinto por intento (PayU no deja repetirlo) que además permite saber a qué orden pertenece
  referenciaDe(ordenId: string): string {
    return `${PREFIJO}${ordenId.replace(/-/g, '')}T${Date.now().toString(36)}`;
  }

  ordenIdDe(referenceCode: string): string | null {
    const m = referenceCode?.match(new RegExp(`^${PREFIJO}([0-9a-f]{32})T[0-9a-z]+$`));
    if (!m) return null;
    const h = m[1];
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // Campos del formulario WebCheckout. Firma de la solicitud: md5(apiKey~merchantId~referenceCode~amount~currency)
  prepararFormulario(o: { ordenId: string; total: number; buyerEmail: string; descripcion: string; responseUrl: string }): FormularioPayu {
    const apiKey = process.env.PAYU_API_KEY!.trim();
    const merchantId = process.env.PAYU_MERCHANT_ID!.trim();
    const accountId = process.env.PAYU_ACCOUNT_ID!.trim();
    const referenceCode = this.referenciaDe(o.ordenId);
    const amount = o.total.toFixed(2);
    const currency = 'USD';
    const signature = this.md5([apiKey, merchantId, referenceCode, amount, currency].join('~'));
    return {
      actionUrl: this.checkoutUrl,
      campos: {
        merchantId,
        accountId,
        description: o.descripcion,
        referenceCode,
        amount,
        tax: '0',
        taxReturnBase: '0',
        currency,
        signature,
        test: '1',
        buyerEmail: o.buyerEmail,
        responseUrl: o.responseUrl,
        lng: 'es',
      },
    };
  }

  // "Round half to even" a 1 decimal, como exige PayU para la firma de la respuesta (150.25 -> 150.2, 150.35 -> 150.4)
  private redondear1(valor: string): string {
    const centavos = Math.round(parseFloat(valor) * 100);
    let decenas = Math.floor(centavos / 10);
    const resto = centavos % 10;
    if (resto > 5 || (resto === 5 && decenas % 2 === 1)) decenas += 1;
    return (decenas / 10).toFixed(1);
  }

  // Firma de la página de respuesta: md5(apiKey~merchantId~referenceCode~new_value~currency~transactionState)
  firmaRespuestaValida(p: Record<string, string>): boolean {
    if (!p.signature || !p.TX_VALUE || !p.referenceCode) return false;
    const apiKey = process.env.PAYU_API_KEY!.trim();
    const cadena = [apiKey, p.merchantId, p.referenceCode, this.redondear1(p.TX_VALUE), p.currency, p.transactionState].join('~');
    return this.md5(cadena).toLowerCase() === String(p.signature).toLowerCase();
  }
}
