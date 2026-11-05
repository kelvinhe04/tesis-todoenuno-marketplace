import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type RolUsuario = 'comprador' | 'vendedor';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', nullable: true })
  fotoUrl: string | null;

  @Column({ type: 'varchar', default: 'comprador' })
  rol: RolUsuario;

  // true por defecto: las cuentas anteriores a la verificación quedan verificadas. Las nuevas por
  // registro con contraseña nacen en false (las de Google ya vienen verificadas por Google).
  @Column({ default: true })
  emailVerificado: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
