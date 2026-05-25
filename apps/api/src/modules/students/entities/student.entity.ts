import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('student')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', name: 'full_name' })
  fullName: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'date', nullable: true, name: 'birth_date' })
  birthDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  cpf: string | null;

  @Column({ type: 'varchar', nullable: true })
  rg: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'address_street' })
  addressStreet: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'address_number' })
  addressNumber: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'address_complement' })
  addressComplement: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'address_city' })
  addressCity: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'address_state' })
  addressState: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'address_zipcode' })
  addressZipcode: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
