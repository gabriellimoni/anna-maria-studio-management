import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatePlanCatalogInput, UpdatePlanCatalogInput } from '@anna-maria/contracts';
import { planCatalogApi } from '../api/plan-catalog';

export function useCreatePlanCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlanCatalogInput) => planCatalogApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-catalog'] }),
  });
}

export function useUpdatePlanCatalog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePlanCatalogInput) => planCatalogApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-catalog'] }),
  });
}

export function useArchivePlanCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => planCatalogApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-catalog'] }),
  });
}
