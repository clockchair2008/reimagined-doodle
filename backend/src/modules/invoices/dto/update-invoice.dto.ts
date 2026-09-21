import {
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceItemDto } from './create-invoice.dto';

export class UpdateInvoiceDto {
  @IsDateString()
  @IsOptional()
  issueDateTime?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  @IsOptional()
  items?: CreateInvoiceItemDto[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  deductionAmount?: number;

  @ValidateIf(
    (o) =>
      o.deductionDescription !== undefined ||
      Number(o.deductionAmount ?? 0) > 0,
  )
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  deductionDescription?: string | null;
}
