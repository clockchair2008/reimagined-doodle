import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { Invoice } from '../entities/invoice.entity';
import { Company } from '../entities/company.entity';
import { Customer } from '../entities/customer.entity';
import { CreditNote } from '../entities/credit-note.entity';
import { DebitNote } from '../entities/debit-note.entity';
import * as fs from 'fs';
import * as path from 'path';

// Bilingual labels (English / Arabic) for ZATCA Saudi invoices
const LABELS = {
  taxInvoice: { en: 'Tax Invoice', ar: 'فاتورة ضريبية' },
  simplifiedTaxInvoice: { en: 'Simplified Tax Invoice', ar: 'فاتورة ضريبية مبسطة' },
  creditNote: { en: 'Credit Note', ar: 'إشعار دائن' },
  debitNote: { en: 'Debit Note', ar: 'إشعار مدين' },
  invoiceNo: { en: 'Invoice No', ar: 'رقم الفاتورة' },
  issueDate: { en: 'Issue Date', ar: 'تاريخ الإصدار' },
  fromSeller: { en: 'From (Seller)', ar: 'البيانات البائع' },
  toBuyer: { en: 'To (Buyer)', ar: 'بيانات العميل' },
  vat: { en: 'VAT', ar: 'الرقم الضريبي' },
  address: { en: 'Address', ar: 'العنوان' },
  contact: { en: 'Contact', ar: 'رقم الاتصال' },
  customerName: { en: 'Customer Name', ar: 'اسم العميل' },
  customerAddress: { en: 'Customer Address', ar: 'عنوان العميل' },
  no: { en: 'No', ar: 'م' },
  itemNo: { en: 'Item No', ar: 'رقم الصنف' },
  itemName: { en: 'Item Name', ar: 'اسم الصنف' },
  unit: { en: 'Unit', ar: 'الوحدة' },
  quantity: { en: 'Quantity', ar: 'الكمية' },
  price: { en: 'Price', ar: 'السعر' },
  discount: { en: 'Discount', ar: 'الخصم' },
  tax: { en: 'Tax', ar: 'الضريبة' },
  total: { en: 'Total', ar: 'الاجمالي' },
  subtotal: { en: 'Subtotal', ar: 'المجموع قبل الضريبة' },
  vatAmount: { en: 'VAT Amount', ar: 'ضريبة القيمة المضافة' },
  totalAmount: { en: 'Total Amount due', ar: 'الصافي بعد الضريبة' },
  amountInWords: { en: 'Amount in Words', ar: 'المبلغ كتابة' },
  piece: { en: 'Piece', ar: 'حبة' },
  sar: { en: 'SAR', ar: 'ر.س' },
  zatcaQr: { en: 'ZATCA QR', ar: 'رمز ZATCA' },
  footer: { en: 'Electronically generated invoice (ZATCA Phase 1). No signature required for print.', ar: 'فاتورة إلكترونية (مرحلة زاتكا 1). لا يتطلب توقيع للطباعة.' },
};

function amountToArabicWords(amount: number): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Tafgeet = require('tafgeetjs');
    return new Tafgeet(amount, 'SAR').parse() || `${amount.toFixed(2)} ريال سعودي`;
  } catch {
    return `${amount.toFixed(2)} ريال سعودي`;
  }
}

interface DocumentForPdf {
  invoiceNumber?: string;
  noteNumber?: string;
  issueDateTime: Date;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  qrCode?: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number; vatRate: number; lineTotal: number }>;
}

