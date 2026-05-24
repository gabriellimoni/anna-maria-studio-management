export interface RecurringExpense {
  id: string;
  description: string;
  category: string | null;
  expectedAmount: string;
  dueDay: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringExpenseInput {
  description: string;
  category?: string;
  expectedAmount: string;
  dueDay: number;
}

export type UpdateRecurringExpenseInput = Partial<CreateRecurringExpenseInput> & {
  isActive?: boolean;
};

export interface ListRecurringExpensesQuery {
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedRecurringExpenses {
  data: RecurringExpense[];
  total: number;
}

export interface RunGenerationInput {
  competenceMonth: string;
}

export interface RunGenerationResult {
  created: number;
  skipped: number;
  errors: Array<{ ruleId: string; description: string; error: string }>;
}
