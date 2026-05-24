import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateContractTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  bodyMarkdown?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
