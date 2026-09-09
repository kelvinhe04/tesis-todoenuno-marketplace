import { IsIn, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  credential: string;

  @IsOptional()
  @IsIn(['comprador', 'vendedor'])
  rol?: 'comprador' | 'vendedor';
}
