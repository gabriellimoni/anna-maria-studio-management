import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { LancamentoStatus, PaymentMethod } from '@anna-maria/contracts';
import { Plan } from '../../plans/entities/plan.entity';
import { Receivable } from '../../receivables/entities/receivable.entity';
import { decimalsEqual, sumDecimals } from '../utils/money.utils';

export type InstallmentInput = {
  amount: string;
  dueDate: string;
  paymentMethod?: PaymentMethod;
  status?: LancamentoStatus;
  paidAt?: string;
};

@Injectable()
export class ReceivablePersistService {
  async persistForPlan(input: {
    plan: Plan;
    installments: InstallmentInput[];
    manager: EntityManager;
    studentName?: string;
    planName?: string;
  }): Promise<Receivable[]> {
    const { plan, installments, manager, studentName, planName } = input;
    const baseDescription = studentName && planName ? `${studentName} — ${planName}` : undefined;

    if (installments.length < 1) {
      throw new UnprocessableEntityException('At least one installment is required');
    }

    for (const inst of installments) {
      if (inst.status === 'paid' && !inst.paidAt) {
        throw new UnprocessableEntityException('paidAt is required when status is paid');
      }
    }

    const total = sumDecimals(installments.map((i) => i.amount));
    if (!decimalsEqual(total, plan.totalPrice)) {
      throw new UnprocessableEntityException(
        `Installment sum ${total} does not match plan total ${plan.totalPrice} (tolerance: 1 cent)`,
      );
    }

    const n = installments.length;
    const receivables = installments.map((inst, i) =>
      manager.create(Receivable, {
        planId: plan.id,
        source: 'plan',
        description: baseDescription ?? `Parcela ${i + 1}/${n}`,
        installmentNumber: i + 1,
        installmentTotal: n,
        amount: inst.amount,
        dueDate: inst.dueDate,
        paymentMethod: inst.paymentMethod ?? null,
        status: inst.status ?? 'pending',
        paidAt: inst.paidAt ?? null,
      }),
    );

    return manager.save(Receivable, receivables);
  }
}
