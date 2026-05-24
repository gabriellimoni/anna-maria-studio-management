import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ConfigService } from '@nestjs/config';
import { ContractsService } from '../contracts.service';
import { MarkdownRendererService } from '../markdown-renderer.service';
import { PdfGeneratorService } from '../pdf/pdf-generator.service';
import { VariableResolverService } from '../variable-resolver.service';
import { EventService } from '../../../event/event.service';
import { migrations } from '../../../database/data-source';
import type { ContractStorageProvider } from '../storage/contract-storage.interface';
import type { User } from '../../../user/user.entity';

async function buildDataSource(container: StartedPostgreSqlContainer): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    url: container.getConnectionUri(),
    entities: [__dirname + '/../../../**/*.entity{.ts,.js}'],
    migrations,
    synchronize: false,
  });
  await ds.initialize();
  await ds.runMigrations();
  return ds;
}

const mockUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'owner@studio.com',
  role: 'operator',
  isActive: true,
  studentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  firebaseUid: 'firebase-uid',
};

async function insertUserAndStudent(ds: DataSource): Promise<{ studentId: string; planId: string; userId: string }> {
  const userId = '00000000-0000-0000-0000-000000000001';
  await ds.query(`
    INSERT INTO "user" (id, "firebaseUid", email, role, is_active)
    VALUES ($1, 'uid', 'owner@studio.com', 'operator', true)
    ON CONFLICT DO NOTHING
  `, [userId]);

  const studentId = '00000000-0000-0000-0000-000000000002';
  await ds.query(`
    INSERT INTO student (id, full_name, email, phone, is_active)
    VALUES ($1, 'Maria Teste', 'maria@test.com', '11999999999', true)
    ON CONFLICT DO NOTHING
  `, [studentId]);

  const planId = '00000000-0000-0000-0000-000000000003';
  await ds.query(`
    INSERT INTO plan (id, student_id, period, weekly_frequency, start_date, end_date, total_price, status)
    VALUES ($1, $2, 'monthly', 2, '2026-01-01', '2026-01-31', '480.00', 'active')
    ON CONFLICT DO NOTHING
  `, [planId, studentId]);

  return { studentId, planId, userId };
}

describe('ContractsService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let service: ContractsService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    ds = await buildDataSource(container);

    const config = { get: jest.fn().mockReturnValue('http://localhost:5173') } as unknown as ConfigService;
    const eventService = { record: jest.fn() } as unknown as EventService;
    const variableResolver = new VariableResolverService(ds, config);
    const markdownRenderer = new MarkdownRendererService();
    const pdfGenerator = new PdfGeneratorService(config);
    const storage: ContractStorageProvider = {
      save: jest.fn().mockResolvedValue('contracts/test.pdf'),
      read: jest.fn().mockResolvedValue(Buffer.from('pdf')),
      createReadStream: jest.fn(),
      delete: jest.fn(),
    };

    service = new ContractsService(ds, eventService, variableResolver, markdownRenderer, pdfGenerator, storage, config);
  }, 120_000);

  afterAll(async () => {
    await ds.destroy();
    await container.stop();
  });

  beforeEach(async () => {
    await ds.query(`DELETE FROM plan_contract`);
    await ds.query(`DELETE FROM contract_template`);
    await ds.query(`DELETE FROM domain_events`);
  });

  it('full lifecycle: materialize → send → sign → view', async () => {
    const { planId } = await insertUserAndStudent(ds);

    // Create template
    const tpl = await service.createTemplate({ name: 'Contrato Padrão', bodyMarkdown: '# Contrato\n\nOlá {{studentName}}' }, mockUser);
    expect(tpl.version).toBe(1);

    // Materialize
    const contract = await service.materialize(planId, { templateId: tpl.id }, mockUser);
    expect(contract.status).toBe('draft');

    // Send
    const { publicUrl } = await service.send(planId, mockUser);
    expect(publicUrl).toContain('/contrato/');

    // Extract token
    const token = publicUrl.split('/contrato/')[1];

    // View public
    const view = await service.view(token);
    expect(view.status).toBe('sent');
    expect(view.studentName).toBe('Maria Teste');

    // Sign
    const fakeSignature = 'data:image/png;base64,' + 'A'.repeat(1400);
    const mockReq = { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as import('express').Request;
    const signResult = await service.sign(token, fakeSignature, mockReq);
    expect(signResult.pdfUrl).toContain(token);

    // View after signing
    const viewSigned = await service.view(token);
    expect(viewSigned.status).toBe('signed');
    expect(viewSigned.pdfAvailable).toBe(true);
  }, 30_000);

  it('unique constraint on plan_id prevents two active contracts', async () => {
    const { planId } = await insertUserAndStudent(ds);
    const tpl = await service.createTemplate({ name: 'T', bodyMarkdown: 'texto' }, mockUser);
    await service.materialize(planId, { templateId: tpl.id }, mockUser);
    await expect(service.materialize(planId, { templateId: tpl.id }, mockUser)).rejects.toThrow();
  }, 30_000);

  it('allows new contract after cancellation', async () => {
    const { planId } = await insertUserAndStudent(ds);
    const tpl = await service.createTemplate({ name: 'T', bodyMarkdown: 'texto' }, mockUser);
    await service.materialize(planId, { templateId: tpl.id }, mockUser);
    await service.cancel(planId, mockUser);
    const newContract = await service.materialize(planId, { templateId: tpl.id }, mockUser);
    expect(newContract.status).toBe('draft');
  }, 30_000);

  it('view returns 410 when signed >7d ago', async () => {
    const { planId } = await insertUserAndStudent(ds);
    const tpl = await service.createTemplate({ name: 'T', bodyMarkdown: '{{studentName}}' }, mockUser);
    await service.materialize(planId, { templateId: tpl.id }, mockUser);
    const { publicUrl } = await service.send(planId, mockUser);
    const token = publicUrl.split('/contrato/')[1];

    const fakeSignature = 'data:image/png;base64,' + 'A'.repeat(1400);
    const mockReq = { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as import('express').Request;
    await service.sign(token, fakeSignature, mockReq);

    // manipulate signed_at to 8 days ago
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await ds.query(`UPDATE plan_contract SET signed_at = $1 WHERE access_token = $2`, [eightDaysAgo, token]);

    const { GoneException } = await import('@nestjs/common');
    await expect(service.view(token)).rejects.toThrow(GoneException);
  }, 30_000);

  it('updateTemplate increments version', async () => {
    const tpl = await service.createTemplate({ name: 'T', bodyMarkdown: 'v1' }, mockUser);
    const updated = await service.updateTemplate(tpl.id, { name: 'T v2' }, mockUser);
    expect(updated.version).toBe(2);
  }, 10_000);
});
