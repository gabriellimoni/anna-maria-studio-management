import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../api/students';

export function useStudent(id: string) {
  return useQuery({
    queryKey: ['students', id],
    queryFn: () => studentsApi.get(id),
    enabled: !!id,
  });
}
