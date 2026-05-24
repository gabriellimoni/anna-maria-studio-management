import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PlanContractStatus } from '@anna-maria/contracts';

@Entity('plan_contract')
export class PlanContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'plan_id' })
  planId: string;

  @Column({ type: 'uuid', name: 'template_id' })
  templateId: string;

  @Column({ name: 'template_version' })
  templateVersion: number;

  @Column({ type: 'text', name: 'body_markdown' })
  bodyMarkdown: string;

  @Column({ type: 'jsonb', name: 'resolved_variables', nullable: true })
  resolvedVariables: Record<string, string> | null;

  @Column({ type: 'text', name: 'rendered_html', nullable: true })
  renderedHtml: string | null;

  @Column({ type: 'varchar', name: 'content_hash', length: 64, nullable: true })
  contentHash: string | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'sent', 'signed', 'cancelled'],
    enumName: 'plan_contract_status',
    default: 'draft',
  })
  status: PlanContractStatus;

  @Index({ unique: true, where: '"access_token" IS NOT NULL' })
  @Column({ type: 'varchar', name: 'access_token', length: 64, nullable: true })
  accessToken: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', name: 'signature_image', nullable: true })
  signatureImage: string | null;

  @Column({ type: 'varchar', name: 'signed_pdf_path', nullable: true })
  signedPdfPath: string | null;

  @Column({ type: 'varchar', name: 'signer_ip', length: 45, nullable: true })
  signerIp: string | null;

  @Column({ type: 'varchar', name: 'signer_user_agent', length: 500, nullable: true })
  signerUserAgent: string | null;

  @Column({ type: 'varchar', name: 'signer_geo_city', nullable: true })
  signerGeoCity: string | null;

  @Column({ type: 'varchar', name: 'signer_geo_region', nullable: true })
  signerGeoRegion: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
