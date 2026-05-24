import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class MaterializePlanContractDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  templateId: string;
}
