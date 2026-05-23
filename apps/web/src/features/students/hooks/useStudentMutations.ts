import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateStudentInput, UpdateStudentInput } from '@anna-maria/contracts';
import { studentsApi } from '../api/students';

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStudentInput) => studentsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useUpdateStudent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateStudentInput) => studentsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useArchiveStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studentsApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}
