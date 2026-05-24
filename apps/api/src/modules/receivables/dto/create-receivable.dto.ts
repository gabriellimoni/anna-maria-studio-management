import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { PaymentMethod } from '@anna-maria/contracts';

export class CreateReceivableDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @Matches(/^\d+\.\d{2}$/)
  amount: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsEnum(['cash', 'pix', 'card', 'boleto'] as const)
  paymentMethod?: PaymentMethod;
}
