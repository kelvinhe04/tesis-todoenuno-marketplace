import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AgregarItemDto {
  @IsString()
  productoId: string;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsOptional()
  @IsString()
  reservaId?: string;
}
