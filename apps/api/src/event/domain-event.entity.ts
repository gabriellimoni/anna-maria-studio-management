import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('domain_events')
export class DomainEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar' })
  entity: string;

  @Column({ type: 'varchar' })
  entityId: string;

  @Column({ type: 'jsonb' })
  payload: {
    userId: string;
    dto: Record<string, unknown>;
    [key: string]: unknown;
  };

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
