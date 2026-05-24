import { useQuery } from '@tanstack/react-query';
import type { ListRecurringExpensesQuery } from '@anna-maria/contracts';
import { recurringExpensesApi } from '../api/recurring-expenses';

export function useRecurringExpenses(query?: ListRecurringExpensesQuery) {
  return useQuery({
    queryKey: ['recurring-expenses', query],
    queryFn: () => recurringExpensesApi.list(query),
  });
}

export function useRecurringExpense(id: string) {
  return useQuery({
    queryKey: ['recurring-expenses', id],
    queryFn: () => recurringExpensesApi.get(id),
    enabled: !!id,
  });
}
