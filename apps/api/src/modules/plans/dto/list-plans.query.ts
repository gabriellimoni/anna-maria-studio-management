import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsUUID, Min } from 'class-validator';
import { PlanStatus } from '@anna-maria/contracts';

export class ListPlansQuery {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsIn([7, 30, 60, 90])
  expiringInDays?: 7 | 30 | 60 | 90;

  @IsOptional()
  @IsEnum(['active', 'finished', 'cancelled'] as const)
  status?: PlanStatus;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  pageSize?: number = 20;
}
