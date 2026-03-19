import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { QrCodeService } from '../../services/qr-code.service';
import { HashChainService } from '../../services/hash-chain.service';
import { InvoiceSequenceService } from '../../services/invoice-sequence.service';
import { XmlGeneratorService } from '../../services/xml-generator.service';
import { PdfGeneratorService } from '../../services/pdf-generator.service';
import { ZatcaSdkService, ZatcaValidationResult } from '../../services/zatca-sdk.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction } from '../../entities/audit-log.entity';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private dataSource: DataSource,
    private qrCodeService: QrCodeService,
    private hashChainService: HashChainService,
    private invoiceSequenceService: InvoiceSequenceService,
    private xmlGeneratorService: XmlGeneratorService,
    private pdfGeneratorService: PdfGeneratorService,
    private zatcaSdkService: ZatcaSdkService,
    private auditLogsService: AuditLogsService,
    private configService: ConfigService,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    // Validate company and customer exist
    const company = await this.companyRepository.findOne({
      where: { id: createInvoiceDto.companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const customer = await this.customerRepository.findOne({
      where: { id: createInvoiceDto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Calculate totals
    let subtotal = 0;
    const items = createInvoiceDto.items.map((itemDto) => {
      const vatRate = itemDto.vatRate || 15; // Default 15% VAT for Saudi Arabia
      const lineTotal = itemDto.quantity * itemDto.unitPrice;
      const vatAmount = (lineTotal * vatRate) / 100;
      subtotal += lineTotal;

      return this.invoiceItemRepository.create({
        name: itemDto.name,
        description: itemDto.description,
        quantity: itemDto.quantity,
        unitPrice: itemDto.unitPrice,
        vatRate,
        vatAmount,
        lineTotal: lineTotal + vatAmount,
      });
    });

    const vatAmount = items.reduce((sum, item) => sum + item.vatAmount, 0);
    const totalAmount = subtotal + vatAmount;

    // ZATCA Phase 1: sequential per-company invoice number
    const invoiceNumber =
      createInvoiceDto.invoiceNumber ||
      (await this.invoiceSequenceService.getNextInvoiceNumber(createInvoiceDto.companyId));

    // Create invoice
    const invoice = this.invoiceRepository.create({
      invoiceNumber,
      issueDateTime: createInvoiceDto.issueDateTime || new Date(),
      companyId: createInvoiceDto.companyId,
      customerId: createInvoiceDto.customerId,
      subtotal,
      vatAmount,
      totalAmount,
      status: InvoiceStatus.DRAFT,
      items,
    });

    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Log audit
    await this.auditLogsService.create({
      entityType: 'invoice',
      entityId: savedInvoice.id,
      action: AuditAction.CREATE,
      description: `Invoice ${invoiceNumber} created`,
    });

    return this.findOne(savedInvoice.id);
  }

  async findAll(): Promise<Invoice[]> {
    return await this.invoiceRepository.find({
      relations: ['company', 'customer', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['company', 'customer', 'items'],
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return invoice;
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(id);

    // Check immutability
    if (invoice.immutableFlag) {
      throw new BadRequestException('Invoice is immutable and cannot be modified');
    }

    if (invoice.status === InvoiceStatus.ISSUED) {
      throw new BadRequestException('Issued invoices cannot be modified');
    }

    // Explicitly prevent modification of protected fields that should never change
    const protectedFields = [
      'currentHash',
      'previousHash',
      'status',
      'immutableFlag',
      'invoiceNumber',
      'xmlContent',
      'xmlPath',
      'pdfPath',
      'qrCode',
      'qrCodeData',
    ];

    for (const field of protectedFields) {
      if ((updateInvoiceDto as any)[field] !== undefined) {
        throw new BadRequestException(
          `Field '${field}' is protected and cannot be modified directly`,
        );
      }
    }

    // Update items if provided
    if (updateInvoiceDto.items) {
      // Delete existing items
      await this.invoiceItemRepository.delete({ invoiceId: id });

      // Calculate new totals
      let subtotal = 0;
      const items = updateInvoiceDto.items.map((itemDto) => {
        const vatRate = itemDto.vatRate || 15;
        const lineTotal = itemDto.quantity * itemDto.unitPrice;
        const vatAmount = (lineTotal * vatRate) / 100;
        subtotal += lineTotal;

        return this.invoiceItemRepository.create({
          invoiceId: id,
          name: itemDto.name,
          description: itemDto.description,
          quantity: itemDto.quantity,
          unitPrice: itemDto.unitPrice,
          vatRate,
          vatAmount,
          lineTotal: lineTotal + vatAmount,
        });
      });

      const vatAmount = items.reduce((sum, item) => sum + item.vatAmount, 0);
      const totalAmount = subtotal + vatAmount;

      invoice.subtotal = subtotal;
      invoice.vatAmount = vatAmount;
      invoice.totalAmount = totalAmount;
      invoice.items = await this.invoiceItemRepository.save(items);
    }

    // Update other fields
    if (updateInvoiceDto.issueDateTime) {
      invoice.issueDateTime = new Date(updateInvoiceDto.issueDateTime);
    }

    const updatedInvoice = await this.invoiceRepository.save(invoice);

    // Log audit
    await this.auditLogsService.create({
      entityType: 'invoice',
      entityId: id,
      action: AuditAction.UPDATE,
      description: `Invoice ${invoice.invoiceNumber} updated`,
    });

    return this.findOne(updatedInvoice.id);
  }

  async issue(id: string, issueInvoiceDto: IssueInvoiceDto): Promise<Invoice> {
    try {
      const invoice = await this.findOne(id);

      if (invoice.status === InvoiceStatus.ISSUED) {
        throw new BadRequestException('Invoice is already issued');
      }

      if (invoice.immutableFlag) {
        throw new BadRequestException('Invoice is immutable');
      }

      if (!invoice.company) {
        throw new BadRequestException('Company information is missing');
      }

      if (!invoice.customer) {
        throw new BadRequestException('Customer information is missing');
      }

      const company = invoice.company;
      const customer = invoice.customer;

      // Get previous hash for chaining (includes invoices and notes)
      const previousHash = await this.hashChainService.getPreviousDocumentHash(
        invoice.companyId,
      );

      // Generate current hash
      const currentHash = this.hashChainService.generateInvoiceHash(
        invoice,
        previousHash,
      );

      invoice.previousHash = previousHash;
      invoice.currentHash = currentHash;

      // Generate QR code for simplified invoices (B2C)
      if (customer.type && customer.type === 'B2C') {
        try {
          const qrCode = await this.qrCodeService.generateInvoiceQRCode(
            company.name,
            company.vatNumber,
            invoice.issueDateTime,
            invoice.totalAmount,
            invoice.vatAmount,
          );
          invoice.qrCode = qrCode.image;
          invoice.qrCodeData = qrCode.tlvData;
        } catch (error) {
          console.error('Error generating QR code:', error);
          // Continue without QR code if generation fails
        }
      }

      // ZATCA Phase 1: ProfileID 01 = standard (B2B), 02 = simplified (B2C)
      const profileID = customer.type === 'B2C' ? '02' : '01';
      const documentTypeLabel =
        customer.type === 'B2C' ? 'Simplified Tax Invoice' : 'Tax Invoice';

      // Generate XML with ProfileID and supplier/buyer address
      let xmlContent: string;
      try {
        xmlContent = this.xmlGeneratorService.generateUBLInvoice(
          invoice,
          company,
          customer,
          { profileID },
        );
        invoice.xmlContent = xmlContent;

        const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
        const xmlPath = path.join(
          storagePath,
          'xml',
          `${invoice.invoiceNumber}.xml`,
        );
        const xmlDir = path.dirname(xmlPath);
        if (!fs.existsSync(xmlDir)) {
          fs.mkdirSync(xmlDir, { recursive: true });
        }
        fs.writeFileSync(xmlPath, xmlContent, 'utf-8');
        invoice.xmlPath = xmlPath;

        // Optional: sign XML with ZATCA SDK (set ZATCA_SIGN_INVOICES=true to enable)
        const signEnabled = this.configService.get<string>('ZATCA_SIGN_INVOICES', 'false') === 'true';
        if (signEnabled && this.zatcaSdkService.isAvailable()) {
          const signResult = await this.zatcaSdkService.signInvoiceXml(xmlPath, xmlPath);
          if (signResult.success && signResult.signedPath && fs.existsSync(signResult.signedPath)) {
            invoice.xmlContent = fs.readFileSync(signResult.signedPath, 'utf-8');
          }
        }
      } catch (error) {
        console.error('Error generating XML:', error);
      }

      // Generate PDF with invoice type description
      try {
        const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
        const pdfPath = path.join(
          storagePath,
          'pdf',
          `${invoice.invoiceNumber}.pdf`,
        );
        const pdfDir = path.dirname(pdfPath);
        if (!fs.existsSync(pdfDir)) {
          fs.mkdirSync(pdfDir, { recursive: true });
        }
        await this.pdfGeneratorService.generateInvoicePDF(
          invoice,
          company,
          customer,
          pdfPath,
          documentTypeLabel,
        );
        invoice.pdfPath = pdfPath;
      } catch (error) {
        console.error('Error generating PDF:', error);
      }

      // Prepare all fields to update
      // Use update() instead of save() to bypass BeforeUpdate hook
      const updateData: any = {
        status: InvoiceStatus.ISSUED,
        immutableFlag: true,
        previousHash: previousHash,
        currentHash: currentHash,
      };

      // Add optional fields if they exist
      if (invoice.qrCode) {
        updateData.qrCode = invoice.qrCode;
        updateData.qrCodeData = invoice.qrCodeData;
      }

      if (invoice.xmlContent) {
        updateData.xmlContent = invoice.xmlContent;
      }

      if (invoice.xmlPath) {
        updateData.xmlPath = invoice.xmlPath;
      }

      if (invoice.pdfPath) {
        updateData.pdfPath = invoice.pdfPath;
      }

      // Use update() to bypass BeforeUpdate hook
      await this.invoiceRepository.update(id, updateData);

      // Fetch the updated invoice
      const issuedInvoice = await this.findOne(id);

      // Log audit
      try {
        await this.auditLogsService.create({
          entityType: 'invoice',
          entityId: id,
          action: AuditAction.ISSUE,
          description: `Invoice ${invoice.invoiceNumber} issued`,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: invoice.totalAmount,
            hash: currentHash,
          },
        });
      } catch (error) {
        console.error('Error creating audit log:', error);
        // Continue even if audit log fails
      }

      return issuedInvoice;
    } catch (error) {
      console.error('Error issuing invoice:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to issue invoice: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const invoice = await this.findOne(id);

    await this.invoiceRepository.remove(invoice);

    // Log audit
    await this.auditLogsService.create({
      entityType: 'invoice',
      entityId: id,
      action: AuditAction.DELETE,
      description: `Invoice ${invoice.invoiceNumber} deleted`,
    });
  }

  async validateHashChain(companyId: string): Promise<boolean> {
    return await this.hashChainService.validateHashChain(companyId);
  }

  /**
   * Validate an issued invoice's XML against ZATCA business rules using the local SDK CLI.
   * Requires ZATCA SDK JAR in backend/zatca-envoice-sdk-203/Apps/ and Java 21 or 22.
   * If the XML file is missing but xmlContent is stored, it is written to storage/xml first.
   */
  async validateWithZatcaSdk(id: string): Promise<ZatcaValidationResult> {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Only issued invoices can be validated with ZATCA SDK');
    }
    let xmlPath = invoice.xmlPath;
    const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
    const expectedXmlPath = path.join(storagePath, 'xml', `${invoice.invoiceNumber}.xml`);

    if (!invoice.xmlContent) {
      throw new BadRequestException(
        'Invoice has no XML content. Re-issue the invoice to generate XML.',
      );
    }

    if (!xmlPath || !fs.existsSync(path.isAbsolute(xmlPath) ? xmlPath : path.resolve(xmlPath))) {
      const dir = path.dirname(expectedXmlPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(expectedXmlPath, invoice.xmlContent, 'utf-8');
      xmlPath = expectedXmlPath;
    }

    const absolutePath = path.isAbsolute(xmlPath) ? xmlPath : path.resolve(xmlPath);
    return this.zatcaSdkService.validateInvoiceXml(absolutePath);
  }

  async getInvoicePdfForDownload(id: string): Promise<{ absolutePath: string; filename: string }> {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('PDF is available only for issued invoices');
    }

    const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
    const allowedDir = path.resolve(storagePath, 'pdf');
    const expectedPath = path.resolve(allowedDir, `${invoice.invoiceNumber}.pdf`);
    const resolvedPath = invoice.pdfPath ? path.resolve(invoice.pdfPath) : expectedPath;
    if (!resolvedPath.startsWith(allowedDir + path.sep)) {
      throw new BadRequestException('Invalid PDF path');
    }

    // If missing, regenerate PDF for issued invoices (supports older records)
    if (!invoice.pdfPath || !fs.existsSync(resolvedPath)) {
      const dir = path.dirname(expectedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const documentTypeLabel =
        invoice.customer?.type === 'B2C' ? 'Simplified Tax Invoice' : 'Tax Invoice';
      await this.pdfGeneratorService.generateInvoicePDF(
        invoice,
        invoice.company,
        invoice.customer,
        expectedPath,
        documentTypeLabel,
      );
      await this.invoiceRepository.update(id, { pdfPath: expectedPath });
      if (!fs.existsSync(expectedPath)) {
        throw new NotFoundException('PDF file not found on disk');
      }
      return { absolutePath: expectedPath, filename: `${invoice.invoiceNumber}.pdf` };
    }
    return {
      absolutePath: resolvedPath,
      filename: `${invoice.invoiceNumber}.pdf`,
    };
  }

  /** Check if ZATCA SDK CLI is available for local validation. */
  isZatcaSdkAvailable(): boolean {
    return this.zatcaSdkService.isAvailable();
  }
}
