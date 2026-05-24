import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SessionOrigin, SessionStatus } from '@anna-maria/contracts';

@Entity('session')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'plan_id' })
  planId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'student_id' })
  studentId: string | null;

  @Column({ type: 'timestamptz', name: 'scheduled_at' })
  scheduledAt: Date;

  @Column({ type: 'enum', enum: ['scheduled', 'present', 'absence_notified', 'absence_unnotified', 'cancelled'], enumName: 'session_status_enum' })
  status: SessionStatus;

  @Column({ type: 'enum', enum: ['plan', 'drop_in'], enumName: 'session_origin_enum', default: 'plan' })
  origin: SessionOrigin;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
