import type {
  ContractTemplate,
  CreateContractTemplateInput,
  ListContractTemplatesQuery,
  PreviewContractTemplateInput,
  PreviewContractTemplateResponse,
  UpdateContractTemplateInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const contractTemplatesApi = {
  list: (query?: ListContractTemplatesQuery) =>
    apiClient
      .get<ContractTemplate[]>('/contract-templates', { params: query })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ContractTemplate>(`/contract-templates/${id}`).then((r) => r.data),

  create: (data: CreateContractTemplateInput) =>
    apiClient.post<ContractTemplate>('/contract-templates', data).then((r) => r.data),

  update: (id: string, data: UpdateContractTemplateInput) =>
    apiClient.patch<ContractTemplate>(`/contract-templates/${id}`, data).then((r) => r.data),

  archive: (id: string) =>
    apiClient.delete(`/contract-templates/${id}`).then((r) => r.data),

  preview: (id: string, data: PreviewContractTemplateInput) =>
    apiClient
      .post<PreviewContractTemplateResponse>(`/contract-templates/${id}/preview`, data)
      .then((r) => r.data),
};
