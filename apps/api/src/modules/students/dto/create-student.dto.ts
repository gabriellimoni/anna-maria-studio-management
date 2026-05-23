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
}
