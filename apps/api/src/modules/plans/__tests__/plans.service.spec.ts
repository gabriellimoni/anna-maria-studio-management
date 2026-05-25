import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { addDays, format } from 'date-fns';
import { PlansService } from '../plans.service';
import { SessionGeneratorService } from '../../scheduling/services/session-generator.service';
import { ReceivablePersistService } from '../../scheduling/services/receivable-persist.service';
import { CapacityCheckerService } from '../../scheduling/services/capacity-checker.service';
import { Plan } from '../entities/plan.entity';
import { Student } from '../../students/entities/student.entity';
import { PlanCatalog } from '../../plan-catalog/entities/plan-catalog.entity';
import { Session } from '../../sessions/entities/session.entity';
import { migrations } from '../../../database/data-source';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { EventService } from '../../../event/event.service';
import { User } from '../../../user/user.entity';

const mockUser = { id: 'user-uuid-1' } as User;
const mockEventService = { record: jest.fn() } as unknown as EventService;

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

const SCHEDULES_2X = [
  { weekday: 1, startTime: '17:00' },
  { weekday: 4, startTime: '18:30' },
];

const INSTALLMENTS_3 = [
  { amount: '150.00', dueDate: '2026-06-10', status: 'paid' as const, paidAt: '2026-06-10' },
  { amount: '150.00', dueDate: '2026-07-10' },
  { amount: '150.00', dueDate: '2026-08-10' },
];

