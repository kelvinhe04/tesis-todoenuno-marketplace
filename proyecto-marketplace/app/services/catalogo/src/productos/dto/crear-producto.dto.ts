import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
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

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio admite como máximo 2 decimales' })
  @Min(0)
  precio: number;

  @IsOptional()
  @IsInt({ message: 'El stock debe ser un número entero' })
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
  @IsBoolean()
  pausada?: boolean;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  imagenes?: string[];
}
