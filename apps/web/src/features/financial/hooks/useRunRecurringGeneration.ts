import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RunGenerationInput } from '@anna-maria/contracts';
import { recurringExpensesApi } from '../api/recurring-expenses';

export function useRunRecurringGeneration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RunGenerationInput) => recurringExpensesApi.runGeneration(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payables'] }),
  });
}
