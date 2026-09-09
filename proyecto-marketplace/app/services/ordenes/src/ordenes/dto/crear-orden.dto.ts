import { Type } from 'class-transformer';
import { IsString, MinLength, ValidateNested } from 'class-validator';

class DireccionDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @MinLength(4)
  telefono: string;

  @IsString()
  @MinLength(5)
  direccion: string;
}

export class CrearOrdenDto {
  @ValidateNested()
  @Type(() => DireccionDto)
  direccion: DireccionDto;
}
