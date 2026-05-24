import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateDropInInput, UpdateDropInInput } from '@anna-maria/contracts';
import { dropInsApi } from '../api/drop-ins';

export function useCreateDropIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDropInInput) => dropInsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drop-ins'] }),
  });
}

export function useUpdateDropIn(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDropInInput) => dropInsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drop-ins'] }),
  });
}

export function useDeleteDropIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dropInsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drop-ins'] }),
  });
}
