import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePlanContractDto {
  @IsString()
  @IsNotEmpty()
  bodyMarkdown: string;
}
