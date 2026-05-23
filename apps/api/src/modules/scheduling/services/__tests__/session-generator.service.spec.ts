import { DataSource, EntityManager } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { getDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { SessionGeneratorService } from '../session-generator.service';
import { Plan } from '../../../plans/entities/plan.entity';
import { migrations } from '../../../../database/data-source';

const TZ = 'America/Sao_Paulo';

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

async function insertPlan(ds: DataSource, overrides: Partial<{
  startDate: string; endDate: string; weeklyFrequency: number; period: string;
}> = {}): Promise<Plan> {
  const [student] = await ds.query(`INSERT INTO student (full_name) VALUES ('Test') RETURNING id`);
  const data = {
    studentId: student.id,
    period: overrides.period ?? 'monthly',
    weeklyFrequency: overrides.weeklyFrequency ?? 2,
    startDate: overrides.startDate ?? '2026-06-01',
    endDate: overrides.endDate ?? '2026-06-30',
    totalPrice: '280.00',
    installmentsCount: 1,
    status: 'active',
  };
  const repo = ds.getRepository(Plan);
  return (repo.save(repo.create(data as any)) as unknown) as Promise<Plan>;
}

describe('SessionGeneratorService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let manager: EntityManager;
  let service: SessionGeneratorService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    ds = await buildDataSource(container);
    manager = ds.manager;
    service = new SessionGeneratorService();
  });

  afterAll(async () => {
    await ds.destroy();
    await container.stop();
  });

  afterEach(async () => {
    await ds.query(`DELETE FROM session`);
    await ds.query(`DELETE FROM plan`);
    await ds.query(`DELETE FROM student`);
  });

  it('generates ~26 sessions for a quarterly 2x plan (Mon + Thu)', async () => {
    const plan = await insertPlan(ds, {
      startDate: '2026-06-01',
      endDate: '2026-08-31',
      weeklyFrequency: 2,
      period: 'quarterly',
    });

    const sessions = await service.generate({
      plan,
      schedules: [
        { weekday: 1, startTime: '17:00' },
        { weekday: 4, startTime: '18:30' },
      ],
      manager,
    });

    expect(sessions.length).toBeGreaterThanOrEqual(24);
    expect(sessions.length).toBeLessThanOrEqual(28);

    for (const s of sessions) {
      const zoned = toZonedTime(s.scheduledAt, TZ);
      const wd = getDay(zoned);
      expect([1, 4]).toContain(wd);
      const h = zoned.getHours();
      const m = zoned.getMinutes();
      if (wd === 1) { expect(h).toBe(17); expect(m).toBe(0); }
      if (wd === 4) { expect(h).toBe(18); expect(m).toBe(30); }
    }
  });

  it('generates ~26 sessions for a semiannual 1x plan (Wed)', async () => {
    const plan = await insertPlan(ds, {
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      weeklyFrequency: 1,
      period: 'semiannual',
    });

    const sessions = await service.generate({
      plan,
      schedules: [{ weekday: 3, startTime: '10:00' }],
      manager,
    });

    expect(sessions.length).toBeGreaterThanOrEqual(24);
    expect(sessions.length).toBeLessThanOrEqual(28);
    for (const s of sessions) {
      expect(getDay(toZonedTime(s.scheduledAt, TZ))).toBe(3);
    }
  });

  it('generates ~12-13 sessions for a monthly 3x plan', async () => {
    const plan = await insertPlan(ds, {
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      weeklyFrequency: 3,
    });

    const sessions = await service.generate({
      plan,
      schedules: [
        { weekday: 1, startTime: '08:00' },
        { weekday: 3, startTime: '08:00' },
        { weekday: 5, startTime: '08:00' },
      ],
      manager,
    });

    expect(sessions.length).toBeGreaterThanOrEqual(12);
    expect(sessions.length).toBeLessThanOrEqual(14);
  });

  it('scheduledAt is correct in BR timezone (not off by UTC drift)', async () => {
    const plan = await insertPlan(ds, { startDate: '2026-07-06', endDate: '2026-07-06' });

    const sessions = await service.generate({
      plan,
      schedules: [{ weekday: 1, startTime: '09:00' }],
      manager,
    });

    expect(sessions).toHaveLength(1);
    const zoned = toZonedTime(sessions[0].scheduledAt, TZ);
    expect(zoned.getHours()).toBe(9);
    expect(zoned.getMinutes()).toBe(0);
    expect(getDay(zoned)).toBe(1);
  });

  it('regenerateFuture: past sessions preserved, future scheduled ones replaced', async () => {
    const plan = await insertPlan(ds, {
      startDate: '2026-06-01',
      endDate: '2026-08-31',
      weeklyFrequency: 1,
      period: 'quarterly',
    });

    await service.generate({
      plan,
      schedules: [{ weekday: 1, startTime: '17:00' }],
      manager,
    });

    const [pastSession] = await ds.query(
      `SELECT id FROM session WHERE scheduled_at < now() AND plan_id = $1 LIMIT 1`,
      [plan.id],
    );
    if (pastSession) {
      await ds.query(`UPDATE session SET status='present' WHERE id=$1`, [pastSession.id]);
    }

    const [futureCancelled] = await ds.query(
      `SELECT id FROM session WHERE scheduled_at >= now() AND plan_id = $1 LIMIT 1`,
      [plan.id],
    );
    if (futureCancelled) {
      await ds.query(`UPDATE session SET status='cancelled' WHERE id=$1`, [futureCancelled.id]);
    }

    const now = new Date();
    const result = await service.regenerateFuture({
      plan,
      newSchedules: [{ weekday: 4, startTime: '18:30' }],
      manager,
      now,
    });

    expect(result.removed).toBeGreaterThanOrEqual(0);
    expect(result.created).toBeGreaterThanOrEqual(0);

    if (pastSession) {
      const [past] = await ds.query(`SELECT * FROM session WHERE id=$1`, [pastSession.id]);
      expect(past.status).toBe('present');
    }

    if (futureCancelled) {
      const [cancelled] = await ds.query(`SELECT * FROM session WHERE id=$1`, [futureCancelled.id]);
      expect(cancelled.status).toBe('cancelled');
    }

    const futureSessions = await ds.query(
      `SELECT * FROM session WHERE plan_id=$1 AND scheduled_at >= now() AND status='scheduled'`,
      [plan.id],
    );
    for (const s of futureSessions) {
      const zoned = toZonedTime(new Date(s.scheduled_at), TZ);
      expect(getDay(zoned)).toBe(4);
    }
  });
});
