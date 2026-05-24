import { useQuery } from '@tanstack/react-query';
import type { ListPayablesQuery } from '@anna-maria/contracts';
import { payablesApi } from '../api/payables';

export function usePayables(query?: ListPayablesQuery) {
  return useQuery({
    queryKey: ['payables', query],
    queryFn: () => payablesApi.list(query),
  });
}
