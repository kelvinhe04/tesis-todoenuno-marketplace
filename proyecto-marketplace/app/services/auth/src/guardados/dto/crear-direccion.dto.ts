import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CrearDireccionDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @Matches(/^\d{7,8}$|^\d{4}-\d{3,4}$/, { message: 'El teléfono debe tener 7 u 8 dígitos' })
  telefono: string;

  @IsString()
  @MinLength(5)
  direccion: string;

  @IsOptional()
  @IsBoolean()
  predeterminada?: boolean;
}
