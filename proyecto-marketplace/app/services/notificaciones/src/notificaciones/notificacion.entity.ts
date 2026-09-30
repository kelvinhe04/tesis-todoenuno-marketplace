import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TipoNotificacion = 'orden_creada' | 'pago_confirmado' | 'pago_rechazado' | 'nueva_orden_vendedor';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  usuarioId: string;

  @Column({ type: 'varchar' })
  tipo: TipoNotificacion;

  @Column()
  mensaje: string;

  @Column()
  ordenId: string;

  @Column({ default: false })
  leida: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
