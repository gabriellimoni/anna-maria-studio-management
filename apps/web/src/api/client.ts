import axios from 'axios';
import { auth } from '../auth/firebase';

export const apiClient = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });

apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
