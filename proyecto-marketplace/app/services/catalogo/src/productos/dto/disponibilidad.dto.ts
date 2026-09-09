import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';

export class ReglaDisponibilidadDto {
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @IsString()
  horaInicio: string;

  @IsString()
  horaFin: string;
}

export class DisponibilidadDto {
  @IsInt()
  @Min(15)
  duracionMinutos: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReglaDisponibilidadDto)
  reglas: ReglaDisponibilidadDto[];
}
