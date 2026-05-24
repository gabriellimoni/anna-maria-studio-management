import { ArrayMinSize, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InstallmentInputDto } from './installment-input.dto';
import { ScheduleSpecDto } from './schedule-spec.dto';

export class CreatePlanDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  planCatalogId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @Matches(/^\d+\.\d{2}$/)
  totalPrice: string;

  @ValidateNested({ each: true })
  @Type(() => ScheduleSpecDto)
  @ArrayMinSize(1)
  schedules: ScheduleSpecDto[];

  @ValidateNested({ each: true })
  @Type(() => InstallmentInputDto)
  @ArrayMinSize(1)
  installments: InstallmentInputDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
