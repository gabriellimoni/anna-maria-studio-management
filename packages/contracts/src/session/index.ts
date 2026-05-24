import type { SessionStatus, SessionOrigin } from '../common/enums';
export type { SessionStatus, SessionOrigin };

export interface Session {
  id: string;
  planId: string | null;
  studentId: string;
  studentName: string;
  scheduledAt: string;
  status: SessionStatus;
  origin: SessionOrigin;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarSlot {
  date: string;
  startTime: string;
  capacity: number;
  occupied: number;
  isOverCapacity: boolean;
  sessions: Session[];
}

export interface CalendarResponse {
  slots: CalendarSlot[];
}

export interface ListSessionsQuery {
  date?: string;
  from?: string;
  to?: string;
  studentId?: string;
  planId?: string;
  status?: SessionStatus;
  page?: number;
  pageSize?: number;
}

export interface ListSessionsResponse {
  data: Session[];
  total: number;
}

export interface UpdateSessionInput {
  status?: Exclude<SessionStatus, 'cancelled'>;
  notes?: string;
}

export interface CancelSessionInput {
  reason?: string;
}
