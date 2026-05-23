import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Period } from '@anna-maria/contracts';

@Entity('plan_catalog')
export class PlanCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'enum', enum: ['monthly', 'quarterly', 'semiannual', 'annual'], enumName: 'period_enum', nullable: true })
  period: Period | null;

  @Column({ name: 'duration_months' })
  durationMonths: number;

  @Column({ name: 'weekly_frequency' })
  weeklyFrequency: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'base_price' })
  basePrice: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
