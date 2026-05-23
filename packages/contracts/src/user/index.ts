export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}
