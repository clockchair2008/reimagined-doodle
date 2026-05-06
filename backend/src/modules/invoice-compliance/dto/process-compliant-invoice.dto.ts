import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ProcessCompliantInvoiceDto {
  @IsUUID()
  invoiceId: string;

  @IsOptional()
  @IsString()
  clearanceStatus?: string;
}

