import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const emptyToUndefined = () => Transform(({ value }) => (value === '' ? undefined : value));

export class CreateStudentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  cpf?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  rg?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  addressStreet?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  addressNumber?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  addressComplement?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  addressCity?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  addressState?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsString()
  @IsOptional()
  addressZipcode?: string;
}
