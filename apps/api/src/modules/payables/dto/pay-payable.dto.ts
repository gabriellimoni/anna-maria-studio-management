import { IsDateString, IsEnum } from 'class-validator';
import { PaymentMethod } from '@anna-maria/contracts';

export class PayPayableDto {
  @IsDateString()
  paidAt: string;

  @IsEnum(['cash', 'pix', 'card', 'boleto'] as const)
  paymentMethod: PaymentMethod;
}
