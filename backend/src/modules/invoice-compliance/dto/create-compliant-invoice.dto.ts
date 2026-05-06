import { IsArray, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CompliantInvoiceItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;
}

export class CreateCompliantInvoiceDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsDateString()
  issueDateTime?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompliantInvoiceItemDto)
  items: CompliantInvoiceItemDto[];
}

