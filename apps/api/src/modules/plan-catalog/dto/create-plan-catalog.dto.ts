import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';
import { Period } from '@anna-maria/contracts';

export class CreatePlanCatalogDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ['monthly', 'quarterly', 'semiannual', 'annual'] })
  @IsEnum(['monthly', 'quarterly', 'semiannual', 'annual'])
  period: Period;

  @ApiProperty({ minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  weeklyFrequency: number;

  @ApiProperty({ example: '280.00' })
  @IsString()
  @Matches(/^\d+\.\d{2}$/)
  basePrice: string;
}
