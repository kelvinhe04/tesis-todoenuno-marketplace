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

  @Column({ type: 'varchar', default: 'comprador' })
  rol: RolUsuario;

  @CreateDateColumn()
  creadoEn: Date;
}
