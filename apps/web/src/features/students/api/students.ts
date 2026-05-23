import type {
  CreateStudentInput,
  ListStudentsQuery,
  ListStudentsResponse,
  Student,
  UpdateStudentInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const studentsApi = {
  list: (query?: ListStudentsQuery) =>
    apiClient.get<ListStudentsResponse>('/students', { params: query }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Student>(`/students/${id}`).then((r) => r.data),

  create: (data: CreateStudentInput) =>
    apiClient.post<Student>('/students', data).then((r) => r.data),

  update: (id: string, data: UpdateStudentInput) =>
    apiClient.patch<Student>(`/students/${id}`, data).then((r) => r.data),

  archive: (id: string) =>
    apiClient.delete(`/students/${id}`),
};
