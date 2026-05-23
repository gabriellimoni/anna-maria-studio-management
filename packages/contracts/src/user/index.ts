export type { UserRole } from '../common/enums';

export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  role: import('../common/enums').UserRole;
  isActive: boolean;
  studentId: string | null;
  createdAt: string;
  updatedAt: string;
}
