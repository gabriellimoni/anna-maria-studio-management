import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListContractTemplatesQuery {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}
