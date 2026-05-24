import type { LancamentoStatus, PayableSource, PaymentMethod } from '../common/enums';

export interface Payable {
  id: string;
  recurringExpenseId: string | null;
  source: PayableSource;
  description: string;
  category: string | null;
  amount: string;
  dueDate: string;
  competenceMonth: string | null;
  paymentMethod: PaymentMethod | null;
  status: LancamentoStatus;
  paidAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayableManualInput {
  description: string;
  category?: string;
  amount: string;
  dueDate: string;
  paymentMethod?: PaymentMethod;
}

export interface UpdatePayableInput {
  description?: string;
  category?: string;
  amount?: string;
  dueDate?: string;
  paymentMethod?: PaymentMethod;
}

export interface PayPayableInput {
  paidAt: string;
  paymentMethod: PaymentMethod;
}

export interface ListPayablesQuery {
  status?: 'pending' | 'paid' | 'overdue';
  from?: string;
  to?: string;
  recurringExpenseId?: string;
  source?: PayableSource;
  competenceMonth?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedPayables {
  data: Payable[];
  total: number;
}
