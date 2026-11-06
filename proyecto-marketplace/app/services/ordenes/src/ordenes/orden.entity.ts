import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// 'por_cobrar': servicio que se paga en efectivo en el lugar (local o domicilio); pasa a 'pagada' cuando el
// vendedor completa la cita. 'reembolsada' / 'cancelada': todas las citas de la orden se cancelaron (con o sin
// pago previo). El reembolso es SIMULADO (entorno de pruebas): no se devuelve dinero por la pasarela.
export type EstadoPago = 'pendiente' | 'pagada' | 'rechazada' | 'por_cobrar' | 'reembolsada' | 'cancelada';
// Para productos: pendiente -> en_camino -> entregada. Para citas de servicio la pantalla los muestra
// como Agendada -> Completada, y "no_asistio" (solo citas) cuando el cliente no se presentó.
export type EstadoEntrega = 'pendiente' | 'en_camino' | 'entregada' | 'no_asistio' | 'cancelada';

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
  // Solo citas canceladas por el comprador
  canceladaEn?: string;
  reembolso?: number;
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
