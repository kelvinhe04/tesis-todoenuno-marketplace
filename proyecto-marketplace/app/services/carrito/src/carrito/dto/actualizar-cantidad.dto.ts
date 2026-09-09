import { IsInt, Min } from 'class-validator';

export class ActualizarCantidadDto {
  @IsInt()
  @Min(1)
  cantidad: number;
}
