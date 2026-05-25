import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { addDays, addMonths, format, parseISO, subDays } from 'date-fns';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { PaymentMethod } from '@anna-maria/contracts';
import { EventService } from '../../event/event.service';
import { User } from '../../user/user.entity';
import { CapacityCheckerService } from '../scheduling/services/capacity-checker.service';
import { ReceivablePersistService } from '../scheduling/services/receivable-persist.service';
import { SessionGeneratorService } from '../scheduling/services/session-generator.service';
import { composeScheduledAt, iterateDatesMatchingWeekday, parseDateBR } from '../scheduling/utils/date.utils';
import { Student } from '../students/entities/student.entity';
import { PlanCatalog } from '../plan-catalog/entities/plan-catalog.entity';
import { Session } from '../sessions/entities/session.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Plan } from './entities/plan.entity';
import { PlanSchedule } from './entities/plan-schedule.entity';
import { CancelPlanDto } from './dto/cancel-plan.dto';
import { ChangeScheduleDto } from './dto/change-schedule.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ListPlansQuery } from './dto/list-plans.query';
import { RenewPlanDto } from './dto/renew-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly sessionGenerator: SessionGeneratorService,
    private readonly receivablePersist: ReceivablePersistService,
    private readonly capacityChecker: CapacityCheckerService,
    private readonly eventService: EventService,
  ) {}

  async create(dto: CreatePlanDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const student = await manager.findOne(Student, { where: { id: dto.studentId } });
      if (!student) throw new NotFoundException(`Student ${dto.studentId} not found`);
      if (!student.isActive) throw new UnprocessableEntityException('Aluno arquivado');

      const catalog = await manager.findOne(PlanCatalog, { where: { id: dto.planCatalogId } });
      if (!catalog) throw new NotFoundException(`PlanCatalog ${dto.planCatalogId} not found`);

      if (dto.schedules.length !== catalog.weeklyFrequency) {
        throw new UnprocessableEntityException(
          `Expected ${catalog.weeklyFrequency} schedules but got ${dto.schedules.length}`,
        );
      }

      const endDate = format(subDays(addMonths(parseISO(dto.startDate), catalog.durationMonths), 1), 'yyyy-MM-dd');
      const paymentMethod = derivePaymentMethod(dto.installments.map((i) => i.paymentMethod));

      const plan = await manager.save(
        manager.create(Plan, {
          studentId: dto.studentId,
          planCatalogId: dto.planCatalogId,
          period: catalog.period ?? 'monthly',
          weeklyFrequency: catalog.weeklyFrequency,
          startDate: dto.startDate,
          endDate,
          totalPrice: dto.totalPrice,
          paymentMethod,
          installmentsCount: dto.installments.length,
          status: 'active',
          notes: dto.notes ?? null,
        }),
      );

      const otherActivePlans = await manager
        .createQueryBuilder(Plan, 'p')
        .where('p.student_id = :studentId', { studentId: dto.studentId })
        .andWhere("p.status = 'active'")
        .andWhere('p.id != :newId', { newId: plan.id })
        .getMany();

      if (otherActivePlans.length > 0) {
        await manager
          .createQueryBuilder()
          .update(Plan)
          .set({ status: 'finished' })
          .where('id IN (:...ids)', { ids: otherActivePlans.map((p) => p.id) })
          .execute();
      }

      await manager.save(
        dto.schedules.map((s) => manager.create(PlanSchedule, { planId: plan.id, weekday: s.weekday, startTime: s.startTime })),
      );

      const sessions = await this.sessionGenerator.generate({ plan, schedules: dto.schedules, manager });

      const overCapacity = await this.capacityChecker.detectOverCapacity({
        scheduledAts: sessions.map((s) => s.scheduledAt),
        manager,
        ignoreSessionIds: sessions.map((s) => s.id),
      });

      const receivables = await this.receivablePersist.persistForPlan({
        plan,
        installments: dto.installments,
        manager,
        studentName: student.fullName,
        planName: catalog.name,
      });

      await this.eventService.record(manager, {
        action: 'plan.created',
        entity: 'plan',
        entityId: plan.id,
        userId: user.id,
        dto: { studentId: dto.studentId, planCatalogId: dto.planCatalogId, startDate: dto.startDate },
      });

      const response: Record<string, unknown> = {
        ...planToResponse(plan),
        schedules: dto.schedules,
        generated: { sessions: sessions.length, receivables: receivables.length },
      };

      if (overCapacity.length > 0) {
        response.warnings = {
          overCapacitySlots: overCapacity.map((w) => ({ scheduledAt: w.scheduledAt.toISOString(), occupied: w.occupied })),
        };
      }

      return response;
    });
  }

  async findAll(query: ListPlansQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.dataSource
      .getRepository(Plan)
      .createQueryBuilder('p')
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    if (query.studentId) {
      qb.andWhere('p.student_id = :studentId', { studentId: query.studentId });
    }

    if (query.expiringInDays !== undefined) {
      const cutoff = format(addDays(new Date(), query.expiringInDays), 'yyyy-MM-dd');
      qb.andWhere('p.end_date <= :cutoff', { cutoff });
      qb.andWhere("p.status = 'active'");
      qb.orderBy('p.end_date', 'ASC');
    }

    const [plans, total] = await qb.getManyAndCount();

    const studentIds = [...new Set(plans.map((p) => p.studentId))];
    const students = studentIds.length
      ? await this.dataSource.getRepository(Student).findByIds(studentIds)
      : [];
    const studentMap = new Map(students.map((s) => [s.id, s.fullName]));

    const data = plans.map((plan) => ({ ...plan, studentName: studentMap.get(plan.studentId) ?? '' }));
    return { data, total };
  }

  async findOne(id: string) {
    const plan = await this.dataSource.getRepository(Plan).findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);

    const [schedules, sessions, receivables] = await Promise.all([
      this.dataSource.getRepository(PlanSchedule).find({ where: { planId: id } }),
      this.dataSource.getRepository(Session).find({ where: { planId: id } }),
      this.dataSource.getRepository(Receivable).find({ where: { planId: id } }),
    ]);

    const sessionsByStatus = sessions.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      ...planToResponse(plan),
      schedules,
      receivables,
      summary: {
        totalSessions: sessions.length,
        sessionsByStatus,
        totalReceivables: receivables.length,
        paidReceivables: receivables.filter((r) => r.status === 'paid').length,
      },
    };
  }

  async updateBasics(id: string, dto: UpdatePlanDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(Plan, { where: { id } });
      if (!plan) throw new NotFoundException(`Plan ${id} not found`);

      if (dto.notes !== undefined) plan.notes = dto.notes;
      if (dto.status !== undefined) plan.status = dto.status;

      const saved = await manager.save(Plan, plan);

      await this.eventService.record(manager, {
        action: 'plan.updated',
        entity: 'plan',
        entityId: id,
        userId: user.id,
        dto: dto as Record<string, unknown>,
      });

      return planToResponse(saved);
    });
  }

  async changeSchedule(id: string, dto: ChangeScheduleDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(Plan, { where: { id } });
      if (!plan) throw new NotFoundException(`Plan ${id} not found`);
      if (plan.status === 'cancelled' || plan.status === 'finished') {
        throw new NotFoundException(`Plan ${id} is ${plan.status}`);
      }

      if (dto.schedules.length !== plan.weeklyFrequency) {
        throw new UnprocessableEntityException(
          `Expected ${plan.weeklyFrequency} schedules but got ${dto.schedules.length}`,
        );
      }

      await manager.delete(PlanSchedule, { planId: id });
      await manager.save(
        dto.schedules.map((s) => manager.create(PlanSchedule, { planId: id, weekday: s.weekday, startTime: s.startTime })),
      );

      const now = new Date();
      const result = await this.sessionGenerator.regenerateFuture({
        plan,
        newSchedules: dto.schedules,
        manager,
        now,
      });

      const futureSessions = await manager.find(Session, {
        where: { planId: id, status: 'scheduled', scheduledAt: MoreThanOrEqual(now) },
      });

      const overCapacity = await this.capacityChecker.detectOverCapacity({
        scheduledAts: futureSessions.map((s) => s.scheduledAt),
        manager,
        ignoreSessionIds: futureSessions.map((s) => s.id),
      });

      await this.eventService.record(manager, {
        action: 'plan.schedule_changed',
        entity: 'plan',
        entityId: id,
        userId: user.id,
        dto: { schedules: dto.schedules },
      });

      const response: Record<string, unknown> = {
        removedFutureSessions: result.removed,
        createdSessions: result.created,
      };

      if (overCapacity.length > 0) {
        response.warnings = {
          overCapacitySlots: overCapacity.map((w) => ({ scheduledAt: w.scheduledAt.toISOString(), occupied: w.occupied })),
        };
      }

      return response;
    });
  }

  async renew(id: string, dto: RenewPlanDto, user: User) {
    const currentPlan = await this.dataSource.getRepository(Plan).findOne({ where: { id } });
    if (!currentPlan) throw new NotFoundException(`Plan ${id} not found`);

    let schedules = dto.schedules;
    if (dto.keepSchedules) {
      const existing = await this.dataSource.getRepository(PlanSchedule).find({ where: { planId: id } });
      schedules = existing.map((s) => ({ weekday: s.weekday, startTime: s.startTime }));
    }

    if (!schedules || schedules.length === 0) {
      throw new UnprocessableEntityException('schedules is required when keepSchedules is false');
    }

    const createDto: CreatePlanDto = {
      studentId: currentPlan.studentId,
      planCatalogId: currentPlan.planCatalogId ?? '',
      startDate: dto.startDate,
      totalPrice: dto.totalPrice,
      schedules,
      installments: dto.installments,
      notes: dto.notes,
    };

    const result = await this.create(createDto, user);
    return { newPlanId: (result as any).id, generated: (result as any).generated, warnings: (result as any).warnings };
  }

  async cancel(id: string, dto: CancelPlanDto, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(Plan, { where: { id } });
      if (!plan) throw new NotFoundException(`Plan ${id} not found`);

      plan.status = 'cancelled';
      if (dto.reason) {
        plan.notes = plan.notes ? `${plan.notes}\n[Cancelamento] ${dto.reason}` : `[Cancelamento] ${dto.reason}`;
      }
      await manager.save(plan);

      let cancelledFutureSessions = 0;
      if (dto.cancelFutureSessions) {
        const now = new Date();
        const result = await manager
          .createQueryBuilder()
          .update(Session)
          .set({ status: 'cancelled' })
          .where('plan_id = :id', { id })
          .andWhere('scheduled_at >= :now', { now })
          .andWhere("status = 'scheduled'")
          .execute();
        cancelledFutureSessions = result.affected ?? 0;
      }

      const pendingReceivables = await manager.find(Receivable, {
        where: { planId: id, status: 'pending' },
      });

      await this.eventService.record(manager, {
        action: 'plan.cancelled',
        entity: 'plan',
        entityId: id,
        userId: user.id,
        dto: { reason: dto.reason ?? null, cancelFutureSessions: dto.cancelFutureSessions },
      });

      return { cancelledFutureSessions, pendingReceivables };
    });
  }

  async finish(id: string, user: User) {
    return this.dataSource.transaction(async (manager) => {
      const plan = await manager.findOne(Plan, { where: { id } });
      if (!plan) throw new NotFoundException(`Plan ${id} not found`);
      if (plan.status === 'finished' || plan.status === 'cancelled') {
        throw new BadRequestException(`Plan is already ${plan.status}`);
      }

      plan.status = 'finished';
      await manager.save(plan);

      await this.eventService.record(manager, {
        action: 'plan.finished',
        entity: 'plan',
        entityId: id,
        userId: user.id,
        dto: {},
      });

      return planToResponse(plan);
    });
  }

  async checkCapacity(weekday: number, startTime: string, from: string, to: string) {
    const dates = iterateDatesMatchingWeekday(parseDateBR(from), parseDateBR(to), weekday);
    const manager = this.dataSource.manager;

    const slots = await Promise.all(
      dates.map(async (date) => {
        const scheduledAt = composeScheduledAt(date, startTime);
        const { occupied, isOverCapacity } = await this.capacityChecker.countSlot({ scheduledAt, manager });
        return { scheduledAt: scheduledAt.toISOString(), occupied, isOverCapacity };
      }),
    );

    return { slots };
  }
}

function planToResponse(plan: Plan) {
  return {
    id: plan.id,
    studentId: plan.studentId,
    planCatalogId: plan.planCatalogId,
    period: plan.period,
    weeklyFrequency: plan.weeklyFrequency,
    startDate: plan.startDate,
    endDate: plan.endDate,
    totalPrice: plan.totalPrice,
    paymentMethod: plan.paymentMethod,
    installmentsCount: plan.installmentsCount,
    status: plan.status,
    notes: plan.notes,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

function derivePaymentMethod(methods: (PaymentMethod | undefined)[]): PaymentMethod | null {
  const defined = methods.filter((m): m is PaymentMethod => m !== undefined);
  if (defined.length === 0) return null;
  const counts = new Map<PaymentMethod, number>();
  for (const m of defined) counts.set(m, (counts.get(m) ?? 0) + 1);
  let best: PaymentMethod | null = null;
  let bestCount = 0;
  for (const [m, count] of counts) {
    if (count > bestCount) { best = m; bestCount = count; }
  }
  const allSame = counts.size === 1;
  return allSame ? best : null;
}
