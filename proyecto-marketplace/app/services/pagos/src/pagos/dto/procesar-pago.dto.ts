import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { MetodoPago } from '../pago.entity';

export class ProcesarPagoDto {
  @IsIn(['tarjeta', 'paypal'])
  metodo: MetodoPago;

  @IsOptional()
  @IsString()
  @Matches(/^\d{13,19}$/, { message: 'numeroTarjeta debe tener entre 13 y 19 dígitos (sandbox)' })
  numeroTarjeta?: string;

  @IsOptional()
  @IsString()
  vencimiento?: string;

  @IsOptional()
  @IsString()
  cvv?: string;
}
