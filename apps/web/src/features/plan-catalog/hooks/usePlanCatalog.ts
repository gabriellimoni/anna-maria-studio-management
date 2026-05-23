import { useQuery } from '@tanstack/react-query';
import { planCatalogApi } from '../api/plan-catalog';

export function usePlanCatalog(params?: { isActive?: boolean }) {
  return useQuery({
    queryKey: ['plan-catalog', params],
    queryFn: () => planCatalogApi.list(params),
  });
}

export function usePlanCatalogItem(id: string) {
  return useQuery({
    queryKey: ['plan-catalog', id],
    queryFn: () => planCatalogApi.get(id),
    enabled: !!id,
  });
}
