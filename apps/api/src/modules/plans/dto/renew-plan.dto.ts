import { ArrayMinSize, IsBoolean, IsOptional, IsString, Matches, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InstallmentInputDto } from './installment-input.dto';
import { ScheduleSpecDto } from './schedule-spec.dto';

export class RenewPlanDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @Matches(/^\d+\.\d{2}$/)
  totalPrice: string;

  @IsBoolean()
  keepSchedules: boolean;

  @ValidateIf((o: RenewPlanDto) => !o.keepSchedules)
  @ValidateNested({ each: true })
  @Type(() => ScheduleSpecDto)
  @ArrayMinSize(1)
  schedules?: ScheduleSpecDto[];

  @ValidateNested({ each: true })
  @Type(() => InstallmentInputDto)
  @ArrayMinSize(1)
  installments: InstallmentInputDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
