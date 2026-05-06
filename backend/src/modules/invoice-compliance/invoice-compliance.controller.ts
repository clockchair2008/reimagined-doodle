import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoiceComplianceService } from './invoice-compliance.service';
import { CreateCompliantInvoiceDto } from './dto/create-compliant-invoice.dto';
import { ProcessCompliantInvoiceDto } from './dto/process-compliant-invoice.dto';

@Controller('invoice')
@UseGuards(JwtAuthGuard)
export class InvoiceComplianceController {
  constructor(private readonly invoiceComplianceService: InvoiceComplianceService) {}

  @Post('create')
  create(@Body() dto: CreateCompliantInvoiceDto) {
    return this.invoiceComplianceService.create(dto);
  }

  @Post('clear')
  clear(@Body() dto: ProcessCompliantInvoiceDto) {
    return this.invoiceComplianceService.clear(dto);
  }

  @Post('report')
  report(@Body() dto: ProcessCompliantInvoiceDto) {
    return this.invoiceComplianceService.report(dto);
  }
}

