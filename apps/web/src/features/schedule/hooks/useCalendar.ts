import { useQuery } from '@tanstack/react-query';
import { sessionsApi } from '../api/sessions';

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['sessions', 'calendar', from, to],
    queryFn: () => sessionsApi.calendar({ from, to }),
    enabled: !!from && !!to,
  });
}
