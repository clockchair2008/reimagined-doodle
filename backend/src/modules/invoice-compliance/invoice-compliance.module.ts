import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../entities/invoice.entity';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';
import { InvoiceComplianceController } from './invoice-compliance.controller';
import { InvoiceComplianceService } from './invoice-compliance.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { HashChainService } from '../../services/hash-chain.service';
import { QrCodeService } from '../../services/qr-code.service';
import { Ubl21ZatcaService } from './ubl21-zatca.service';
import { InvoiceCryptoService } from './invoice-crypto.service';
import { InvoiceStorageService } from './invoice-storage.service';
import { ZatcaIntegrationService } from './zatca-integration.service';
import { CreditNote } from '../../entities/credit-note.entity';
import { DebitNote } from '../../entities/debit-note.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Company, Customer, CreditNote, DebitNote]), InvoicesModule],
  controllers: [InvoiceComplianceController],
  providers: [
    InvoiceComplianceService,
    HashChainService,
    QrCodeService,
    Ubl21ZatcaService,
    InvoiceCryptoService,
    InvoiceStorageService,
    ZatcaIntegrationService,
  ],
})
export class InvoiceComplianceModule {}

