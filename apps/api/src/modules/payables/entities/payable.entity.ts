import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LancamentoStatus, PayableSource, PaymentMethod } from '@anna-maria/contracts';

@Entity('payable')
export class Payable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'recurring_expense_id' })
  recurringExpenseId: string | null;

  @Column({ type: 'enum', enum: ['recurring', 'manual'], enumName: 'payable_source_enum' })
  source: PayableSource;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  category: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'date', name: 'due_date' })
  dueDate: string;

  @Column({ type: 'date', nullable: true, name: 'competence_month' })
  competenceMonth: string | null;

  @Column({ type: 'enum', enum: ['pending', 'paid'], enumName: 'lancamento_status_enum', default: 'pending' })
  status: LancamentoStatus;

  @Column({ type: 'date', nullable: true, name: 'paid_at' })
  paidAt: string | null;

  @Column({ type: 'enum', enum: ['cash', 'pix', 'card', 'boleto'], enumName: 'payment_method_enum', nullable: true, name: 'payment_method' })
  paymentMethod: PaymentMethod | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
