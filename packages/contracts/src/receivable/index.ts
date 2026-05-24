import type { LancamentoStatus, PaymentMethod, ReceivableSource } from '../common/enums';

export interface Receivable {
  id: string;
  planId: string | null;
  source: ReceivableSource;
  description: string;
  studentName: string | null;
  planPeriod: string | null;
  planWeeklyFrequency: number | null;
  amount: string;
  dueDate: string;
  installmentNumber: number | null;
  installmentTotal: number | null;
  paymentMethod: PaymentMethod | null;
  status: LancamentoStatus;
  paidAt: string | null;
  invoiceGenerated: boolean;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReceivableManualInput {
  description: string;
  amount: string;
  dueDate: string;
  paymentMethod?: PaymentMethod;
}

export interface UpdateReceivableInput {
  description?: string;
  amount?: string;
  dueDate?: string;
  paymentMethod?: PaymentMethod;
}

export interface PayReceivableInput {
  paidAt: string;
  paymentMethod: PaymentMethod;
}

export interface ListReceivablesQuery {
  status?: 'pending' | 'paid' | 'overdue';
  from?: string;
  to?: string;
  planId?: string;
  source?: ReceivableSource;
  invoiceGenerated?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedReceivables {
  data: Receivable[];
  total: number;
}
