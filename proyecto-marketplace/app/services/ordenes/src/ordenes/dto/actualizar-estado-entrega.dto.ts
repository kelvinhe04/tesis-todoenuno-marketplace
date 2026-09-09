import { IsIn } from 'class-validator';
import { EstadoEntrega } from '../orden.entity';

export class ActualizarEstadoEntregaDto {
  @IsIn(['pendiente', 'en_camino', 'entregada'])
  estadoEntrega: EstadoEntrega;
}
