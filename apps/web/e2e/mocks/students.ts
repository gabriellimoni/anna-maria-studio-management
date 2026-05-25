export const STUDENT_1 = {
  id: 'student-1',
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '11999990001',
  birthDate: '1990-05-12',
  notes: null,
  isActive: true,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

export const STUDENT_2 = {
  id: 'student-2',
  fullName: 'Bruno Costa',
  email: 'bruno@example.com',
  phone: '11999990002',
  birthDate: '1985-09-22',
  notes: null,
  isActive: true,
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
};

export const studentsList = {
  data: [STUDENT_1, STUDENT_2],
  total: 2,
  page: 1,
  pageSize: 20,
};

export const emptyStudentsList = { data: [], total: 0, page: 1, pageSize: 20 };
