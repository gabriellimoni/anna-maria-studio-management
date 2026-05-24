import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class ScheduleSpecDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  startTime: string;
}
