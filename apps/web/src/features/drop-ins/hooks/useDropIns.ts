import { useQuery } from '@tanstack/react-query';
import type { ListDropInsQuery } from '@anna-maria/contracts';
import { dropInsApi } from '../api/drop-ins';

export function useDropIns(query?: ListDropInsQuery) {
  return useQuery({
    queryKey: ['drop-ins', query],
    queryFn: () => dropInsApi.list(query),
  });
}

export function useDropIn(id: string) {
  return useQuery({
    queryKey: ['drop-ins', id],
    queryFn: () => dropInsApi.get(id),
    enabled: !!id,
  });
}
