import { User } from '@anna-maria/contracts';
import { apiClient } from './client';

export const getMe = async (): Promise<User> => {
  const { data } = await apiClient.get('/users/me');
  return data;
};
