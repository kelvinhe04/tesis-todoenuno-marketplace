import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('direcciones')
export class Direccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  usuarioId: string;

  @Column()
  nombre: string;

  @Column()
  telefono: string;

  @Column()
  direccion: string;

  @Column({ default: false })
  predeterminada: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
