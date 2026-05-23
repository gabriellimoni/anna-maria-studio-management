import type { Period } from '../common/enums';

export interface PlanCatalog {
  id: string;
  name: string;
  period: Period;
  durationMonths: number;
  weeklyFrequency: number;
  basePrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanCatalogInput {
  name: string;
  period: Period;
  weeklyFrequency: number;
  basePrice: string;
}

export type UpdatePlanCatalogInput = Partial<CreatePlanCatalogInput> & { isActive?: boolean };
