import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { PaginatedPayables, Payable as PayableContract } from '@anna-maria/contracts';
import { EventService } from '../../event/event.service';
import { User } from '../../user/user.entity';
import { Payable } from './entities/payable.entity';
import { CreatePayableDto } from './dto/create-payable.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { PayPayableDto } from './dto/pay-payable.dto';
import { ListPayablesQuery } from './dto/list-payables.query';

function toContract(p: Payable): PayableContract {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: p.id,
    recurringExpenseId: p.recurringExpenseId,
    source: p.source,
    description: p.description,
    category: p.category,
    amount: p.amount,
    dueDate: p.dueDate,
    competenceMonth: p.competenceMonth,
    paymentMethod: p.paymentMethod,
    status: p.status,
    paidAt: p.paidAt,
    isOverdue: p.status === 'pending' && p.dueDate < today,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
  };
}

@Injectable()
export class PayablesService {
  constructor(
    @InjectRepository(Payable)
    private readonly repo: Repository<Payable>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventService: EventService,
  ) {}

  async findAll(query: ListPayablesQuery): Promise<PaginatedPayables> {
    const { status, from, to, recurringExpenseId, source, competenceMonth, page = 1, pageSize = 20 } = query;

    const applyWhere = (qb: ReturnType<typeof this.repo.createQueryBuilder>) => {
      if (status === 'overdue') {
        qb.andWhere("p.status = 'pending'").andWhere('p.due_date < CURRENT_DATE');
      } else if (status) {
        qb.andWhere('p.status = :status', { status });
      }
      if (from) qb.andWhere('p.due_date >= :from', { from });
      if (to) qb.andWhere('p.due_date <= :to', { to });
      if (recurringExpenseId) qb.andWhere('p.recurring_expense_id = :recurringExpenseId', { recurringExpenseId });
      if (source) qb.andWhere('p.source = :source', { source });
      if (competenceMonth) {
        const firstDay = `${competenceMonth}-01`;
        qb.andWhere('p.competence_month = :firstDay', { firstDay });
      }
    };

    const countQb = this.repo.createQueryBuilder('p');
    applyWhere(countQb);
    const total = await countQb.getCount();

    const sumQb = this.repo.createQueryBuilder('p').select('COALESCE(SUM(p.amount), 0)', 'totalAmount');
    applyWhere(sumQb);
    const sumResult = await sumQb.getRawOne<{ totalAmount: string }>();
    const totalAmount = sumResult?.totalAmount ?? '0';

    const qb = this.repo.createQueryBuilder('p').orderBy('p.due_date', 'ASC');
    applyWhere(qb);
    qb.skip((page - 1) * pageSize).take(pageSize);

    const data = await qb.getMany();
    return { data: data.map(toContract), total, totalAmount };
  }

  async findOne(id: string): Promise<PayableContract> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Payable ${id} not found`);
    return toContract(p);
  }

  async createManual(dto: CreatePayableDto, user: User): Promise<PayableContract> {
    return this.dataSource.transaction(async (manager) => {
      const p = manager.create(Payable, {
        source: 'manual',
        recurringExpenseId: null,
        competenceMonth: null,
        status: 'pending',
        description: dto.description,
        category: dto.category ?? null,
        amount: dto.amount,
        dueDate: dto.dueDate,
        paymentMethod: dto.paymentMethod ?? null,
      });
      await manager.save(Payable, p);
      await this.eventService.record(manager, {
        action: 'payable.created',
        entity: 'payable',
        entityId: p.id,
        userId: user.id,
        dto: { description: dto.description, amount: dto.amount, dueDate: dto.dueDate },
      });
      return toContract(p);
    });
  }

  async update(id: string, dto: UpdatePayableDto, user: User): Promise<PayableContract> {
    return this.dataSource.transaction(async (manager) => {
      const p = await manager.findOne(Payable, { where: { id } });
      if (!p) throw new NotFoundException(`Payable ${id} not found`);

      if (dto.description !== undefined) p.description = dto.description;
      if (dto.category !== undefined) p.category = dto.category;
      if (dto.amount !== undefined) p.amount = dto.amount;
      if (dto.dueDate !== undefined) p.dueDate = dto.dueDate;
      if (dto.paymentMethod !== undefined) p.paymentMethod = dto.paymentMethod;

      await manager.save(Payable, p);
      await this.eventService.record(manager, {
        action: 'payable.updated',
        entity: 'payable',
        entityId: id,
        userId: user.id,
        dto: dto as Record<string, unknown>,
      });
      return toContract(p);
    });
  }

  async pay(id: string, dto: PayPayableDto, user: User): Promise<PayableContract> {
    return this.dataSource.transaction(async (manager) => {
      const p = await manager.findOne(Payable, { where: { id } });
      if (!p) throw new NotFoundException(`Payable ${id} not found`);
      if (p.status === 'paid') throw new ConflictException('Payable is already paid');

      p.status = 'paid';
      p.paidAt = dto.paidAt;
      p.paymentMethod = dto.paymentMethod;
      await manager.save(Payable, p);
      await this.eventService.record(manager, {
        action: 'payable.paid',
        entity: 'payable',
        entityId: id,
        userId: user.id,
        dto: { paidAt: dto.paidAt, paymentMethod: dto.paymentMethod },
      });
      return toContract(p);
    });
  }

  async unpay(id: string, user: User): Promise<PayableContract> {
    return this.dataSource.transaction(async (manager) => {
      const p = await manager.findOne(Payable, { where: { id } });
      if (!p) throw new NotFoundException(`Payable ${id} not found`);
      if (p.status === 'pending') throw new ConflictException('Payable is already pending');

      p.status = 'pending';
      p.paidAt = null;
      await manager.save(Payable, p);
      await this.eventService.record(manager, {
        action: 'payable.unpaid',
        entity: 'payable',
        entityId: id,
        userId: user.id,
        dto: {},
      });
      return toContract(p);
    });
  }
}
