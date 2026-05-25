export interface Student {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  notes: string | null;
  cpf: string | null;
  rg: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZipcode: string | null;
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
  cpf?: string;
  rg?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressCity?: string;
  addressState?: string;
  addressZipcode?: string;
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
