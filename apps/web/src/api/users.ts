import { User } from '@representante-vendas/contracts';
import { apiClient } from './client';

export const getMe = async (): Promise<User> => {
  const { data } = await apiClient.get('/users/me');
  return data;
};

export const updateMe = async (dto: Partial<Pick<User, 'name'>>): Promise<User> => {
  const { data } = await apiClient.patch('/users/me', dto);
  return data;
};
