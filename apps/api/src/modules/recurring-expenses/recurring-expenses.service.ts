import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type {
  PaginatedRecurringExpenses,
  RecurringExpense as RecurringExpenseContract,
  RunGenerationResult,
} from '@anna-maria/contracts';
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

  async create(dto: CreateRecurringExpenseDto): Promise<RecurringExpenseContract> {
    const r = this.repo.create({ ...dto, isActive: true });
    await this.repo.save(r);
    return toContract(r);
  }

  async update(id: string, dto: UpdateRecurringExpenseDto): Promise<RecurringExpenseContract> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`RecurringExpense ${id} not found`);

    if (dto.description !== undefined) r.description = dto.description;
    if (dto.category !== undefined) r.category = dto.category;
    if (dto.expectedAmount !== undefined) r.expectedAmount = dto.expectedAmount;
    if (dto.dueDay !== undefined) r.dueDay = dto.dueDay;
    if (dto.isActive !== undefined) r.isActive = dto.isActive;

    await this.repo.save(r);
    return toContract(r);
  }

  async remove(id: string): Promise<void> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`RecurringExpense ${id} not found`);
    await this.repo.delete(id);
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
