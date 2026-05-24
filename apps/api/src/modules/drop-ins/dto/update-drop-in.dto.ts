import { IsOptional, IsString } from 'class-validator';

export class UpdateDropInDto {
  @IsOptional()
  @IsString()
  prospectName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
