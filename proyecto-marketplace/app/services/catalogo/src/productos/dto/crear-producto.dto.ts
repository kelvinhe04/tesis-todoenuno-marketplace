import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { ModalidadEntrega, TipoPublicacion } from '../producto.schema';
import { DisponibilidadDto } from './disponibilidad.dto';
import { UbicacionDto } from './ubicacion.dto';

export class CrearProductoDto {
  @IsIn(['producto', 'servicio'])
  tipo: TipoPublicacion;

  @IsString()
  @MinLength(3)
  nombre: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsString()
  @MinLength(10)
  descripcion: string;

  @IsString()
  categoria: string;

  @IsNumber()
  @Min(0)
  precio: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsIn(['domicilio_cliente', 'local_vendedor'])
  modalidadEntrega?: ModalidadEntrega;

  @IsOptional()
  @IsString()
  direccionLocal?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UbicacionDto)
  ubicacion?: UbicacionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DisponibilidadDto)
  disponibilidad?: DisponibilidadDto;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  imagenes?: string[];
}
