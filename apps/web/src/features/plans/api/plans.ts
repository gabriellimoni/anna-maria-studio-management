import type {
  CancelPlanInput,
  ChangeScheduleInput,
  CreatePlanInput,
  CreatePlanResponse,
  ListPlansQuery,
  Plan,
  RenewPlanInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export interface PlanDetail extends Plan {
  schedules: { id: string; weekday: number; startTime: string }[];
  receivables: {
    id: string;
    amount: string;
    dueDate: string;
    status: string;
    paymentMethod: string | null;
    installmentNumber: number | null;
    installmentTotal: number | null;
    paidAt: string | null;
  }[];
  summary: {
    totalSessions: number;
    sessionsByStatus: Record<string, number>;
    totalReceivables: number;
    paidReceivables: number;
  };
}

export const plansApi = {
  list: (query?: ListPlansQuery) =>
    apiClient.get<{ data: Plan[]; total: number }>('/plans', { params: query }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<PlanDetail>(`/plans/${id}`).then((r) => r.data),

  create: (data: CreatePlanInput) =>
    apiClient.post<CreatePlanResponse>('/plans', data).then((r) => r.data),

  updateBasics: (id: string, data: { notes?: string; status?: string }) =>
    apiClient.patch<Plan>(`/plans/${id}`, data).then((r) => r.data),

  changeSchedule: (id: string, data: ChangeScheduleInput) =>
    apiClient
      .post<{ removedFutureSessions: number; createdSessions: number; warnings?: unknown }>(`/plans/${id}/change-schedule`, data)
      .then((r) => r.data),

  renew: (id: string, data: RenewPlanInput) =>
    apiClient
      .post<{ newPlanId: string; generated: { sessions: number; receivables: number }; warnings?: unknown }>(`/plans/${id}/renew`, data)
      .then((r) => r.data),

  cancel: (id: string, data: CancelPlanInput) =>
    apiClient
      .post<{ cancelledFutureSessions: number; pendingReceivables: unknown[] }>(`/plans/${id}/cancel`, data)
      .then((r) => r.data),

  finish: (id: string) =>
    apiClient.post<Plan>(`/plans/${id}/finish`).then((r) => r.data),

  checkCapacity: (params: { weekday: number; startTime: string; from: string; to: string }) =>
    apiClient
      .get<{ slots: { scheduledAt: string; occupied: number; isOverCapacity: boolean }[] }>('/plans/check-capacity', { params })
      .then((r) => r.data),
};
