import { useQuery } from '@tanstack/react-query';
import type { ListPlansQuery } from '@anna-maria/contracts';
import { plansApi } from '../api/plans';

export function usePlans(query?: ListPlansQuery) {
  return useQuery({
    queryKey: ['plans', query],
    queryFn: () => plansApi.list(query),
  });
}
