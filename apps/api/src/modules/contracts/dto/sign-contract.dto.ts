import { IsNotEmpty, IsString } from 'class-validator';

export class SignContractDto {
  @IsString()
  @IsNotEmpty()
  signatureImage: string;
}
