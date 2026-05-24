import type { LancamentoStatus, PaymentMethod, Period, PlanStatus } from '../common/enums';

export interface PlanSchedule {
  id: string;
  weekday: number;
  startTime: string;
}

export interface Plan {
  id: string;
  studentId: string;
  planCatalogId: string | null;
  period: Period;
  weeklyFrequency: number;
  startDate: string;
  endDate: string;
  totalPrice: string;
  paymentMethod: PaymentMethod | null;
  installmentsCount: number;
  status: PlanStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentInput {
  amount: string;
  dueDate: string;
  paymentMethod?: PaymentMethod;
  status?: LancamentoStatus;
  paidAt?: string;
}

export interface CreatePlanInput {
  studentId: string;
  planCatalogId: string;
  startDate: string;
  totalPrice: string;
  schedules: { weekday: number; startTime: string }[];
  installments: InstallmentInput[];
  notes?: string;
}

export interface OverCapacityWarning {
  scheduledAt: string;
  occupied: number;
}

export interface CreatePlanResponse extends Plan {
  generated: { sessions: number; receivables: number };
  warnings?: { overCapacitySlots: OverCapacityWarning[] };
}

export interface ChangeScheduleInput {
  schedules: { weekday: number; startTime: string }[];
}

export interface RenewPlanInput {
  startDate: string;
  totalPrice: string;
  keepSchedules: boolean;
  schedules?: { weekday: number; startTime: string }[];
  installments: InstallmentInput[];
  notes?: string;
}

export interface CancelPlanInput {
  reason?: string;
  cancelFutureSessions: boolean;
}

export interface ListPlansQuery {
  expiringInDays?: 7 | 30 | 60 | 90;
  status?: PlanStatus;
  studentId?: string;
  page?: number;
  pageSize?: number;
}
