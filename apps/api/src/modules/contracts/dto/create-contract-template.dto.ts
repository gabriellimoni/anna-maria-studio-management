import { IsNotEmpty, IsString } from 'class-validator';

export class CreateContractTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  bodyMarkdown: string;
}
