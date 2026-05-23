import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PaymentMethod, Period, PlanStatus } from '@anna-maria/contracts';

@Entity('plan')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', nullable: true, name: 'plan_catalog_id' })
  planCatalogId: string | null;

  @Column({ type: 'enum', enum: ['monthly', 'quarterly', 'semiannual', 'annual'], enumName: 'period_enum' })
  period: Period;

  @Column({ name: 'weekly_frequency' })
  weeklyFrequency: number;

  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'total_price' })
  totalPrice: string;

  @Column({ type: 'enum', enum: ['cash', 'pix', 'card', 'boleto'], enumName: 'payment_method_enum', nullable: true, name: 'payment_method' })
  paymentMethod: PaymentMethod | null;

  @Column({ default: 1, name: 'installments_count' })
  installmentsCount: number;

  @Column({ type: 'enum', enum: ['active', 'finished', 'cancelled'], enumName: 'plan_status_enum' })
  status: PlanStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
