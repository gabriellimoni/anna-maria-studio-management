import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID, Min } from 'class-validator';
import { ReceivableSource } from '@anna-maria/contracts';

export class ListReceivablesQuery {
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
  planId?: string;

  @IsOptional()
  @IsEnum(['plan', 'drop_in', 'manual'] as const)
  source?: ReceivableSource;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(1)
  pageSize?: number = 20;
}
