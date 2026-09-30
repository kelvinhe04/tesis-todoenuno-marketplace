import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  passwordNueva?: string;

  @ValidateIf((dto) => !!dto.passwordNueva)
  @IsString()
  passwordActual?: string;
}
