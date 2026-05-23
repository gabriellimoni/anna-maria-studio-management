import axios from 'axios';
import { auth } from '../auth/firebase';
import { posthog } from '../lib/posthog';

export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api/v1' });

apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
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
