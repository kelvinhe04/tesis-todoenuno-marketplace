import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EstadoPago = 'pendiente' | 'pagada' | 'rechazada';
export type EstadoEntrega = 'pendiente' | 'en_camino' | 'entregada';

export interface CitaOrden {
  reservaId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export interface ItemOrden {
  productoId: string;
  vendedorId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
  tipo?: 'producto' | 'servicio';
  cita?: CitaOrden;
}

export interface DireccionOrden {
  nombre: string;
  telefono: string;
  direccion: string;
}

@Entity('ordenes')
export class Orden {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  compradorId: string;

  @Column({ type: 'jsonb' })
  items: ItemOrden[];

  @Column({ type: 'jsonb' })
  direccion: DireccionOrden;

  @Column('float')
  subtotal: number;

  @Column('float', { default: 0 })
  envio: number;

  @Column('float')
  total: number;

  @Column({ type: 'varchar', default: 'pendiente' })
  estadoPago: EstadoPago;

  @Column({ type: 'varchar', default: 'pendiente' })
  estadoEntrega: EstadoEntrega;

  @CreateDateColumn()
  creadoEn: Date;
}
