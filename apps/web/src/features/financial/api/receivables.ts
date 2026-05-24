import type {
  CreateReceivableManualInput,
  ListReceivablesQuery,
  PaginatedReceivables,
  PayReceivableInput,
  Receivable,
  UpdateReceivableInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const receivablesApi = {
  list(query?: ListReceivablesQuery) {
    return apiClient.get<PaginatedReceivables>('/receivables', { params: query }).then((r) => r.data);
  },
  get(id: string) {
    return apiClient.get<Receivable>(`/receivables/${id}`).then((r) => r.data);
  },
  create(data: CreateReceivableManualInput) {
    return apiClient.post<Receivable>('/receivables', data).then((r) => r.data);
  },
  update(id: string, data: UpdateReceivableInput) {
    return apiClient.patch<Receivable>(`/receivables/${id}`, data).then((r) => r.data);
  },
  pay(id: string, data: PayReceivableInput) {
    return apiClient.post<Receivable>(`/receivables/${id}/pay`, data).then((r) => r.data);
  },
  unpay(id: string) {
    return apiClient.post<Receivable>(`/receivables/${id}/unpay`).then((r) => r.data);
  },
  markInvoiced(id: string) {
    return apiClient.post<Receivable>(`/receivables/${id}/mark-invoiced`).then((r) => r.data);
  },
  unmarkInvoiced(id: string) {
    return apiClient.post<Receivable>(`/receivables/${id}/unmark-invoiced`).then((r) => r.data);
  },
};
