import { IsOptional, IsString, IsUUID } from 'class-validator';

export class PreviewContractTemplateDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  planId?: string;
}
