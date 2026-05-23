import { Injectable } from '@nestjs/common';
import { EntityManager, MoreThanOrEqual } from 'typeorm';
import { Plan } from '../../plans/entities/plan.entity';
import { Session } from '../../sessions/entities/session.entity';
import { composeScheduledAt, iterateDatesMatchingWeekday, parseDateBR } from '../utils/date.utils';

export type ScheduleSpec = { weekday: number; startTime: string };

@Injectable()
export class SessionGeneratorService {
  /**
   * Materializes all sessions for a plan across its full date range.
   * All scheduledAt values are computed in America/Sao_Paulo and stored as UTC timestamptz.
   */
  async generate(input: { plan: Plan; schedules: ScheduleSpec[]; manager: EntityManager }): Promise<Session[]> {
    const { plan, schedules, manager } = input;
    const from = parseDateBR(plan.startDate);
    const to = parseDateBR(plan.endDate);

    const sessions: Partial<Session>[] = [];
    for (const spec of schedules) {
      const dates = iterateDatesMatchingWeekday(from, to, spec.weekday);
      for (const date of dates) {
        sessions.push({
          planId: plan.id,
          studentId: plan.studentId,
          scheduledAt: composeScheduledAt(date, spec.startTime),
          status: 'scheduled',
          origin: 'plan',
        });
      }
    }

    if (sessions.length === 0) return [];
    return manager.save(Session, sessions as Session[]);
  }

  /**
   * Deletes only future 'scheduled' sessions for the plan and regenerates from now forward.
   * Sessions already in a terminal state (present, cancelled, absence_*) are preserved.
   */
  async regenerateFuture(input: {
    plan: Plan;
    newSchedules: ScheduleSpec[];
    manager: EntityManager;
    now: Date;
  }): Promise<{ removed: number; created: number }> {
    const { plan, newSchedules, manager, now } = input;

    const deleteResult = await manager.delete(Session, {
      planId: plan.id,
      scheduledAt: MoreThanOrEqual(now),
      status: 'scheduled',
    });
    const removed = deleteResult.affected ?? 0;

    const from = now > parseDateBR(plan.startDate) ? now : parseDateBR(plan.startDate);
    const to = parseDateBR(plan.endDate);

    if (from > to) return { removed, created: 0 };

    const sessions: Partial<Session>[] = [];
    for (const spec of newSchedules) {
      const dates = iterateDatesMatchingWeekday(from, to, spec.weekday);
      for (const date of dates) {
        if (date >= now) {
          sessions.push({
            planId: plan.id,
            studentId: plan.studentId,
            scheduledAt: composeScheduledAt(date, spec.startTime),
            status: 'scheduled',
            origin: 'plan',
          });
        }
      }
    }

    if (sessions.length > 0) {
      await manager.save(Session, sessions as Session[]);
    }
    return { removed, created: sessions.length };
  }
}
