import type {
  CalendarResponse,
  CancelSessionInput,
  ListSessionsQuery,
  ListSessionsResponse,
  Session,
  UpdateSessionInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const sessionsApi = {
  list: (query?: ListSessionsQuery) =>
    apiClient.get<ListSessionsResponse>('/sessions', { params: query }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Session>(`/sessions/${id}`).then((r) => r.data),

  calendar: (params: { from: string; to: string }) =>
    apiClient.get<CalendarResponse>('/sessions/calendar', { params }).then((r) => r.data),

  update: (id: string, data: UpdateSessionInput) =>
    apiClient.patch<Session>(`/sessions/${id}`, data).then((r) => r.data),

  cancel: (id: string, data: CancelSessionInput) =>
    apiClient.post<Session>(`/sessions/${id}/cancel`, data).then((r) => r.data),
};
