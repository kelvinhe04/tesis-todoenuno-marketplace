import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegistroDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Se ignora: toda cuenta nueva es comprador (el modo vendedor se activa despues desde el perfil)
  @IsOptional()
  @IsIn(['comprador', 'vendedor'])
  rol?: 'comprador' | 'vendedor';
}
