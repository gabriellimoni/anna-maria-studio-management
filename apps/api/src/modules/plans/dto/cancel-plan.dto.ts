import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CancelPlanDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsBoolean()
  cancelFutureSessions: boolean;
}
