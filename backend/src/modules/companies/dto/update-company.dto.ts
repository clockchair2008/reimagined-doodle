import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyDto } from './create-company.dto';
import { IsString, IsOptional, IsEmail, IsBoolean, Matches } from 'class-validator';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @IsString()
  @IsOptional()
  logo?: string; // Base64 encoded logo - optional for updates
}
