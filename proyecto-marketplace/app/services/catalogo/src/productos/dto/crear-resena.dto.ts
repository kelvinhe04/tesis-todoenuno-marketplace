import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CrearResenaDto {
  @IsUUID()
  ordenId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  calificacion: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
