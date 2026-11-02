import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type MarcaTarjeta = 'Visa' | 'Mastercard' | 'American Express' | 'Otra';

// Solo se guarda lo mínimo para reconocer la tarjeta: NUNCA el número completo ni el CVV.
@Entity('tarjetas_guardadas')
export class TarjetaGuardada {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  usuarioId: string;

  @Column({ type: 'varchar' })
  marca: MarcaTarjeta;

  @Column({ length: 4 })
  ultimos4: string;

  // MM/AA
  @Column({ length: 5 })
  vencimiento: string;

  @Column({ default: false })
  predeterminada: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
