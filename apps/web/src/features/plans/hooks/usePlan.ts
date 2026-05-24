import { useQuery } from '@tanstack/react-query';
import { plansApi } from '../api/plans';

export function usePlan(id: string) {
  return useQuery({
    queryKey: ['plans', id],
    queryFn: () => plansApi.get(id),
    enabled: !!id,
  });
}
