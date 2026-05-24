import { useQuery } from '@tanstack/react-query';
import type { ListReceivablesQuery } from '@anna-maria/contracts';
import { receivablesApi } from '../api/receivables';

export function useReceivables(query?: ListReceivablesQuery) {
  return useQuery({
    queryKey: ['receivables', query],
    queryFn: () => receivablesApi.list(query),
  });
}
