import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ReglaDisponibilidadDto {
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @Matches(HORA, { message: 'horaInicio debe tener formato HH:mm (00:00 a 23:59)' })
  horaInicio: string;

  @Matches(HORA, { message: 'horaFin debe tener formato HH:mm (00:00 a 23:59)' })
  horaFin: string;
}

export class DisponibilidadDto {
  @IsInt()
  @Min(15)
  @Max(480)
  duracionMinutos: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  cupos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  margenMinutos?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Selecciona al menos un día de atención' })
  @ValidateNested({ each: true })
  @Type(() => ReglaDisponibilidadDto)
  reglas: ReglaDisponibilidadDto[];

  @IsOptional()
  @IsArray()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  diasNoDisponibles?: string[];
}
