import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class RegistroDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(['comprador', 'vendedor'])
  rol: 'comprador' | 'vendedor';
}
