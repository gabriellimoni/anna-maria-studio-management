import type {
  CreateRecurringExpenseInput,
  ListRecurringExpensesQuery,
  PaginatedRecurringExpenses,
  RecurringExpense,
  RunGenerationInput,
  RunGenerationResult,
  UpdateRecurringExpenseInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const recurringExpensesApi = {
  list(query?: ListRecurringExpensesQuery) {
    return apiClient
      .get<PaginatedRecurringExpenses>('/recurring-expenses', { params: query })
      .then((r) => r.data);
  },
  get(id: string) {
    return apiClient.get<RecurringExpense>(`/recurring-expenses/${id}`).then((r) => r.data);
  },
  create(data: CreateRecurringExpenseInput) {
    return apiClient.post<RecurringExpense>('/recurring-expenses', data).then((r) => r.data);
  },
  update(id: string, data: UpdateRecurringExpenseInput) {
    return apiClient.patch<RecurringExpense>(`/recurring-expenses/${id}`, data).then((r) => r.data);
  },
  remove(id: string) {
    return apiClient.delete(`/recurring-expenses/${id}`).then((r) => r.data);
  },
  runGeneration(data: RunGenerationInput) {
    return apiClient
      .post<RunGenerationResult>('/recurring-expenses/run-generation', data)
      .then((r) => r.data);
  },
};
