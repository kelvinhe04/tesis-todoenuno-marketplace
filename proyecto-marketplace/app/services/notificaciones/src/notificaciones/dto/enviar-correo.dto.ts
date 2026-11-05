import { IsEmail, IsString, MinLength } from 'class-validator';

export class EnviarCorreoDto {
  @IsEmail()
  destinatario: string;

  @IsString()
  @MinLength(1)
  asunto: string;

  @IsString()
  @MinLength(1)
  texto: string;
}
