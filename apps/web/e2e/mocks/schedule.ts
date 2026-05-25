// Matches CalendarResponse contract: { slots: CalendarSlot[] }
export const SESSION_1 = {
  id: 'session-1',
  planId: 'plan-1',
  studentId: 'student-1',
  studentName: 'Ana Silva',
  scheduledAt: '2026-05-25T08:00:00.000Z',
  status: 'scheduled',
  origin: 'plan',
  notes: null,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

export const calendarResponse = {
  slots: [
    {
      date: '2026-05-25',
      startTime: '08:00',
      capacity: 4,
      occupied: 1,
      isOverCapacity: false,
      sessions: [SESSION_1],
    },
  ],
};

export const sessionsList = { data: [SESSION_1], total: 1 };
