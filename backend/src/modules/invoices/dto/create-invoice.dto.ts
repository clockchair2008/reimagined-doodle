import {
  IsString,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  vatRate?: number; // Default 15% for Saudi Arabia
}

export class CreateInvoiceDto {
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsString()
  @IsOptional()
  orderNumber?: string;

  @IsDateString()
  @IsOptional()
  issueDateTime?: string;

  @IsUUID()
  companyId: string;

  @IsUUID()
  customerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  /** Deduction from tax-inclusive total (advance, retention, discount, etc.). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  deductionAmount?: number;

  /** Required when deductionAmount > 0 (e.g. advance payment, retention, discount). */
  @ValidateIf((o) => Number(o.deductionAmount ?? 0) > 0)
  @IsString()
  @MaxLength(1000)
  deductionDescription?: string;
}