@Injectable()
export class PdfGeneratorService {
  /**
   * Generate PDF for invoice or note. documentTypeLabel: e.g. "Tax Invoice", "Simplified Tax Invoice", "Credit Note", "Debit Note".
   */
  async generateInvoicePDF(
    invoice: Invoice,
    company: Company,
    customer: Customer,
    outputPath: string,
    documentTypeLabel: string = 'Tax Invoice',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Register Arabic font (Amiri) – use for ALL text so Arabic renders correctly
      const fontPath = path.resolve(process.cwd(), 'fonts', 'Amiri-Regular.ttf');
      const hasAmiri = fs.existsSync(fontPath);
      if (hasAmiri) {
        doc.registerFont('Amiri', fontPath);
        doc.font('Amiri');
      }

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const contentWidth = pageRight - pageLeft;

      const docTypeLabel =
        documentTypeLabel.toLowerCase().includes('simplified')
          ? LABELS.simplifiedTaxInvoice
          : LABELS.taxInvoice;

      // Header – bilingual: Tax Invoice / فاتورة ضريبية
      doc.fontSize(18);
      doc.text(docTypeLabel.en.toUpperCase(), pageLeft, doc.y, { align: 'left' });
      if (hasAmiri) {
        doc.moveDown(0.3);
        doc.fontSize(14).text(docTypeLabel.ar, pageLeft, doc.y, { align: 'left' });
      }

      // Invoice meta (right) – bilingual
      const issueDateStr = `${invoice.issueDateTime.toLocaleDateString('en-GB')} ${invoice.issueDateTime.toLocaleTimeString('en-GB')}`;
      doc.fontSize(10);
      doc.text(
        hasAmiri ? `${LABELS.invoiceNo.en}: ${invoice.invoiceNumber} | ${LABELS.invoiceNo.ar}: ${invoice.invoiceNumber}` : `${LABELS.invoiceNo.en}: ${invoice.invoiceNumber}`,
        pageLeft,
        54,
        { align: 'right', width: contentWidth },
      );
      doc.text(`${LABELS.issueDate.en}: ${issueDateStr}`, pageLeft, doc.y, {
        align: 'right',
        width: contentWidth,
      });

      doc.moveDown(1.2);

      // QR (top-left, ZATCA style) – before seller/buyer
      let qrY = 86;
      if (invoice.qrCode) {
        try {
          const base64Data = invoice.qrCode.replace(/^data:image\/png;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          const qrSize = 100;
          const qrX = pageLeft;
          doc.image(imageBuffer, qrX, qrY, { fit: [qrSize, qrSize] });
          doc.fontSize(8).fillColor('#6b7280');
          doc.text(hasAmiri ? docTypeLabel.ar : LABELS.zatcaQr.en, qrX, qrY + qrSize + 4, { width: qrSize, align: 'center' });
          doc.fillColor('#000000');
        } catch {
          // ignore QR rendering failures
        }
      }

      // Seller / Buyer blocks – bilingual labels
      const blockTop = doc.y;
      const colGap = 18;
      const colWidth = (contentWidth - colGap) / 2;

      // Seller
      doc.fontSize(11);
      doc.text(hasAmiri ? `${LABELS.fromSeller.en} / ${LABELS.fromSeller.ar}` : LABELS.fromSeller.en, pageLeft, blockTop);
      doc.fontSize(10);
      doc.text(company.name, pageLeft, doc.y);
      if (company.address) doc.text(company.address, pageLeft);
      if (company.city || company.postalCode)
        doc.text(`${company.city || ''}${company.city && company.postalCode ? ', ' : ''}${company.postalCode || ''}`, pageLeft);
      doc.text(`${LABELS.vat.en}: ${company.vatNumber}`, pageLeft);

      // Buyer (Customer data – بيانات العميل)
      const buyerX = pageLeft + colWidth + colGap;
      doc.fontSize(11);
      doc.text(hasAmiri ? `${LABELS.toBuyer.en} / ${LABELS.toBuyer.ar}` : LABELS.toBuyer.en, buyerX, blockTop);
      doc.fontSize(10);
      doc.text(`${LABELS.customerName.en}: ${customer.name}`, buyerX, doc.y);
      if (customer.address) doc.text(hasAmiri ? `${LABELS.customerAddress.en}: ${customer.address}` : customer.address, buyerX);
      if (customer.city || customer.postalCode)
        doc.text(`${customer.city || ''}${customer.city && customer.postalCode ? ', ' : ''}${customer.postalCode || ''}`, buyerX);
      if (customer.vatNumber) doc.text(`${LABELS.vat.en}: ${customer.vatNumber}`, buyerX);

      doc.y = Math.max(doc.y, blockTop + 90);
      doc.moveDown(0.8);

      // Items table – bilingual headers
      const tableY = doc.y;
      const colNo = 28;
      const colDesc = Math.floor(contentWidth * 0.38);
      const colQty = Math.floor(contentWidth * 0.10);
      const colUnit = Math.floor(contentWidth * 0.12);
      const colVat = Math.floor(contentWidth * 0.12);
      const colTotal = contentWidth - (colNo + colDesc + colQty + colUnit + colVat);

      const xNo = pageLeft;
      const xDesc = xNo + colNo;
      const xQty = xDesc + colDesc;
      const xUnit = xQty + colQty;
      const xVat = xUnit + colUnit;
      const xTotal = xVat + colVat;

      doc.fontSize(9);
      doc.text(hasAmiri ? `${LABELS.no.en}\n${LABELS.no.ar}` : LABELS.no.en, xNo, tableY, { width: colNo });
      doc.text(hasAmiri ? `${LABELS.itemName.en}\n${LABELS.itemName.ar}` : LABELS.itemName.en, xDesc, tableY, { width: colDesc });
      doc.text(hasAmiri ? `${LABELS.quantity.en}\n${LABELS.quantity.ar}` : LABELS.quantity.en, xQty, tableY, { width: colQty, align: 'right' });
      doc.text(hasAmiri ? `${LABELS.unit.en}\n${LABELS.unit.ar}` : LABELS.unit.en, xUnit, tableY, { width: colUnit, align: 'right' });
      doc.text(hasAmiri ? `${LABELS.tax.en}\n${LABELS.tax.ar}` : LABELS.tax.en, xVat, tableY, { width: colVat, align: 'right' });
      doc.text(hasAmiri ? `${LABELS.total.en}\n${LABELS.total.ar}` : LABELS.total.en, xTotal, tableY, { width: colTotal, align: 'right' });

      doc
        .moveTo(pageLeft, tableY + 20)
        .lineTo(pageRight, tableY + 20)
        .lineWidth(1)
        .strokeColor('#e5e7eb')
        .stroke()
        .strokeColor('#000000');

      doc.fontSize(10);
      let y = tableY + 28;
      invoice.items.forEach((item, idx) => {
        const rowHeight = 18;
        doc.text(String(idx + 1), xNo, y, { width: colNo });
        doc.text(item.name, xDesc, y, { width: colDesc });
        doc.text(String(item.quantity), xQty, y, { width: colQty, align: 'right' });
        doc.text(LABELS.piece.en, xUnit, y, { width: colUnit, align: 'right' });
        doc.text(`${Number(item.vatRate)}%`, xVat, y, { width: colVat, align: 'right' });
        doc.text(Number(item.lineTotal).toFixed(2), xTotal, y, { width: colTotal, align: 'right' });
        y += rowHeight;
      });

      // Totals box (right) – bilingual
      y += 10;
      const totalsWidth = Math.min(280, contentWidth);
      const totalsX = pageRight - totalsWidth;
      doc
        .moveTo(totalsX, y)
        .lineTo(pageRight, y)
        .lineWidth(1)
        .strokeColor('#e5e7eb')
        .stroke()
        .strokeColor('#000000');
      y += 8;

      const subtotal = Number(invoice.subtotal);
      const vatAmount = Number(invoice.vatAmount);
      const total = Number(invoice.totalAmount);

      // Totals – label left, amount right (avoid overlap)
      doc.fontSize(10);
      doc.text(hasAmiri ? `${LABELS.subtotal.en} / ${LABELS.subtotal.ar}` : LABELS.subtotal.en, totalsX, y, { width: totalsWidth - 95 });
      doc.text(subtotal.toFixed(2) + ' ' + LABELS.sar.en, totalsX, y, { width: totalsWidth, align: 'right' });
      y += 14;
      doc.text(hasAmiri ? `${LABELS.vatAmount.en} (15%) / ${LABELS.vatAmount.ar}` : `${LABELS.vatAmount.en} (15%)`, totalsX, y, { width: totalsWidth - 95 });
      doc.text(vatAmount.toFixed(2) + ' ' + LABELS.sar.en, totalsX, y, { width: totalsWidth, align: 'right' });
      y += 16;
      doc.fontSize(11);
      doc.text(hasAmiri ? `${LABELS.totalAmount.en} / ${LABELS.totalAmount.ar}` : LABELS.totalAmount.en, totalsX, y, { width: totalsWidth - 95 });
      doc.text(total.toFixed(2) + ' ' + LABELS.sar.en, totalsX, y, { width: totalsWidth, align: 'right' });

      // Amount in Words (المبلغ كتابة)
      y += 20;
      const amountWords = amountToArabicWords(total);
      doc.fontSize(11);
      doc.text(hasAmiri ? `${LABELS.amountInWords.ar}: ${amountWords}` : `Amount: ${total.toFixed(2)} SAR`, pageLeft, y, { width: contentWidth * 0.65 });

      // Footer – bilingual
      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text(
          hasAmiri ? `${LABELS.footer.en} | ${LABELS.footer.ar}` : LABELS.footer.en,
          pageLeft,
          doc.page.height - 42,
          { width: contentWidth, align: 'center' },
        )
        .fillColor('#000000');

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  async generateCreditNotePDF(
    note: CreditNote,
    company: Company,
    customer: Customer,
    outputPath: string,
  ): Promise<string> {
    const doc: DocumentForPdf = {
      noteNumber: note.noteNumber,
      issueDateTime: note.issueDateTime,
      subtotal: Number(note.subtotal),
      vatAmount: Number(note.vatAmount),
      totalAmount: Number(note.totalAmount),
      qrCode: note.qrCode,
      items: note.items || [],
    };
    return this.generateNotePdf(doc, company, customer, outputPath, 'Credit Note');
  }

  async generateDebitNotePDF(
    note: DebitNote,
    company: Company,
    customer: Customer,
    outputPath: string,
  ): Promise<string> {
    const doc: DocumentForPdf = {
      noteNumber: note.noteNumber,
      issueDateTime: note.issueDateTime,
      subtotal: Number(note.subtotal),
      vatAmount: Number(note.vatAmount),
      totalAmount: Number(note.totalAmount),
      qrCode: note.qrCode,
      items: note.items || [],
    };
    return this.generateNotePdf(doc, company, customer, outputPath, 'Debit Note');
  }

  private async generateNotePdf(
    doc: DocumentForPdf,
    company: Company,
    customer: Customer,
    outputPath: string,
    documentTypeLabel: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const pdf = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      pdf.pipe(stream);

      const fontPath = path.resolve(process.cwd(), 'fonts', 'Amiri-Regular.ttf');
      const hasAmiri = fs.existsSync(fontPath);
      if (hasAmiri) {
        pdf.registerFont('Amiri', fontPath);
        pdf.font('Amiri');
      }

      const docTypeLabel =
        documentTypeLabel.toLowerCase().includes('credit')
          ? LABELS.creditNote
          : LABELS.debitNote;

      const docNumber = doc.noteNumber ?? doc.invoiceNumber ?? '';
      const issueDateStr = `${new Date(doc.issueDateTime).toLocaleDateString('en-GB')} ${new Date(doc.issueDateTime).toLocaleTimeString('en-GB')}`;

      pdf.fontSize(20).text(docTypeLabel.en.toUpperCase(), { align: 'center' });
      if (hasAmiri) pdf.fontSize(14).text(docTypeLabel.ar, { align: 'center' });
      pdf.moveDown();
      pdf.fontSize(14).text(company.name);
      if (company.address) pdf.fontSize(10).text(company.address);
      if (company.city) pdf.fontSize(10).text(`${company.city}, ${company.postalCode || ''}`);
      pdf.fontSize(10).text(hasAmiri ? `${LABELS.vat.en}: ${company.vatNumber} | ${LABELS.vat.ar}: ${company.vatNumber}` : `VAT: ${company.vatNumber}`);
      pdf.moveDown();
      pdf.fontSize(12).text(hasAmiri ? `${LABELS.invoiceNo.en}: ${docNumber} | ${LABELS.invoiceNo.ar}: ${docNumber}` : `Document: ${docNumber}`);
      pdf.fontSize(10).text(`${LABELS.issueDate.en}: ${issueDateStr}`);
      pdf.moveDown();
      pdf.fontSize(12).text(hasAmiri ? `${LABELS.toBuyer.en} / ${LABELS.toBuyer.ar}` : LABELS.toBuyer.en, { underline: true });
      pdf.fontSize(10).text(`${LABELS.customerName.en}: ${customer.name}`);
      if (customer.address) pdf.fontSize(10).text(hasAmiri ? `${LABELS.customerAddress.en}: ${customer.address}` : customer.address);
      if (customer.vatNumber) pdf.fontSize(10).text(`VAT: ${customer.vatNumber}`);
      pdf.moveDown();
      pdf.fontSize(12).text(hasAmiri ? `${LABELS.itemName.en} / ${LABELS.itemName.ar}` : LABELS.itemName.en, { underline: true });
      pdf.moveDown(0.5);
      const tableTop = pdf.y;
      pdf.fontSize(10);
      pdf.text(hasAmiri ? `${LABELS.itemName.en}\n${LABELS.itemName.ar}` : LABELS.itemName.en, 50, tableTop);
      pdf.text(hasAmiri ? `${LABELS.quantity.en}\n${LABELS.quantity.ar}` : LABELS.quantity.en, 300, tableTop);
      pdf.text(hasAmiri ? `${LABELS.price.en}\n${LABELS.price.ar}` : LABELS.price.en, 350, tableTop);
      pdf.text(hasAmiri ? `${LABELS.tax.en}\n${LABELS.tax.ar}` : LABELS.tax.en, 420, tableTop);
      pdf.text(hasAmiri ? `${LABELS.total.en}\n${LABELS.total.ar}` : LABELS.total.en, 480, tableTop);
      let y = tableTop + 20;
      doc.items.forEach((item) => {
        pdf.text(item.name, 50, y);
        pdf.text(item.quantity.toString(), 300, y);
        pdf.text(Number(item.unitPrice).toFixed(2), 350, y);
        pdf.text(`${item.vatRate}%`, 420, y);
        pdf.text(Number(item.lineTotal).toFixed(2), 480, y);
        y += 20;
      });
      y += 10;
      pdf.text(hasAmiri ? `${LABELS.subtotal.en} / ${LABELS.subtotal.ar}` : LABELS.subtotal.en, 350, y);
      pdf.text(doc.subtotal.toFixed(2) + ' ' + LABELS.sar.en, 480, y);
      y += 15;
      pdf.text(hasAmiri ? `${LABELS.vatAmount.en} / ${LABELS.vatAmount.ar}` : LABELS.vatAmount.en, 350, y);
      pdf.text(doc.vatAmount.toFixed(2) + ' ' + LABELS.sar.en, 480, y);
      y += 15;
      pdf.fontSize(12).text(hasAmiri ? `${LABELS.totalAmount.en} / ${LABELS.totalAmount.ar}` : LABELS.totalAmount.en, 350, y);
      pdf.fontSize(12).text(doc.totalAmount.toFixed(2) + ' ' + LABELS.sar.en, 480, y);
      y += 20;
      const amountWords = amountToArabicWords(doc.totalAmount);
      pdf.fontSize(11);
      pdf.text(hasAmiri ? `${LABELS.amountInWords.ar}: ${amountWords}` : `Amount: ${doc.totalAmount.toFixed(2)} SAR`, 50, y);
      if (doc.qrCode) {
        pdf.moveDown(2);
        pdf.fontSize(10).text(hasAmiri ? `${LABELS.zatcaQr.en} / ${LABELS.zatcaQr.ar}` : LABELS.zatcaQr.en, { align: 'center' });
        const base64 = doc.qrCode.replace(/^data:image\/png;base64,/, '');
        pdf.image(Buffer.from(base64, 'base64'), { fit: [150, 150], align: 'center' });
      }
      pdf.fontSize(8).text(hasAmiri ? `${LABELS.footer.en} | ${LABELS.footer.ar}` : LABELS.footer.en, { align: 'center' }, pdf.page.height - 50);
      pdf.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }
}
