import { IsDateString, IsEnum, IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LancamentoStatus, PaymentMethod } from '@anna-maria/contracts';

export class ChargeDtoInput {
  @IsString()
  @Matches(/^\d+\.\d{2}$/)
  amount: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsEnum(['cash', 'pix', 'card', 'boleto'] as const)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsIn(['pending', 'paid'])
  status?: LancamentoStatus;

  @ValidateIf((o: ChargeDtoInput) => o.status === 'paid')
  @IsDateString()
  paidAt?: string;
}

export class CreateDropInDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  prospectName?: string;

  @IsISO8601()
  scheduledAt: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChargeDtoInput)
  charge?: ChargeDtoInput;

  @IsOptional()
  @IsString()
  notes?: string;
}
