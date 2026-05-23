import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('drop_in_class')
export class DropInClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'session_id' })
  sessionId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'student_id' })
  studentId: string | null;

  @Column({ type: 'text', nullable: true, name: 'prospect_name' })
  prospectName: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'receivable_id' })
  receivableId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
