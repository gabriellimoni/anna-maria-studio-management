import type {
  MaterializePlanContractInput,
  PlanContractDetail,
  SendPlanContractResponse,
  UpdatePlanContractInput,
} from '@anna-maria/contracts';
import { apiClient } from '../../../api/client';

export const planContractsApi = {
  get: (planId: string) =>
    apiClient.get<PlanContractDetail>(`/plans/${planId}/contract`).then((r) => r.data),

  materialize: (planId: string, data: MaterializePlanContractInput) =>
    apiClient.post<PlanContractDetail>(`/plans/${planId}/contract`, data).then((r) => r.data),

  updateDraft: (planId: string, data: UpdatePlanContractInput) =>
    apiClient.patch<PlanContractDetail>(`/plans/${planId}/contract`, data).then((r) => r.data),

  send: (planId: string) =>
    apiClient.post<SendPlanContractResponse>(`/plans/${planId}/contract/send`).then((r) => r.data),

  cancel: (planId: string) =>
    apiClient.post(`/plans/${planId}/contract/cancel`).then((r) => r.data),

  getSignatureLink: (planId: string) =>
    apiClient.get<{ publicUrl: string }>(`/plans/${planId}/contract/signature-link`).then((r) => r.data),

  downloadPdf: async (planId: string): Promise<void> => {
    const response = await apiClient.get(`/plans/${planId}/contract/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrato-${planId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
