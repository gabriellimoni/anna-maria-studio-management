import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateRecurringExpenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: '2500.00' })
  @Matches(/^\d+\.\d{2}$/, { message: 'expectedAmount must be a decimal string like "2500.00"' })
  expectedAmount: string;

  @ApiProperty({ minimum: 1, maximum: 28 })
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay: number;
}
