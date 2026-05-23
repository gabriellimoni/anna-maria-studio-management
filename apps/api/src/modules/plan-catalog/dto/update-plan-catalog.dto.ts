import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePlanCatalogDto } from './create-plan-catalog.dto';

export class UpdatePlanCatalogDto extends PartialType(CreatePlanCatalogDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
