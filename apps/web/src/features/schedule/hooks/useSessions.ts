import { useQuery } from '@tanstack/react-query';
import type { ListSessionsQuery } from '@anna-maria/contracts';
import { sessionsApi } from '../api/sessions';

export function useSessions(query?: ListSessionsQuery) {
  return useQuery({
    queryKey: ['sessions', 'list', query],
    queryFn: () => sessionsApi.list(query),
  });
}
