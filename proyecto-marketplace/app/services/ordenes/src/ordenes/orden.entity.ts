import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EstadoPago = 'pendiente' | 'pagada' | 'rechazada';
// Para productos: pendiente -> en_camino -> entregada. Para citas de servicio la pantalla los muestra
// como Agendada -> Completada, y "no_asistio" (solo citas) cuando el cliente no se presentó.
export type EstadoEntrega = 'pendiente' | 'en_camino' | 'entregada' | 'no_asistio';

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
  // Solo servicios: dónde se presta (define los textos de estado de la cita)
  modalidadEntrega?: 'domicilio_cliente' | 'local_vendedor';
  cita?: CitaOrden;
  // Entrega por ítem: cada vendedor gestiona solo la de sus ítems. Las órdenes antiguas no lo traen
  // (se usa el estado de la orden).
  estadoEntrega?: EstadoEntrega;
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
