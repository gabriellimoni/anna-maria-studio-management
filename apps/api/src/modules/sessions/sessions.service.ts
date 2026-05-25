import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';
import { DataSource } from 'typeorm';
import type {
  CalendarResponse,
  CalendarSlot,
  ListSessionsResponse,
  Session as SessionContract,
  SessionOrigin,
  SessionStatus,
} from '@anna-maria/contracts';
import { EventService } from '../../event/event.service';
import { User } from '../../user/user.entity';
import { Student } from '../students/entities/student.entity';
import { DropInClass } from '../drop-ins/entities/drop-in-class.entity';
import { parseDateBR } from '../scheduling/utils/date.utils';
import { Session } from './entities/session.entity';
import { CalendarQuery } from './dto/calendar.query';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { ListSessionsQuery } from './dto/list-sessions.query';
import { UpdateSessionDto } from './dto/update-session.dto';

const TZ = 'America/Sao_Paulo';

interface RawSession {
  id: string;
  plan_id: string | null;
  student_id: string;
  scheduled_at: Date | string;
  status: SessionStatus;
  origin: SessionOrigin;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  studentName: string | null;
  prospectName: string | null;
}

function mapRaw(row: RawSession): SessionContract {
  return {
    id: row.id,
    planId: row.plan_id,
    studentId: row.student_id,
    studentName: row.studentName ?? row.prospectName ?? '',
    scheduledAt: new Date(row.scheduled_at).toISOString(),
    status: row.status,
    origin: row.origin,
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventService: EventService,
  ) {}

  private buildBaseQuery(opts: {
    from?: Date;
    to?: Date;
    studentId?: string;
    planId?: string;
    status?: string;
    skip?: number;
    take?: number;
  }) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('s.*')
      .addSelect('st.full_name', 'studentName')
      .addSelect('di.prospect_name', 'prospectName')
      .from(Session, 's')
      .leftJoin(Student, 'st', 'st.id = s.student_id')
      .leftJoin(DropInClass, 'di', 'di.session_id = s.id')
      .orderBy('s.scheduled_at', 'ASC');

    if (opts.from) qb.andWhere('s.scheduled_at >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('s.scheduled_at < :to', { to: opts.to });
    if (opts.studentId) qb.andWhere('s.student_id = :studentId', { studentId: opts.studentId });
    if (opts.planId) qb.andWhere('s.plan_id = :planId', { planId: opts.planId });
    if (opts.status) qb.andWhere('s.status = :status', { status: opts.status });

    return qb;
  }

  private resolveDateRange(query: ListSessionsQuery): { from?: Date; to?: Date } {
    if (query.date) {
      const from = parseDateBR(query.date);
      const to = parseDateBR(format(addDays(parseISO(query.date), 1), 'yyyy-MM-dd', { timeZone: TZ }));
      return { from, to };
    }
    return {
      from: query.from ? parseDateBR(query.from) : undefined,
      to: query.to ? parseDateBR(format(addDays(parseISO(query.to), 1), 'yyyy-MM-dd', { timeZone: TZ })) : undefined,
    };
  }

  async findAll(query: ListSessionsQuery): Promise<ListSessionsResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const { from, to } = this.resolveDateRange(query);

    const qb = this.buildBaseQuery({ from, to, studentId: query.studentId, planId: query.planId, status: query.status });

    const total = await qb.getCount();
    const rows: RawSession[] = await qb.skip((page - 1) * pageSize).take(pageSize).getRawMany();

    return { data: rows.map(mapRaw), total };
  }

  async getCalendar(query: CalendarQuery): Promise<CalendarResponse> {
    const diff = differenceInCalendarDays(parseISO(query.to), parseISO(query.from));
    if (diff > 31) {
      throw new UnprocessableEntityException('Window max 31 days');
    }

    const from = parseDateBR(query.from);
    const to = parseDateBR(format(addDays(parseISO(query.to), 1), 'yyyy-MM-dd', { timeZone: TZ }));

    const qb = this.buildBaseQuery({ from, to });
    const rows: RawSession[] = await qb.getRawMany();

    const slotMap = new Map<string, CalendarSlot>();

    for (const row of rows) {
      const zoned = toZonedTime(new Date(row.scheduled_at), TZ);
      const date = format(zoned, 'yyyy-MM-dd', { timeZone: TZ });
      const startTime = format(zoned, 'HH:mm', { timeZone: TZ });
      const key = `${date}|${startTime}`;

      if (!slotMap.has(key)) {
        slotMap.set(key, { date, startTime, capacity: 4, occupied: 0, isOverCapacity: false, sessions: [] });
      }

      const slot = slotMap.get(key)!;
      slot.sessions.push(mapRaw(row));
      if (row.status !== 'cancelled') slot.occupied++;
    }

    for (const slot of slotMap.values()) {
      slot.isOverCapacity = slot.occupied > 4;
    }

    const slots = [...slotMap.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    );

    return { slots };
  }

  async findOne(id: string): Promise<SessionContract> {
    const qb = this.buildBaseQuery({});
    qb.andWhere('s.id = :id', { id });
    const rows: RawSession[] = await qb.getRawMany();
    if (!rows.length) throw new NotFoundException(`Session ${id} not found`);
    return mapRaw(rows[0]);
  }

  async updateSession(id: string, dto: UpdateSessionDto, user: User): Promise<SessionContract> {
    return this.dataSource.transaction(async (manager) => {
      const session = await manager.findOne(Session, { where: { id } });
      if (!session) throw new NotFoundException(`Session ${id} not found`);

      if ((dto as { status?: string }).status === 'cancelled') {
        throw new UnprocessableEntityException('Use POST /sessions/:id/cancel to cancel a session');
      }

      if (dto.status !== undefined) session.status = dto.status as SessionStatus;
      if (dto.notes !== undefined) session.notes = dto.notes;

      await manager.save(Session, session);

      await this.eventService.record(manager, {
        action: 'session.updated',
        entity: 'session',
        entityId: id,
        userId: user.id,
        dto: dto as Record<string, unknown>,
      });

      return this.findOne(id);
    });
  }

  async closeOpenPastSessions(cutoff: Date): Promise<{ updated: number }> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(Session)
      .set({ status: 'present' as SessionStatus })
      .where('status = :status', { status: 'scheduled' })
      .andWhere('scheduled_at < :cutoff', { cutoff })
      .execute();

    return { updated: result.affected ?? 0 };
  }

  async cancelSession(id: string, dto: CancelSessionDto, user: User): Promise<SessionContract> {
    return this.dataSource.transaction(async (manager) => {
      const session = await manager.findOne(Session, { where: { id } });
      if (!session) throw new NotFoundException(`Session ${id} not found`);
      if (session.status === 'cancelled') {
        throw new UnprocessableEntityException('Already cancelled');
      }

      session.status = 'cancelled';
      if (dto.reason) {
        session.notes = session.notes
          ? `${session.notes}\n[Cancelamento] ${dto.reason}`
          : `[Cancelamento] ${dto.reason}`;
      }

      await manager.save(Session, session);

      await this.eventService.record(manager, {
        action: 'session.cancelled',
        entity: 'session',
        entityId: id,
        userId: user.id,
        dto: { reason: dto.reason ?? null },
      });

      return this.findOne(id);
    });
  }
}
