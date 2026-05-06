import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateCompliantInvoiceDto } from './dto/create-compliant-invoice.dto';
import { ProcessCompliantInvoiceDto } from './dto/process-compliant-invoice.dto';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';
import { HashChainService } from '../../services/hash-chain.service';
import { QrCodeService } from '../../services/qr-code.service';
import { Ubl21ZatcaService } from './ubl21-zatca.service';
import { InvoiceCryptoService } from './invoice-crypto.service';
import { InvoiceStorageService } from './invoice-storage.service';
import { ZatcaIntegrationService } from './zatca-integration.service';

@Injectable()
export class InvoiceComplianceService {
  constructor(
    private readonly invoicesService: InvoicesService,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly hashChainService: HashChainService,
    private readonly qrCodeService: QrCodeService,
    private readonly ubl21ZatcaService: Ubl21ZatcaService,
    private readonly invoiceCryptoService: InvoiceCryptoService,
    private readonly invoiceStorageService: InvoiceStorageService,
    private readonly zatcaIntegrationService: ZatcaIntegrationService,
  ) {}

  async create(dto: CreateCompliantInvoiceDto): Promise<Invoice> {
    return this.invoicesService.create(dto);
  }

  private async getInvoiceWithParties(invoiceId: string): Promise<{
    invoice: Invoice;
    company: Company;
    customer: Customer;
  }> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['company', 'customer', 'items'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === InvoiceStatus.ISSUED || invoice.immutableFlag) {
      throw new BadRequestException('Invoice is already issued/immutable');
    }

    const company = invoice.companyId
      ? await this.companyRepository.findOne({ where: { id: invoice.companyId } })
      : null;
    const customer = invoice.customerId
      ? await this.customerRepository.findOne({ where: { id: invoice.customerId } })
      : null;

    if (!company || !customer) {
      throw new BadRequestException('Company or customer is missing');
    }

    return { invoice, company, customer };
  }

  private async buildSignedInvoice(invoiceId: string): Promise<{
    invoice: Invoice;
    uuid: string;
    invoiceHash: string;
    signedXml: string;
    xml: string;
    company: Company;
    customer: Customer;
    chainHash: string;
  }> {
    const { invoice, company, customer } = await this.getInvoiceWithParties(invoiceId);
    const pih = await this.hashChainService.getPreviousDocumentHash(invoice.companyId);
    const { xml, uuid, invoiceTypeCode } = this.ubl21ZatcaService.generateInvoiceXml(
      invoice,
      company,
      customer,
      pih,
    );

    const { privateKeyPath } = this.invoiceCryptoService.ensureKeyPair(invoice.companyId);
    const invoiceHash = this.invoiceCryptoService.computeInvoiceHash(xml);
    const signature = this.invoiceCryptoService.signInvoiceHash(invoiceHash, privateKeyPath);
    const signatureExtension = this.invoiceCryptoService.buildSignedPropertiesXml(
      signature,
      invoiceHash,
    );
    const signedXml = this.ubl21ZatcaService.injectSignatureExtension(xml, signatureExtension);

    const generatedChainHash = this.hashChainService.generateInvoiceHash(invoice, pih);
    const qr = await this.qrCodeService.generateInvoiceQRCode(
      company.name,
      company.vatNumber,
      invoice.issueDateTime,
      Number(invoice.totalAmount),
      Number(invoice.vatAmount),
    );

    const storagePaths = this.invoiceStorageService.persistInvoiceArtifacts(invoice, {
      jsonData: invoice as unknown as Record<string, any>,
      xmlContent: xml,
      signedXmlContent: signedXml,
      hash: generatedChainHash,
    });

    await this.invoiceRepository.update(invoice.id, {
      zatcaUuid: uuid,
      invoiceTypeCode,
      pih,
      previousHash: pih,
      invoiceHash,
      currentHash: generatedChainHash,
      xmlContent: xml,
      signedXmlContent: signedXml,
      xmlPath: storagePaths.xmlPath,
      signedXmlPath: storagePaths.signedXmlPath,
      jsonPath: storagePaths.jsonPath,
      qrCodeData: qr.tlvData,
      qrCode: qr.image,
    });

    const reloaded = await this.invoiceRepository.findOne({
      where: { id: invoice.id },
      relations: ['items', 'company', 'customer'],
    });
    if (!reloaded) {
      throw new NotFoundException('Invoice disappeared during processing');
    }

    return {
      invoice: reloaded,
      uuid,
      invoiceHash,
      signedXml,
      xml,
      company,
      customer,
      chainHash: generatedChainHash,
    };
  }

  async clear(dto: ProcessCompliantInvoiceDto): Promise<any> {
    const signed = await this.buildSignedInvoice(dto.invoiceId);
    const payload = {
      invoiceHash: signed.invoiceHash,
      uuid: signed.uuid,
      invoice: Buffer.from(signed.signedXml, 'utf-8').toString('base64'),
    };
    const zatcaResponse = await this.zatcaIntegrationService.submitForClearance(payload);

    await this.invoiceRepository.update(signed.invoice.id, {
      status: InvoiceStatus.ISSUED,
      immutableFlag: true,
      zatcaStatus: 'CLEARED',
      zatcaResponse,
    });

    this.invoiceStorageService.persistInvoiceArtifacts(signed.invoice, {
      jsonData: signed.invoice as unknown as Record<string, any>,
      xmlContent: signed.xml,
      signedXmlContent: signed.signedXml,
      hash: signed.chainHash,
      zatcaResponse,
    });

    return this.invoiceRepository.findOne({
      where: { id: signed.invoice.id },
      relations: ['company', 'customer', 'items'],
    });
  }

  async report(dto: ProcessCompliantInvoiceDto): Promise<any> {
    const signed = await this.buildSignedInvoice(dto.invoiceId);
    const payload = {
      invoiceHash: signed.invoiceHash,
      uuid: signed.uuid,
      invoice: Buffer.from(signed.signedXml, 'utf-8').toString('base64'),
    };
    const zatcaResponse = await this.zatcaIntegrationService.submitForReporting(payload);

    await this.invoiceRepository.update(signed.invoice.id, {
      status: InvoiceStatus.ISSUED,
      immutableFlag: true,
      zatcaStatus: 'REPORTED',
      zatcaResponse,
    });

    this.invoiceStorageService.persistInvoiceArtifacts(signed.invoice, {
      jsonData: signed.invoice as unknown as Record<string, any>,
      xmlContent: signed.xml,
      signedXmlContent: signed.signedXml,
      hash: signed.chainHash,
      zatcaResponse,
    });

    return this.invoiceRepository.findOne({
      where: { id: signed.invoice.id },
      relations: ['company', 'customer', 'items'],
    });
  }
}

