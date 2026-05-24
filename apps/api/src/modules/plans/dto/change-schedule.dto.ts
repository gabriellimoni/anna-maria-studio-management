import { ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleSpecDto } from './schedule-spec.dto';

export class ChangeScheduleDto {
  @ValidateNested({ each: true })
  @Type(() => ScheduleSpecDto)
  @ArrayMinSize(1)
  schedules: ScheduleSpecDto[];
}
