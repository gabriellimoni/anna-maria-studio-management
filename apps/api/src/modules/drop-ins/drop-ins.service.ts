import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { parseISO } from 'date-fns';
import { DataSource } from 'typeorm';
import type {
  CreateDropInResponse,
  DeleteDropInResponse,
  DropInClass as DropInClassContract,
  LancamentoStatus,
  ListDropInsQuery,
  SessionStatus,
} from '@anna-maria/contracts';
import { Student } from '../students/entities/student.entity';
import { Session } from '../sessions/entities/session.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { CapacityCheckerService } from '../scheduling/services/capacity-checker.service';
import { DropInClass } from './entities/drop-in-class.entity';
import { CreateDropInDto } from './dto/create-drop-in.dto';
import { UpdateDropInDto } from './dto/update-drop-in.dto';

interface RawDropIn {
  id: string;
  session_id: string;
  student_id: string | null;
  prospect_name: string | null;
  receivable_id: string | null;
  scheduled_at: Date | string;
  session_status: SessionStatus;
  student_name: string | null;
  charge_status: LancamentoStatus | null;
}

function mapRaw(row: RawDropIn): DropInClassContract {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    prospectName: row.prospect_name,
    receivableId: row.receivable_id,
    scheduledAt: new Date(row.scheduled_at).toISOString(),
    sessionStatus: row.session_status,
    studentName: row.student_name,
    chargeStatus: row.charge_status,
  };
}

@Injectable()
export class DropInsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly capacityChecker: CapacityCheckerService,
  ) {}

  private buildBaseQb() {
    return this.dataSource
      .createQueryBuilder()
      .select('di.*')
      .addSelect('s.scheduled_at', 'scheduled_at')
      .addSelect('s.status', 'session_status')
      .addSelect('st.full_name', 'student_name')
      .addSelect('r.status', 'charge_status')
      .from(DropInClass, 'di')
      .innerJoin(Session, 's', 's.id = di.session_id')
      .leftJoin(Student, 'st', 'st.id = di.student_id')
      .leftJoin(Receivable, 'r', 'r.id = di.receivable_id')
      .orderBy('s.scheduled_at', 'DESC');
  }

  async create(dto: CreateDropInDto): Promise<CreateDropInResponse> {
    const hasBoth = !!dto.studentId && !!dto.prospectName;
    const hasNeither = !dto.studentId && !dto.prospectName;
    if (hasBoth || hasNeither) {
      throw new UnprocessableEntityException('Exactly one of studentId or prospectName must be provided');
    }

    return this.dataSource.transaction(async (manager) => {
      let student: Student | null = null;
      if (dto.studentId) {
        student = await manager.findOne(Student, { where: { id: dto.studentId, isActive: true } });
        if (!student) throw new NotFoundException(`Student ${dto.studentId} not found or inactive`);
      }

      const scheduledAt = parseISO(dto.scheduledAt);
      const capacity = await this.capacityChecker.countSlot({ scheduledAt, manager });

      const session = await manager.save(Session, {
        studentId: student?.id ?? null,
        planId: null,
        scheduledAt,
        status: 'scheduled' as const,
        origin: 'drop_in' as const,
        notes: dto.notes ?? null,
      });

      let receivable: Receivable | null = null;
      if (dto.charge) {
        if (dto.charge.status === 'paid' && !dto.charge.paidAt) {
          throw new UnprocessableEntityException('paidAt is required when status is paid');
        }
        receivable = await manager.save(Receivable, {
          planId: null,
          source: 'drop_in' as const,
          description: `Aula avulsa — ${student?.fullName ?? dto.prospectName}`,
          amount: dto.charge.amount,
          dueDate: dto.charge.dueDate,
          paymentMethod: dto.charge.paymentMethod ?? null,
          status: dto.charge.status ?? 'pending',
          paidAt: dto.charge.paidAt ?? null,
          installmentNumber: null,
          installmentTotal: null,
        });
      }

      const dropIn = await manager.save(DropInClass, {
        sessionId: session.id,
        studentId: student?.id ?? null,
        prospectName: dto.prospectName ?? null,
        receivableId: receivable?.id ?? null,
      });

      return {
        id: dropIn.id,
        sessionId: session.id,
        receivableId: receivable?.id ?? null,
        ...(capacity.isOverCapacity && {
          warnings: { overCapacity: true, occupied: capacity.occupied },
        }),
      };
    });
  }

  async findAll(query: ListDropInsQuery): Promise<DropInClassContract[]> {
    const qb = this.buildBaseQb();

    if (query.from) qb.andWhere('s.scheduled_at >= :from', { from: parseISO(query.from) });
    if (query.to) {
      const toDate = parseISO(query.to);
      toDate.setDate(toDate.getDate() + 1);
      qb.andWhere('s.scheduled_at < :to', { to: toDate });
    }
    if (query.studentId) qb.andWhere('di.student_id = :studentId', { studentId: query.studentId });
    if (query.hasCharge === true) qb.andWhere('di.receivable_id IS NOT NULL');
    if (query.hasCharge === false) qb.andWhere('di.receivable_id IS NULL');

    const rows: RawDropIn[] = await qb.getRawMany();
    return rows.map(mapRaw);
  }

  async findOne(id: string): Promise<DropInClassContract> {
    const qb = this.buildBaseQb().andWhere('di.id = :id', { id });
    const rows: RawDropIn[] = await qb.getRawMany();
    if (!rows.length) throw new NotFoundException(`DropIn ${id} not found`);
    return mapRaw(rows[0]);
  }

  async update(id: string, dto: UpdateDropInDto): Promise<DropInClassContract> {
    const dropIn = await this.dataSource.getRepository(DropInClass).findOneBy({ id });
    if (!dropIn) throw new NotFoundException(`DropIn ${id} not found`);

    if (dto.prospectName !== undefined) dropIn.prospectName = dto.prospectName;
    await this.dataSource.getRepository(DropInClass).save(dropIn);

    if (dto.notes !== undefined && dropIn.sessionId) {
      const session = await this.dataSource.getRepository(Session).findOneBy({ id: dropIn.sessionId });
      if (session) {
        session.notes = dto.notes;
        await this.dataSource.getRepository(Session).save(session);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<DeleteDropInResponse> {
    const dropIn = await this.dataSource.getRepository(DropInClass).findOneBy({ id });
    if (!dropIn) throw new NotFoundException(`DropIn ${id} not found`);

    const sessionId = dropIn.sessionId!;

    return this.dataSource.transaction(async (manager) => {
      const session = await manager.findOne(Session, { where: { id: sessionId } });
      if (session && session.status !== 'cancelled') {
        session.status = 'cancelled' as const;
        await manager.save(Session, session);
      }

      await manager.delete(DropInClass, { id });

      let pendingReceivableId: string | undefined;
      if (dropIn.receivableId) {
        const receivable = await manager.findOne(Receivable, { where: { id: dropIn.receivableId } });
        if (receivable?.status === 'pending') {
          pendingReceivableId = receivable.id;
        }
      }

      return { sessionId, ...(pendingReceivableId && { pendingReceivableId }) };
    });
  }
}
