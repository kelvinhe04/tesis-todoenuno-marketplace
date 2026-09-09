import { IsString, Matches } from 'class-validator';

export class CrearReservaDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio: string;
}
