import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginatedReceivables, Receivable as ReceivableContract } from '@anna-maria/contracts';
import { Receivable } from './entities/receivable.entity';
import { Plan } from '../plans/entities/plan.entity';
import { Student } from '../students/entities/student.entity';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { UpdateReceivableDto } from './dto/update-receivable.dto';
import { PayReceivableDto } from './dto/pay-receivable.dto';
import { ListReceivablesQuery } from './dto/list-receivables.query';

function toContract(r: Receivable & { studentName?: string; planPeriod?: string; planWeeklyFrequency?: number }): ReceivableContract {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: r.id,
    planId: r.planId,
    source: r.source,
    description: r.description,
    studentName: r.studentName ?? null,
    planPeriod: r.planPeriod ?? null,
    planWeeklyFrequency: r.planWeeklyFrequency ?? null,
    amount: r.amount,
    dueDate: r.dueDate,
    installmentNumber: r.installmentNumber,
    installmentTotal: r.installmentTotal,
    paymentMethod: r.paymentMethod,
    status: r.status,
    paidAt: r.paidAt,
    invoiceGenerated: r.invoiceGenerated,
    isOverdue: r.status === 'pending' && r.dueDate < today,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

@Injectable()
export class ReceivablesService {
  constructor(
    @InjectRepository(Receivable)
    private readonly repo: Repository<Receivable>,
  ) {}

  async findAll(query: ListReceivablesQuery): Promise<PaginatedReceivables> {
    const { status, from, to, planId, source, invoiceGenerated, page = 1, pageSize = 20 } = query;

    const applyWhere = (qb: ReturnType<typeof this.repo.createQueryBuilder>) => {
      if (status === 'overdue') {
        qb.andWhere("r.status = 'pending'").andWhere('r.due_date < CURRENT_DATE');
      } else if (status) {
        qb.andWhere('r.status = :status', { status });
      }
      if (from) qb.andWhere('r.due_date >= :from', { from });
      if (to) qb.andWhere('r.due_date <= :to', { to });
      if (planId) qb.andWhere('r.plan_id = :planId', { planId });
      if (source) qb.andWhere('r.source = :source', { source });
      if (invoiceGenerated !== undefined) qb.andWhere('r.invoice_generated = :invoiceGenerated', { invoiceGenerated });
    };

    const countQb = this.repo.createQueryBuilder('r');
    applyWhere(countQb);
    const total = await countQb.getCount();

    const sumQb = this.repo.createQueryBuilder('r').select('COALESCE(SUM(r.amount), 0)', 'totalAmount');
    applyWhere(sumQb);
    const sumResult = await sumQb.getRawOne<{ totalAmount: string }>();
    const totalAmount = sumResult?.totalAmount ?? '0';

    const today = new Date().toISOString().slice(0, 10);

    const dataQb = this.repo
      .createQueryBuilder('r')
      .leftJoin(Plan, 'p', 'p.id = r.plan_id')
      .leftJoin(Student, 's', 's.id = p.student_id')
      .addSelect('s.full_name', 'studentName')
      .addSelect('p.period', 'planPeriod')
      .addSelect('p.weekly_frequency', 'planWeeklyFrequency')
      .orderBy('r.due_date', 'ASC');

    applyWhere(dataQb);
    dataQb.skip((page - 1) * pageSize).take(pageSize);

    const rows = await dataQb.getRawMany();
    const data: ReceivableContract[] = rows.map((raw) => ({
      id: raw.r_id,
      planId: raw.r_plan_id ?? null,
      source: raw.r_source,
      description: raw.r_description,
      studentName: raw.studentName ?? null,
      planPeriod: raw.planPeriod ?? null,
      planWeeklyFrequency: raw.planWeeklyFrequency != null ? Number(raw.planWeeklyFrequency) : null,
      amount: raw.r_amount,
      dueDate: raw.r_due_date,
      installmentNumber: raw.r_installment_number ?? null,
      installmentTotal: raw.r_installment_total ?? null,
      paymentMethod: raw.r_payment_method ?? null,
      status: raw.r_status,
      paidAt: raw.r_paid_at ?? null,
      invoiceGenerated: raw.r_invoice_generated ?? false,
      isOverdue: raw.r_status === 'pending' && raw.r_due_date < today,
      createdAt: raw.r_created_at instanceof Date ? raw.r_created_at.toISOString() : String(raw.r_created_at),
      updatedAt: raw.r_updated_at instanceof Date ? raw.r_updated_at.toISOString() : String(raw.r_updated_at),
    }));

    return { data, total, totalAmount };
  }

  async findOne(id: string): Promise<ReceivableContract> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Receivable ${id} not found`);
    return toContract(r);
  }

  async createManual(dto: CreateReceivableDto): Promise<ReceivableContract> {
    const r = this.repo.create({
      source: 'manual',
      planId: null,
      installmentNumber: null,
      installmentTotal: null,
      status: 'pending',
      description: dto.description,
      amount: dto.amount,
      dueDate: dto.dueDate,
      paymentMethod: dto.paymentMethod ?? null,
    });
    await this.repo.save(r);
    return toContract(r);
  }

  async update(id: string, dto: UpdateReceivableDto): Promise<ReceivableContract> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Receivable ${id} not found`);

    if (dto.description !== undefined) r.description = dto.description;
    if (dto.amount !== undefined) r.amount = dto.amount;
    if (dto.dueDate !== undefined) r.dueDate = dto.dueDate;
    if (dto.paymentMethod !== undefined) r.paymentMethod = dto.paymentMethod;

    await this.repo.save(r);
    return toContract(r);
  }

  async pay(id: string, dto: PayReceivableDto): Promise<ReceivableContract> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Receivable ${id} not found`);
    if (r.status === 'paid') throw new ConflictException('Receivable is already paid');

    r.status = 'paid';
    r.paidAt = dto.paidAt;
    r.paymentMethod = dto.paymentMethod;
    await this.repo.save(r);
    return toContract(r);
  }

  async unpay(id: string): Promise<ReceivableContract> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Receivable ${id} not found`);
    if (r.status === 'pending') throw new ConflictException('Receivable is already pending');

    r.status = 'pending';
    r.paidAt = null;
    await this.repo.save(r);
    return toContract(r);
  }

  async markInvoiced(id: string): Promise<ReceivableContract> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Receivable ${id} not found`);
    if (r.invoiceGenerated) throw new ConflictException('Invoice already marked as generated');

    r.invoiceGenerated = true;
    await this.repo.save(r);
    return toContract(r);
  }

  async unmarkInvoiced(id: string): Promise<ReceivableContract> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`Receivable ${id} not found`);
    if (!r.invoiceGenerated) throw new ConflictException('Invoice is not marked as generated');

    r.invoiceGenerated = false;
    await this.repo.save(r);
    return toContract(r);
  }
}
