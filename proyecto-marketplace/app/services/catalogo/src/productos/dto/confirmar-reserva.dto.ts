import { IsString } from 'class-validator';

export class ConfirmarReservaDto {
  @IsString()
  ordenId: string;
}
