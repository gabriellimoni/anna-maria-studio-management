import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

const UPDATABLE_STATUSES = ['scheduled', 'present', 'absence_notified', 'absence_unnotified'] as const;

export class UpdateSessionDto {
  @ApiPropertyOptional({ enum: UPDATABLE_STATUSES, description: 'Use POST /cancel to cancel a session' })
  @IsOptional()
  @IsEnum(UPDATABLE_STATUSES)
  status?: (typeof UPDATABLE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
