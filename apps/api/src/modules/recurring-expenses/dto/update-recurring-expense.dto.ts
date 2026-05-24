import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateRecurringExpenseDto } from './create-recurring-expense.dto';

export class UpdateRecurringExpenseDto extends PartialType(CreateRecurringExpenseDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
