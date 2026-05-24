import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateRecurringExpenseInput, UpdateRecurringExpenseInput } from '@anna-maria/contracts';
import { recurringExpensesApi } from '../api/recurring-expenses';

export function useCreateRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringExpenseInput) => recurringExpensesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
  });
}

export function useUpdateRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecurringExpenseInput }) =>
      recurringExpensesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
  });
}

export function useDeleteRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringExpensesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-expenses'] }),
  });
}
