import axios, { isAxiosError } from 'axios';
import { auth } from '../auth/firebase';
import { posthog } from '../lib/posthog';

export function getApiError(error: unknown, fallback = 'Erro inesperado'): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown } | undefined;
    if (data?.message) {
      return Array.isArray(data.message)
        ? (data.message as string[]).join(' · ')
        : String(data.message);
    }
  }
  return fallback;
}

export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api/v1' });

apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __E2E_AUTH__?: { token: string } };
    if (w.__E2E_AUTH__?.token) {
      config.headers.Authorization = `Bearer ${w.__E2E_AUTH__.token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status >= 500) {
      posthog.captureException(new Error(`API ${status}: ${error.config?.url ?? 'unknown'}`));
    }
    return Promise.reject(error);
  },
);
