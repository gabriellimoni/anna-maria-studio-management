import { useQuery } from '@tanstack/react-query';
import type { ListStudentsQuery } from '@anna-maria/contracts';
import { studentsApi } from '../api/students';

export function useStudents(query?: ListStudentsQuery) {
  return useQuery({
    queryKey: ['students', query],
    queryFn: () => studentsApi.list(query),
  });
}
