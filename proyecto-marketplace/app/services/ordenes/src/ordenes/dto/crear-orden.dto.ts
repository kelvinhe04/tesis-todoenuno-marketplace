import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

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

  // Solo se compran estos ítems del carrito (si se omite, se compra todo el carrito)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productoIds?: string[];
}
