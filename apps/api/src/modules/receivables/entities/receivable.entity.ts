import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LancamentoStatus, PaymentMethod, ReceivableSource } from '@anna-maria/contracts';

@Entity('receivable')
export class Receivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'plan_id' })
  planId: string | null;

  @Column({ type: 'enum', enum: ['plan', 'drop_in', 'manual'], enumName: 'receivable_source_enum' })
  source: ReceivableSource;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'date', name: 'due_date' })
  dueDate: string;

  @Column({ type: 'int', nullable: true, name: 'installment_number' })
  installmentNumber: number | null;

  @Column({ type: 'int', nullable: true, name: 'installment_total' })
  installmentTotal: number | null;

  @Column({ type: 'enum', enum: ['cash', 'pix', 'card', 'boleto'], enumName: 'payment_method_enum', nullable: true, name: 'payment_method' })
  paymentMethod: PaymentMethod | null;

  @Column({ type: 'enum', enum: ['pending', 'paid'], enumName: 'lancamento_status_enum', default: 'pending' })
  status: LancamentoStatus;

  @Column({ type: 'date', nullable: true, name: 'paid_at' })
  paidAt: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
