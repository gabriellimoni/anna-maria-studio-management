import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CancelSessionInput, UpdateSessionInput } from '@anna-maria/contracts';
import { sessionsApi } from '../api/sessions';

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSessionInput }) =>
      sessionsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useCancelSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CancelSessionInput }) =>
      sessionsApi.cancel(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}
