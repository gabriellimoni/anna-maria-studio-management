import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type {
  PaginatedRecurringExpenses,
  RecurringExpense as RecurringExpenseContract,
  RunGenerationResult,
} from '@anna-maria/contracts';
import { EventService } from '../../event/event.service';
import { User } from '../../user/user.entity';
import { PayableGeneratorService } from '../scheduling/services/payable-generator.service';
import { RecurringExpense } from './entities/recurring-expense.entity';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';
import { ListRecurringExpensesQuery } from './dto/list-recurring-expenses.query';

function toContract(r: RecurringExpense): RecurringExpenseContract {
  return {
    id: r.id,
    description: r.description,
    category: r.category,
    expectedAmount: r.expectedAmount,
    dueDay: r.dueDay,
    isActive: r.isActive,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

@Injectable()
export class RecurringExpensesService {
  constructor(
    @InjectRepository(RecurringExpense)
    private readonly repo: Repository<RecurringExpense>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly payableGenerator: PayableGeneratorService,
    private readonly eventService: EventService,
  ) {}

  async findAll(query: ListRecurringExpensesQuery): Promise<PaginatedRecurringExpenses> {
    const { isActive, page = 1, pageSize = 20 } = query;
    const qb = this.repo.createQueryBuilder('r').orderBy('r.created_at', 'DESC');

    if (isActive !== undefined) {
      qb.andWhere('r.is_active = :isActive', { isActive });
    }

    qb.skip((page - 1) * pageSize).take(pageSize);
    const [data, total] = await qb.getManyAndCount();
    return { data: data.map(toContract), total };
  }

  async findOne(id: string): Promise<RecurringExpenseContract> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`RecurringExpense ${id} not found`);
    return toContract(r);
  }

  async create(dto: CreateRecurringExpenseDto, user: User): Promise<RecurringExpenseContract> {
    return this.dataSource.transaction(async (manager) => {
      const r = manager.create(RecurringExpense, { ...dto, isActive: true });
      const saved = await manager.save(RecurringExpense, r);
      await this.eventService.record(manager, {
        action: 'recurring_expense.created',
        entity: 'recurring_expense',
        entityId: saved.id,
        userId: user.id,
        dto: { description: dto.description, expectedAmount: dto.expectedAmount, dueDay: dto.dueDay },
      });
      return toContract(saved);
    });
  }

  async update(id: string, dto: UpdateRecurringExpenseDto, user: User): Promise<RecurringExpenseContract> {
    return this.dataSource.transaction(async (manager) => {
      const r = await manager.findOne(RecurringExpense, { where: { id } });
      if (!r) throw new NotFoundException(`RecurringExpense ${id} not found`);

      if (dto.description !== undefined) r.description = dto.description;
      if (dto.category !== undefined) r.category = dto.category;
      if (dto.expectedAmount !== undefined) r.expectedAmount = dto.expectedAmount;
      if (dto.dueDay !== undefined) r.dueDay = dto.dueDay;
      if (dto.isActive !== undefined) r.isActive = dto.isActive;

      const saved = await manager.save(RecurringExpense, r);
      await this.eventService.record(manager, {
        action: 'recurring_expense.updated',
        entity: 'recurring_expense',
        entityId: id,
        userId: user.id,
        dto: dto as Record<string, unknown>,
      });
      return toContract(saved);
    });
  }

  async remove(id: string, user: User): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const r = await manager.findOne(RecurringExpense, { where: { id } });
      if (!r) throw new NotFoundException(`RecurringExpense ${id} not found`);
      await manager.delete(RecurringExpense, { id });
      await this.eventService.record(manager, {
        action: 'recurring_expense.deleted',
        entity: 'recurring_expense',
        entityId: id,
        userId: user.id,
        dto: {},
      });
    });
  }

  async runForMonth(competenceMonth: Date): Promise<RunGenerationResult> {
    const activeRules = await this.repo.find({ where: { isActive: true } });
    const result: RunGenerationResult = { created: 0, skipped: 0, errors: [] };

    for (const rule of activeRules) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const gen = await this.payableGenerator.generateForMonth({ rule, competenceMonth, manager });
          if (gen.created) result.created++;
          else result.skipped++;
        });
      } catch (err) {
        result.errors.push({
          ruleId: rule.id,
          description: rule.description,
          error: (err as Error).message,
        });
      }
    }

    return result;
  }
}
