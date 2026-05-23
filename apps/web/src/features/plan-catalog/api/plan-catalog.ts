import type { CreatePlanCatalogInput, PlanCatalog, UpdatePlanCatalogInput } from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const planCatalogApi = {
  list: (params?: { isActive?: boolean }) =>
    apiClient.get<PlanCatalog[]>('/plan-catalog', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<PlanCatalog>(`/plan-catalog/${id}`).then((r) => r.data),

  create: (data: CreatePlanCatalogInput) =>
    apiClient.post<PlanCatalog>('/plan-catalog', data).then((r) => r.data),

  update: (id: string, data: UpdatePlanCatalogInput) =>
    apiClient.patch<PlanCatalog>(`/plan-catalog/${id}`, data).then((r) => r.data),

  archive: (id: string) =>
    apiClient.delete(`/plan-catalog/${id}`),
};
