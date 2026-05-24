import type { PaymentMethod, LancamentoStatus, SessionStatus } from '../common/enums';

export interface DropInClass {
  id: string;
  sessionId: string;
  studentId: string | null;
  prospectName: string | null;
  receivableId: string | null;
  scheduledAt: string;
  sessionStatus: SessionStatus;
  studentName: string | null;
  chargeStatus: LancamentoStatus | null;
}

export interface DropInChargeInput {
  amount: string;
  dueDate: string;
  paymentMethod?: PaymentMethod;
  status?: LancamentoStatus;
  paidAt?: string;
}

export interface CreateDropInInput {
  studentId?: string;
  prospectName?: string;
  scheduledAt: string;
  charge?: DropInChargeInput;
  notes?: string;
}

export interface CreateDropInResponse {
  id: string;
  sessionId: string;
  receivableId: string | null;
  warnings?: { overCapacity: boolean; occupied: number };
}

export interface UpdateDropInInput {
  prospectName?: string;
  notes?: string;
}

export interface ListDropInsQuery {
  from?: string;
  to?: string;
  studentId?: string;
  hasCharge?: boolean;
}

export interface DeleteDropInResponse {
  sessionId: string;
  pendingReceivableId?: string;
}
