import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type MetodoPago = 'tarjeta' | 'paypal';
export type EstadoPago = 'aprobado' | 'rechazado';

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ordenId: string;

  @Column()
  compradorId: string;

  @Column('float')
  monto: number;

  @Column({ type: 'varchar' })
  metodo: MetodoPago;

  @Column({ type: 'varchar' })
  estado: EstadoPago;

  @Column({ nullable: true })
  motivoRechazo?: string;

  // Solo para trazabilidad en el sandbox: ultimos 4 digitos, nunca el numero completo.
  @Column({ nullable: true })
  tarjetaUltimos4?: string;

  @CreateDateColumn()
  creadoEn: Date;
}
