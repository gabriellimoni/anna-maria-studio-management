import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RecurringExpense } from '../../recurring-expenses/entities/recurring-expense.entity';
import { Payable } from '../../payables/entities/payable.entity';

@Injectable()
export class PayableGeneratorService {
  /**
   * Generates exactly one payable for a recurring expense in the given competence month.
   * Idempotent: uses ON CONFLICT DO NOTHING against the partial unique index
   * uq_payable_recurring_competence (source='recurring').
   */
  async generateForMonth(input: {
    rule: RecurringExpense;
    competenceMonth: Date;
    manager: EntityManager;
  }): Promise<{ created: boolean; payable?: Payable }> {
    const { rule, competenceMonth, manager } = input;

    // Use UTC accessors — competenceMonth is always the 1st of the month at UTC midnight.
    const year = competenceMonth.getUTCFullYear();
    const month = String(competenceMonth.getUTCMonth() + 1).padStart(2, '0');
    const day = String(Number(rule.dueDay)).padStart(2, '0');
    const dueDate = `${year}-${month}-${day}`;
    const competenceStr = `${year}-${month}-01`;

    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(Payable)
      .values({
        recurringExpenseId: rule.id,
        source: 'recurring',
        description: rule.description,
        category: rule.category,
        amount: rule.expectedAmount,
        dueDate,
        competenceMonth: competenceStr,
        status: 'pending',
      })
      .orIgnore()
      .returning('*')
      .execute();

    if ((result.raw as unknown[]).length === 0) {
      return { created: false };
    }
    return { created: true, payable: result.raw[0] as Payable };
  }
}
