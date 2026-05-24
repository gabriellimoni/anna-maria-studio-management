import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelSessionDto {
  @ApiPropertyOptional({ example: 'Feriado nacional' })
  @IsOptional()
  @IsString()
  reason?: string;
}
