export interface Student {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentInput {
  fullName: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  notes?: string;
}

export type UpdateStudentInput = Partial<CreateStudentInput>;

export interface ListStudentsQuery {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListStudentsResponse {
  data: Student[];
  total: number;
}
