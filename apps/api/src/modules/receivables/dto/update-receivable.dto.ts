import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PaymentMethod } from '@anna-maria/contracts';

export class UpdateReceivableDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Matches(/^\d+\.\d{2}$/)
  amount?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(['cash', 'pix', 'card', 'boleto'] as const)
  paymentMethod?: PaymentMethod;
}
