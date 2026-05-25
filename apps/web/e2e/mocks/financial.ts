export const RECEIVABLE_1 = {
  id: 'rec-1',
  studentId: 'student-1',
  studentName: 'Ana Silva',
  description: 'Mensalidade maio/2026',
  amount: '320.00',
  dueDate: '2026-05-10',
  status: 'pending',
  paidAt: null,
  createdAt: '2026-05-01T10:00:00.000Z',
};

export const receivablesList = { data: [RECEIVABLE_1], total: 1, page: 1, pageSize: 20 };

export const PAYABLE_1 = {
  id: 'pay-1',
  description: 'Aluguel sala',
  amount: '1500.00',
  dueDate: '2026-05-05',
  status: 'pending',
  paidAt: null,
  createdAt: '2026-05-01T10:00:00.000Z',
};

export const payablesList = { data: [PAYABLE_1], total: 1, page: 1, pageSize: 20 };

export const recurringExpensesList = { data: [], total: 0, page: 1, pageSize: 20 };
