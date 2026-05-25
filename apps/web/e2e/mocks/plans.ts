export const PLAN_CATALOG_1 = {
  id: 'pc-1',
  name: 'Mensal 2x/semana',
  period: 'monthly',
  weeklyFrequency: 2,
  basePrice: '320.00',
  isActive: true,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

// plan-catalog returns a flat array, not paginated
export const planCatalogList = [PLAN_CATALOG_1];

export const PLAN_1 = {
  id: 'plan-1',
  studentId: 'student-1',
  studentName: 'Ana Silva',
  planCatalogId: 'pc-1',
  planCatalogName: 'Mensal 2x/semana',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  status: 'active',
  schedule: [
    { weekday: 1, time: '08:00' },
    { weekday: 3, time: '08:00' },
  ],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

export const plansList = { data: [PLAN_1], total: 1, page: 1, pageSize: 20 };
