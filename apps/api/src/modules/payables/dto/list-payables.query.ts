import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { PayableSource } from '@anna-maria/contracts';

export class ListPayablesQuery {
  @IsOptional()
  @IsEnum(['pending', 'paid', 'overdue'] as const)
  status?: 'pending' | 'paid' | 'overdue';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  recurringExpenseId?: string;

  @IsOptional()
  @IsEnum(['recurring', 'manual'] as const)
  source?: PayableSource;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  competenceMonth?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  pageSize?: number = 20;
}
