import { DataSource, EntityManager } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PayableGeneratorService } from '../payable-generator.service';
import { RecurringExpense } from '../../../recurring-expenses/entities/recurring-expense.entity';
import { migrations } from '../../../../database/data-source';

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

async function insertRule(ds: DataSource, overrides: Partial<RecurringExpense> = {}): Promise<RecurringExpense> {
  const repo = ds.getRepository(RecurringExpense);
  return repo.save(
    repo.create({
      description: overrides.description ?? 'Aluguel',
      expectedAmount: overrides.expectedAmount ?? '2000.00',
      dueDay: overrides.dueDay ?? 10,
      isActive: true,
    }),
  );
}

describe('PayableGeneratorService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let manager: EntityManager;
  let service: PayableGeneratorService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    ds = await buildDataSource(container);
    manager = ds.manager;
    service = new PayableGeneratorService();
  });

  afterAll(async () => {
    await ds.destroy();
    await container.stop();
  });

  afterEach(async () => {
    await ds.query(`DELETE FROM payable`);
    await ds.query(`DELETE FROM recurring_expense`);
  });

  it('generates payable with correct due_date for due_day=10, July 2026', async () => {
    const rule = await insertRule(ds, { dueDay: 10 });
    const competence = new Date('2026-07-01');

    const result = await service.generateForMonth({ rule, competenceMonth: competence, manager });

    expect(result.created).toBe(true);
    const rows = await ds.query(`SELECT * FROM payable WHERE recurring_expense_id = $1`, [rule.id]);
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0].due_date).toISOString()).toMatch(/^2026-07-10/);
    expect(rows[0].status).toBe('pending');
  });

  it('is idempotent — second call for same rule+month returns created=false', async () => {
    const rule = await insertRule(ds);
    const competence = new Date('2026-07-01');

    await service.generateForMonth({ rule, competenceMonth: competence, manager });
    const second = await service.generateForMonth({ rule, competenceMonth: competence, manager });

    expect(second.created).toBe(false);
    const rows = await ds.query(`SELECT * FROM payable WHERE recurring_expense_id = $1`, [rule.id]);
    expect(rows).toHaveLength(1);
  });

  it('allows a manual payable with same recurring_expense_id + competence (partial index)', async () => {
    const rule = await insertRule(ds);
    const competence = new Date('2026-07-01');

    await service.generateForMonth({ rule, competenceMonth: competence, manager });
    await ds.query(
      `INSERT INTO payable (recurring_expense_id, source, description, amount, due_date, competence_month)
       VALUES ($1, 'manual', 'Manual', '500.00', '2026-07-15', '2026-07-01')`,
      [rule.id],
    );

    const rows = await ds.query(`SELECT * FROM payable WHERE recurring_expense_id = $1`, [rule.id]);
    expect(rows).toHaveLength(2);
  });

  it('generates for different months independently', async () => {
    const rule = await insertRule(ds);

    await service.generateForMonth({ rule, competenceMonth: new Date('2026-06-01'), manager });
    await service.generateForMonth({ rule, competenceMonth: new Date('2026-07-01'), manager });

    const rows = await ds.query(
      `SELECT * FROM payable WHERE recurring_expense_id = $1 ORDER BY due_date`,
      [rule.id],
    );
    expect(rows).toHaveLength(2);
  });
});
