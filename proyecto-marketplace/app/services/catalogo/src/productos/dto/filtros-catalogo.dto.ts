import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TipoPublicacion } from '../producto.schema';

export class FiltrosCatalogoDto {
  @IsOptional()
  @IsIn(['producto', 'servicio'])
  tipo?: TipoPublicacion;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calificacionMin?: number;

  @IsOptional()
  @IsString()
  vendedorId?: string;

  @IsOptional()
  @IsString()
  buscar?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite: number = 12;
}
