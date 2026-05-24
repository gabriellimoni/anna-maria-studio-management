import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RunGenerationDto {
  @ApiProperty({ example: '2026-07', description: 'Target competence month in YYYY-MM format' })
  @Matches(/^\d{4}-\d{2}$/, { message: 'competenceMonth must be in YYYY-MM format' })
  competenceMonth: string;
}
