import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class CrearTarjetaDto {
  @IsIn(['Visa', 'Mastercard', 'American Express', 'Otra'])
  marca: 'Visa' | 'Mastercard' | 'American Express' | 'Otra';

  @IsString()
  @Matches(/^\d{4}$/, { message: 'ultimos4 debe tener exactamente 4 dígitos' })
  ultimos4: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, { message: 'El vencimiento debe tener el formato MM/AA' })
  vencimiento: string;

  @IsOptional()
  @IsBoolean()
  predeterminada?: boolean;
}
