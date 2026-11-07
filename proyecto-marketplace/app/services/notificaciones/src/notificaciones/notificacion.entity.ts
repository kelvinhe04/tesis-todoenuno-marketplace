import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TipoNotificacion = 'orden_creada' | 'pago_confirmado' | 'pago_rechazado' | 'nueva_orden_vendedor' | 'resena_pendiente' | 'cita_agendada' | 'cita_cancelada' | 'cita_recordatorio' | 'cita_recordatorio_vendedor';

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

  // Solo en avisos de reseña: la publicación que se puede reseñar
  @Column({ type: 'varchar', nullable: true })
  productoId: string | null;

  @Column({ default: false })
  leida: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
