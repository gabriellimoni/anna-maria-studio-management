import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PlanStatus } from '@anna-maria/contracts';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['active', 'finished', 'cancelled'] as const)
  status?: PlanStatus;
}
