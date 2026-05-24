import axios from 'axios';
import type { PublicContractView, SignContractInput, SignContractResponse } from '@anna-maria/contracts';

const publicClient = axios.create({ baseURL: '/api/v1' });

export const publicContractsApi = {
  view: (token: string) =>
    publicClient.get<PublicContractView>(`/public/contracts/${token}`).then((r) => r.data),

  sign: (token: string, data: SignContractInput) =>
    publicClient.post<SignContractResponse>(`/public/contracts/${token}/sign`, data).then((r) => r.data),

  pdfUrl: (token: string) => `/api/v1/public/contracts/${token}/pdf`,
};
