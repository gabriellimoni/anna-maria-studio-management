import type {
  CreatePayableManualInput,
  ListPayablesQuery,
  PaginatedPayables,
  PayPayableInput,
  Payable,
  UpdatePayableInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const payablesApi = {
  list(query?: ListPayablesQuery) {
    return apiClient.get<PaginatedPayables>('/payables', { params: query }).then((r) => r.data);
  },
  get(id: string) {
    return apiClient.get<Payable>(`/payables/${id}`).then((r) => r.data);
  },
  create(data: CreatePayableManualInput) {
    return apiClient.post<Payable>('/payables', data).then((r) => r.data);
  },
  update(id: string, data: UpdatePayableInput) {
    return apiClient.patch<Payable>(`/payables/${id}`, data).then((r) => r.data);
  },
  pay(id: string, data: PayPayableInput) {
    return apiClient.post<Payable>(`/payables/${id}/pay`, data).then((r) => r.data);
  },
  unpay(id: string) {
    return apiClient.post<Payable>(`/payables/${id}/unpay`).then((r) => r.data);
  },
};
