import type {
  CreateDropInInput,
  CreateDropInResponse,
  DeleteDropInResponse,
  DropInClass,
  ListDropInsQuery,
  UpdateDropInInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const dropInsApi = {
  list: (query?: ListDropInsQuery) =>
    apiClient.get<DropInClass[]>('/drop-ins', { params: query }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<DropInClass>(`/drop-ins/${id}`).then((r) => r.data),

  create: (data: CreateDropInInput) =>
    apiClient.post<CreateDropInResponse>('/drop-ins', data).then((r) => r.data),

  update: (id: string, data: UpdateDropInInput) =>
    apiClient.patch<DropInClass>(`/drop-ins/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<DeleteDropInResponse>(`/drop-ins/${id}`).then((r) => r.data),
};
