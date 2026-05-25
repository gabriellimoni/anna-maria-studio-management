import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { migrations } from '../../../database/data-source';
import { RecurringExpense } from '../entities/recurring-expense.entity';
import { PayableGeneratorService } from '../../scheduling/services/payable-generator.service';
import { RecurringExpensesService } from '../recurring-expenses.service';
import { EventService } from '../../../event/event.service';

async function buildDataSource(container: StartedPostgreSqlContainer): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    url: container.getConnectionUri(),
    entities: [__dirname + '/../../../../**/*.entity{.ts,.js}'],
    migrations,
    synchronize: false,
  });
  await ds.initialize();
  await ds.runMigrations();
  return ds;
}

async function insertRule(
  ds: DataSource,
  overrides: Partial<RecurringExpense> = {},
): Promise<RecurringExpense> {
  const repo = ds.getRepository(RecurringExpense);
  return repo.save(
    repo.create({
      description: overrides.description ?? 'Aluguel',
      expectedAmount: overrides.expectedAmount ?? '2000.00',
      dueDay: overrides.dueDay ?? 10,
      isActive: overrides.isActive ?? true,
    }),
  );
}

describe('RecurringExpensesService.runForMonth (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let service: RecurringExpensesService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    ds = await buildDataSource(container);
    service = new RecurringExpensesService(
      ds.getRepository(RecurringExpense),
      ds,
      new PayableGeneratorService(),
      { record: jest.fn() } as unknown as EventService,
    );
  });

  afterAll(async () => {
    await ds.destroy();
    await container.stop();
  });

  afterEach(async () => {
    await ds.query(`DELETE FROM payable`);
    await ds.query(`DELETE FROM recurring_expense`);
  });

  it('generates payables for all active rules and returns correct counts', async () => {
    await insertRule(ds, { description: 'Aluguel', dueDay: 10 });
    await insertRule(ds, { description: 'Energia', dueDay: 15 });
    await insertRule(ds, { description: 'Internet', dueDay: 20 });

    const result = await service.runForMonth(new Date('2026-08-01T00:00:00Z'));

    expect(result.created).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const rows = await ds.query(`SELECT * FROM payable ORDER BY due_date`);
    expect(rows).toHaveLength(3);
    expect(new Date(rows[0].due_date).toISOString()).toMatch(/^2026-08-10/);
    expect(new Date(rows[1].due_date).toISOString()).toMatch(/^2026-08-15/);
    expect(new Date(rows[2].due_date).toISOString()).toMatch(/^2026-08-20/);
    rows.forEach((r: Record<string, unknown>) => {
      expect(new Date(r.competence_month as string).toISOString()).toMatch(/^2026-08-01/);
      expect(r.status).toBe('pending');
      expect(r.source).toBe('recurring');
    });
  });

  it('is idempotent — running twice for the same month skips on second call', async () => {
    await insertRule(ds, { description: 'Aluguel', dueDay: 10 });
    await insertRule(ds, { description: 'Energia', dueDay: 15 });

    await service.runForMonth(new Date('2026-07-01T00:00:00Z'));
    const second = await service.runForMonth(new Date('2026-07-01T00:00:00Z'));

    expect(second.created).toBe(0);
    expect(second.skipped).toBe(2);
    expect(second.errors).toHaveLength(0);

    const rows = await ds.query(`SELECT * FROM payable`);
    expect(rows).toHaveLength(2);
  });

  it('excludes inactive rules from generation', async () => {
    await insertRule(ds, { description: 'Aluguel', dueDay: 10, isActive: true });
    await insertRule(ds, { description: 'Energia', dueDay: 15, isActive: true });
    await insertRule(ds, { description: 'Inativa', dueDay: 20, isActive: false });

    const result = await service.runForMonth(new Date('2026-09-01T00:00:00Z'));

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const rows = await ds.query(`SELECT * FROM payable`);
    expect(rows).toHaveLength(2);
  });

  it('generates independently for different months', async () => {
    await insertRule(ds, { description: 'Aluguel', dueDay: 10 });

    await service.runForMonth(new Date('2026-07-01T00:00:00Z'));
    await service.runForMonth(new Date('2026-08-01T00:00:00Z'));

    const rows = await ds.query(`SELECT * FROM payable ORDER BY due_date`);
    expect(rows).toHaveLength(2);
    expect(new Date(rows[0].due_date).toISOString()).toMatch(/^2026-07-10/);
    expect(new Date(rows[1].due_date).toISOString()).toMatch(/^2026-08-10/);
  });

  it('returns empty result when no active rules exist', async () => {
    const result = await service.runForMonth(new Date('2026-07-01T00:00:00Z'));

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