describe('PlansService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let service: PlansService;
  let student: Student;
  let catalog: PlanCatalog;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    ds = await buildDataSource(container);

    const sessionGenerator = new SessionGeneratorService();
    const receivablePersist = new ReceivablePersistService();
    const capacityChecker = new CapacityCheckerService();
    service = new PlansService(ds, sessionGenerator, receivablePersist, capacityChecker, mockEventService);
  });

  afterAll(async () => {
    await ds.destroy();
    await container.stop();
  });

  beforeEach(async () => {
    student = await ds.getRepository(Student).save(
      ds.getRepository(Student).create({ fullName: 'Test Student', isActive: true }),
    );
    catalog = await ds.getRepository(PlanCatalog).save(
      ds.getRepository(PlanCatalog).create({
        name: '2x Trimestral',
        period: 'quarterly',
        durationMonths: 3,
        weeklyFrequency: 2,
        basePrice: '450.00',
        isActive: true,
      }),
    );
  });

  afterEach(async () => {
    await ds.query('DELETE FROM domain_events');
    await ds.query('DELETE FROM receivable');
    await ds.query('DELETE FROM session');
    await ds.query('DELETE FROM plan_schedule');
    await ds.query('DELETE FROM plan');
    await ds.query('DELETE FROM plan_catalog');
    await ds.query('DELETE FROM student');
  });

  describe('create()', () => {
    it('creates plan, sessions, and receivables transactionally', async () => {
      const dto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };

      const result = await service.create(dto, mockUser);

      expect((result as any).id).toBeDefined();
      expect((result as any).generated.sessions).toBeGreaterThanOrEqual(24);
      expect((result as any).generated.sessions).toBeLessThanOrEqual(28);
      expect((result as any).generated.receivables).toBe(3);
      expect((result as any).warnings).toBeUndefined();

      const [{ count: sessionCount }] = await ds.query(
        `SELECT count(*) FROM session WHERE plan_id = $1`,
        [(result as any).id],
      );
      expect(Number(sessionCount)).toBeGreaterThanOrEqual(24);

      const [{ count: receivableCount }] = await ds.query(
        `SELECT count(*) FROM receivable WHERE plan_id = $1`,
        [(result as any).id],
      );
      expect(Number(receivableCount)).toBe(3);
    });

    it('returns over-capacity warning without failing when slot is full', async () => {
      const otherStudent = await ds.getRepository(Student).save(
        ds.getRepository(Student).create({ fullName: 'Other Student', isActive: true }),
      );

      // Pre-fill the Mon 17:00 slot on 2026-06-01 with 4 sessions
      const slotDate = new Date('2026-06-08T20:00:00.000Z'); // 2026-06-08 17:00 BRT = 20:00 UTC
      for (let i = 0; i < 4; i++) {
        await ds.getRepository(Session).save(
          ds.getRepository(Session).create({
            planId: null,
            studentId: otherStudent.id,
            scheduledAt: slotDate,
            status: 'scheduled',
            origin: 'plan',
          }),
        );
      }

      const dto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };

      const result = await service.create(dto, mockUser);

      expect((result as any).id).toBeDefined();
      expect((result as any).warnings?.overCapacitySlots).toBeDefined();
      expect((result as any).warnings.overCapacitySlots.length).toBeGreaterThan(0);
    });

    it('throws 422 when student is inactive', async () => {
      const inactiveStudent = await ds.getRepository(Student).save(
        ds.getRepository(Student).create({ fullName: 'Inactive', isActive: false }),
      );

      const dto: CreatePlanDto = {
        studentId: inactiveStudent.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };

      await expect(service.create(dto, mockUser)).rejects.toThrow('Aluno arquivado');
    });

    it('throws 422 when schedules.length mismatches weeklyFrequency', async () => {
      const dto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: [{ weekday: 1, startTime: '17:00' }], // catalog expects 2
        installments: INSTALLMENTS_3,
      };

      await expect(service.create(dto, mockUser)).rejects.toThrow('Expected 2 schedules');
    });

    it('throws 422 when installment sum mismatches totalPrice', async () => {
      const dto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: [
          { amount: '140.00', dueDate: '2026-06-10' },
          { amount: '150.00', dueDate: '2026-07-10' },
          { amount: '150.00', dueDate: '2026-08-10' },
        ],
      };

      await expect(service.create(dto, mockUser)).rejects.toThrow(/sum|match/i);
    });

    it('computes endDate correctly (startDate + durationMonths - 1 day)', async () => {
      const dto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };

      const result = await service.create(dto, mockUser);
      expect((result as any).endDate).toBe('2026-08-31');
    });
  });

  describe('changeSchedule()', () => {
    it('regenerates only future sessions and preserves past sessions', async () => {
      const createDto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const created = await service.create(createDto, mockUser);
      const planId = (created as any).id;

      // Manually mark a past session as present
      const [pastSession] = await ds.query(
        `SELECT id FROM session WHERE plan_id = $1 AND scheduled_at < now() LIMIT 1`,
        [planId],
      );
      if (pastSession) {
        await ds.query(`UPDATE session SET status = 'present' WHERE id = $1`, [pastSession.id]);
      }

      await service.changeSchedule(planId, {
        schedules: [
          { weekday: 3, startTime: '09:00' },
          { weekday: 5, startTime: '10:00' },
        ],
      }, mockUser);

      // Past session preserved
      if (pastSession) {
        const [past] = await ds.query(`SELECT status FROM session WHERE id = $1`, [pastSession.id]);
        expect(past.status).toBe('present');
      }

      // Future sessions use new weekdays (3 and 5)
      const futureSessions = await ds.query(
        `SELECT scheduled_at FROM session WHERE plan_id = $1 AND scheduled_at >= now() AND status = 'scheduled'`,
        [planId],
      );
      // Should have sessions only on Wed and Fri
      for (const s of futureSessions) {
        const dow = new Date(s.scheduled_at).getDay();
        expect([3, 5]).toContain(dow);
      }
    });

    it('throws when plan is cancelled', async () => {
      const createDto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const created = await service.create(createDto, mockUser);
      const planId = (created as any).id;

      await service.cancel(planId, { cancelFutureSessions: false }, mockUser);

      await expect(
        service.changeSchedule(planId, { schedules: SCHEDULES_2X }, mockUser),
      ).rejects.toThrow();
    });
  });

  describe('cancel()', () => {
    it('cancels future sessions and leaves past sessions intact', async () => {
      const createDto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const created = await service.create(createDto, mockUser);
      const planId = (created as any).id;

      const [pastSession] = await ds.query(
        `SELECT id FROM session WHERE plan_id = $1 AND scheduled_at < now() LIMIT 1`,
        [planId],
      );
      if (pastSession) {
        await ds.query(`UPDATE session SET status = 'present' WHERE id = $1`, [pastSession.id]);
      }

      const result = await service.cancel(planId, { cancelFutureSessions: true, reason: 'test reason' }, mockUser);

      expect(result.cancelledFutureSessions).toBeGreaterThan(0);
      expect(result.pendingReceivables.length).toBeGreaterThan(0);

      const [plan] = await ds.query(`SELECT status FROM plan WHERE id = $1`, [planId]);
      expect(plan.status).toBe('cancelled');

      if (pastSession) {
        const [past] = await ds.query(`SELECT status FROM session WHERE id = $1`, [pastSession.id]);
        expect(past.status).toBe('present');
      }

      const [{ count: futureScheduled }] = await ds.query(
        `SELECT count(*) FROM session WHERE plan_id = $1 AND scheduled_at >= now() AND status = 'scheduled'`,
        [planId],
      );
      expect(Number(futureScheduled)).toBe(0);
    });

    it('does not cancel sessions when cancelFutureSessions is false', async () => {
      const createDto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const created = await service.create(createDto, mockUser);
      const planId = (created as any).id;

      await service.cancel(planId, { cancelFutureSessions: false }, mockUser);

      const [{ count: futureScheduled }] = await ds.query(
        `SELECT count(*) FROM session WHERE plan_id = $1 AND scheduled_at >= now() AND status = 'scheduled'`,
        [planId],
      );
      expect(Number(futureScheduled)).toBeGreaterThan(0);
    });
  });

  describe('renew()', () => {
    it('creates a new plan with same schedules when keepSchedules=true', async () => {
      const createDto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const original = await service.create(createDto, mockUser);
      const originalId = (original as any).id;

      const renewed = await service.renew(originalId, {
        startDate: '2026-09-01',
        totalPrice: '450.00',
        keepSchedules: true,
        installments: [
          { amount: '150.00', dueDate: '2026-09-10' },
          { amount: '150.00', dueDate: '2026-10-10' },
          { amount: '150.00', dueDate: '2026-11-10' },
        ],
      }, mockUser);

      expect(renewed.newPlanId).not.toBe(originalId);
      expect(renewed.generated.sessions).toBeGreaterThan(0);
      expect(renewed.generated.receivables).toBe(3);

      const [originalPlan] = await ds.query(`SELECT status FROM plan WHERE id = $1`, [originalId]);
      expect(originalPlan.status).toBe('finished');
    });
  });

  describe('findAll()', () => {
    it('returns only plans expiring within expiringInDays, sorted by endDate ASC', async () => {
      const soonEndDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');
      const farEndDate = format(addDays(new Date(), 100), 'yyyy-MM-dd');

      await ds.getRepository(Plan).save(
        ds.getRepository(Plan).create({
          studentId: student.id,
          planCatalogId: catalog.id,
          period: 'quarterly',
          weeklyFrequency: 2,
          startDate: '2026-01-01',
          endDate: soonEndDate,
          totalPrice: '450.00',
          installmentsCount: 1,
          status: 'active',
        }),
      );
      await ds.getRepository(Plan).save(
        ds.getRepository(Plan).create({
          studentId: student.id,
          planCatalogId: catalog.id,
          period: 'quarterly',
          weeklyFrequency: 2,
          startDate: '2026-01-01',
          endDate: farEndDate,
          totalPrice: '450.00',
          installmentsCount: 1,
          status: 'active',
        }),
      );

      const result = await service.findAll({ expiringInDays: 30 });
      expect(result.data.length).toBe(1);
      expect(result.data[0].endDate).toBe(soonEndDate);
    });

    it('excludes finished and cancelled plans from expiringInDays results', async () => {
      const soonEndDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');

      await ds.getRepository(Plan).save(
        ds.getRepository(Plan).create({
          studentId: student.id,
          planCatalogId: catalog.id,
          period: 'quarterly',
          weeklyFrequency: 2,
          startDate: '2026-01-01',
          endDate: soonEndDate,
          totalPrice: '450.00',
          installmentsCount: 1,
          status: 'finished',
        }),
      );
      await ds.getRepository(Plan).save(
        ds.getRepository(Plan).create({
          studentId: student.id,
          planCatalogId: catalog.id,
          period: 'quarterly',
          weeklyFrequency: 2,
          startDate: '2026-01-01',
          endDate: soonEndDate,
          totalPrice: '450.00',
          installmentsCount: 1,
          status: 'cancelled',
        }),
      );

      const result = await service.findAll({ expiringInDays: 30 });
      expect(result.data.length).toBe(0);
    });
  });

  describe('finish()', () => {
    it('sets plan status to finished', async () => {
      const dto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const created = await service.create(dto, mockUser);
      const planId = (created as any).id;

      const result = await service.finish(planId, mockUser);
      expect(result.status).toBe('finished');

      const [row] = await ds.query(`SELECT status FROM plan WHERE id = $1`, [planId]);
      expect(row.status).toBe('finished');
    });

    it('throws NotFoundException for unknown plan', async () => {
      await expect(service.finish('00000000-0000-0000-0000-000000000000', mockUser)).rejects.toThrow('not found');
    });

    it('throws BadRequestException when already finished', async () => {
      const dto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const created = await service.create(dto, mockUser);
      const planId = (created as any).id;
      await service.finish(planId, mockUser);

      await expect(service.finish(planId, mockUser)).rejects.toThrow('already finished');
    });

    it('throws BadRequestException when plan is cancelled', async () => {
      const dto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const created = await service.create(dto, mockUser);
      const planId = (created as any).id;
      await service.cancel(planId, { cancelFutureSessions: false }, mockUser);

      await expect(service.finish(planId, mockUser)).rejects.toThrow('already cancelled');
    });
  });

  describe('create() auto-finish', () => {
    it('finishes other active plans for the same student when creating a new plan', async () => {
      const firstDto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-06-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: INSTALLMENTS_3,
      };
      const first = await service.create(firstDto, mockUser);
      const firstId = (first as any).id;

      const secondDto: CreatePlanDto = {
        studentId: student.id,
        planCatalogId: catalog.id,
        startDate: '2026-09-01',
        totalPrice: '450.00',
        schedules: SCHEDULES_2X,
        installments: [
          { amount: '150.00', dueDate: '2026-09-10' },
          { amount: '150.00', dueDate: '2026-10-10' },
          { amount: '150.00', dueDate: '2026-11-10' },
        ],
      };
      const second = await service.create(secondDto, mockUser);
      expect((second as any).status).toBe('active');

      const [firstRow] = await ds.query(`SELECT status FROM plan WHERE id = $1`, [firstId]);
      expect(firstRow.status).toBe('finished');
    });
  });
});
