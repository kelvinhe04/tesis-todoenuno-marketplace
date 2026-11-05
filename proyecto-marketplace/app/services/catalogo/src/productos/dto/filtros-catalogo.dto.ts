import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
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

  // Solo se respeta junto con vendedorId (el panel del vendedor ve también sus pausadas)
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  incluirPausadas?: boolean;

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
  @Max(50)
  limite: number = 12;
}
