import { IsDateString, IsEnum, IsIn, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { LancamentoStatus, PaymentMethod } from '@anna-maria/contracts';

export class InstallmentInputDto {
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

  @ValidateIf((o: InstallmentInputDto) => o.status === 'paid')
  @IsDateString()
  paidAt?: string;
}
