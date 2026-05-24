import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CalendarQuery {
  @ApiProperty({ description: 'Start date (YYYY-MM-DD)', example: '2026-05-19' })
  @IsDateString()
  from: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD), max 31-day window', example: '2026-05-25' })
  @IsDateString()
  to: string;
}
