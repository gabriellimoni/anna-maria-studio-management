import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional } from 'class-validator';

export class ListPlanCatalogQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
