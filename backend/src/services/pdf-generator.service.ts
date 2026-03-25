import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { Invoice } from '../entities/invoice.entity';
import { Company } from '../entities/company.entity';
import { Customer } from '../entities/customer.entity';
import { CreditNote } from '../entities/credit-note.entity';
import { DebitNote } from '../entities/debit-note.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import * as fs from 'fs';
import * as path from 'path';

/** Arabic Rial Sign (U+FDFC) — used in KSA invoices instead of “SAR” */
const RIYAL = '\uFDFC';

// Bilingual labels aligned with common ZATCA bilingual invoice samples
const LABELS = {
  taxInvoice: { en: 'Tax Invoice', ar: 'فاتورة ضريبية' },
  simplifiedTaxInvoice: { en: 'Simplified Tax Invoice', ar: 'فاتورة ضريبية مبسطة' },
  creditNote: { en: 'Credit Note', ar: 'إشعار دائن' },
  debitNote: { en: 'Debit Note', ar: 'إشعار مدين' },
  invoiceNo: { en: 'Invoice number', ar: 'رقم الفاتورة' },
  issueDate: { en: 'Date', ar: 'التاريخ' },
  dueDate: { en: 'Due date', ar: 'تاريخ الاستحقاق' },
  orderNumber: { en: 'Order number', ar: 'رقم أمر الشراء' },
  fromSeller: { en: 'From (Seller)', ar: 'البيانات البائع' },
  toBuyer: { en: 'To (Buyer)', ar: 'بيانات العميل' },
  customer: { en: 'Customer', ar: 'العميل' },
  vat: { en: 'VAT number', ar: 'رقم التسجيل الضريبي' },
  address: { en: 'Address', ar: 'العنوان' },
  contact: { en: 'Contact', ar: 'رقم الاتصال' },
  customerName: { en: 'Customer Name', ar: 'اسم العميل' },
  customerAddress: { en: 'Customer Address', ar: 'عنوان العميل' },
  no: { en: '#', ar: '#' },
  itemNo: { en: 'Item No', ar: 'رقم الصنف' },
  itemName: { en: 'Description', ar: 'الوصف' },
  unit: { en: 'Unit', ar: 'الوحدة' },
  quantity: { en: 'Qty', ar: 'الكمية' },
  price: { en: 'Price', ar: 'السعر' },
  taxableAmount: { en: 'Taxable amount', ar: 'المبلغ الخاضع للضريبة' },
  discount: { en: 'Discount', ar: 'الخصم' },
  tax: { en: 'Tax', ar: 'الضريبة' },
  vatColumn: { en: 'VAT amount', ar: 'القيمة المضافة' },
  total: { en: 'Line amount', ar: 'المجموع' },
  subtotal: { en: 'Subtotal', ar: 'المجموع الفرعي' },
  vatAmount: { en: 'Total VAT', ar: 'إجمالي ضريبة القيمة المضافة' },
  totalAmount: { en: 'Total', ar: 'المجموع شامل القيمة المضافة' },
  amountInWords: { en: 'Amount in Words', ar: 'المبلغ كتابة' },
  piece: { en: 'Piece', ar: 'حبة' },
  zatcaQr: { en: 'ZATCA QR', ar: 'رمز ZATCA' },
  zatcaQrNote: {
    en: 'This QR code is encoded as per ZATCA e-invoicing requirements',
    ar: 'تم ترميز هذا الرمز وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك للفواتير الإلكترونية',
  },
  footer: { en: 'Electronically generated invoice (ZATCA Phase 1). No signature required for print.', ar: 'فاتورة إلكترونية (مرحلة زاتكا 1). لا يتطلب توقيع للطباعة.' },
  ksa: { en: 'Kingdom of Saudi Arabia', ar: 'المملكة العربية السعودية' },
  crEn: 'CR Number',
  crAr: 'رقم السجل التجاري',
};

function riyalAmount(value: number): string {
  return `${RIYAL} ${value.toFixed(2)}`;
}

function formatInvoiceDate(d: Date): string {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCustomerAddress(c: Customer): string {
  const line1 = [c.address, c.streetName, c.buildingNumber].filter(Boolean).join(', ');
  const line2 = [c.citySubdivisionName, c.city, c.postalCode].filter(Boolean).join(', ');
  const country = c.country?.trim();
  const parts = [line1, line2, country].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(', ') : '—';
}

function bilingualFieldLabel(en: string, ar: string, hasAmiri: boolean): string {
  return hasAmiri ? `${en} / ${ar}` : en;
}

function decodeLogoBuffer(logo: string | null | undefined): Buffer | null {
  if (!logo || typeof logo !== 'string') return null;
  const m = logo.match(/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,(.+)$/i);
  if (!m) return null;
  try {
    return Buffer.from(m[1], 'base64');
  } catch {
    return null;
  }
}

function lineTaxableAmount(item: InvoiceItem): number {
  return Number(item.quantity) * Number(item.unitPrice);
}

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

      const fontPath = path.resolve(process.cwd(), 'fonts', 'Amiri-Regular.ttf');
      const hasAmiri = fs.existsSync(fontPath);
      if (hasAmiri) {
        doc.registerFont('Amiri', fontPath);
        doc.font('Amiri');
      }

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      const contentWidth = pageRight - pageLeft;

      const docTypeLabel =
        documentTypeLabel.toLowerCase().includes('simplified')
          ? LABELS.simplifiedTaxInvoice
          : LABELS.taxInvoice;

      const countryEn = company.country?.trim() || LABELS.ksa.en;
      const countryAr = LABELS.ksa.ar;

      // —— Header: EN | logo | AR ——
      const headerTop = doc.page.margins.top;
      const third = contentWidth / 3;
      const leftColX = pageLeft;
      const midColX = pageLeft + third;
      const rightColX = pageLeft + 2 * third;
      const lineGap = 13;
      let hy = headerTop;

      doc.fillColor('#000000').fontSize(10);
      doc.text(company.name, leftColX, hy, { width: third - 4 });
      hy += lineGap;
      doc.text(countryEn, leftColX, hy, { width: third - 4 });
      hy += lineGap;
      doc.text(`${LABELS.vat.en} ${company.vatNumber}`, leftColX, hy, { width: third - 4 });
      hy += lineGap;
      if (company.commercialRegistration) {
        doc.text(`${LABELS.crEn} ${company.commercialRegistration}`, leftColX, hy, { width: third - 4 });
      }

      const logoBuf = decodeLogoBuffer(company.logo);
      const logoSize = 72;
      const logoX = midColX + (third - logoSize) / 2;
      if (logoBuf) {
        try {
          doc.image(logoBuf, logoX, headerTop, { fit: [logoSize, logoSize] });
          doc
            .lineWidth(0.5)
            .strokeColor('#d1d5db')
            .roundedRect(logoX, headerTop, logoSize, logoSize, logoSize / 2)
            .stroke()
            .strokeColor('#000000');
        } catch {
          /* ignore */
        }
      }

      if (hasAmiri) {
        let ay = headerTop;
        doc.fontSize(10);
        doc.text(company.name, rightColX, ay, { width: third - 4, align: 'right' });
        ay += lineGap;
        doc.text(countryAr, rightColX, ay, { width: third - 4, align: 'right' });
        ay += lineGap;
        doc.text(`${LABELS.vat.ar} ${company.vatNumber}`, rightColX, ay, { width: third - 4, align: 'right' });
        ay += lineGap;
        if (company.commercialRegistration) {
          doc.text(`${LABELS.crAr} ${company.commercialRegistration}`, rightColX, ay, { width: third - 4, align: 'right' });
        }
      }

      const headerBlockH = Math.max(logoSize + 4, lineGap * 4 + 8);
      let y = headerTop + headerBlockH + 8;

      // —— Title ——
      doc.fontSize(20).fillColor('#111827');
      doc.text(`${docTypeLabel.en} ${hasAmiri ? docTypeLabel.ar : ''}`.trim(), pageLeft, y, {
        width: contentWidth,
        align: 'center',
      });
      y = doc.y + 14;

      // —— Customer & invoice info (boxed grid) ——
      const labelColW = 200;
      const rowH = 22;
      const issueDateOnly = formatInvoiceDate(invoice.issueDateTime);
      const infoRows: [string, string][] = [
        [bilingualFieldLabel(LABELS.customer.en, LABELS.customer.ar, hasAmiri), customer.name],
        [bilingualFieldLabel(LABELS.address.en, LABELS.address.ar, hasAmiri), formatCustomerAddress(customer)],
        [
          bilingualFieldLabel(LABELS.vat.en, LABELS.vat.ar, hasAmiri),
          customer.vatNumber?.trim() || '—',
        ],
        [
          bilingualFieldLabel(LABELS.invoiceNo.en, LABELS.invoiceNo.ar, hasAmiri),
          invoice.invoiceNumber,
        ],
        [bilingualFieldLabel(LABELS.issueDate.en, LABELS.issueDate.ar, hasAmiri), issueDateOnly],
        [bilingualFieldLabel(LABELS.dueDate.en, LABELS.dueDate.ar, hasAmiri), issueDateOnly],
        [bilingualFieldLabel(LABELS.orderNumber.en, LABELS.orderNumber.ar, hasAmiri), '—'],
      ];

      const boxH = infoRows.length * rowH;
      doc.lineWidth(0.5).strokeColor('#9ca3af');
      doc.rect(pageLeft, y, contentWidth, boxH).stroke();
      doc.moveTo(pageLeft + labelColW, y).lineTo(pageLeft + labelColW, y + boxH).stroke();
      for (let i = 1; i < infoRows.length; i++) {
        doc.moveTo(pageLeft, y + i * rowH).lineTo(pageRight, y + i * rowH).stroke();
      }
      doc.strokeColor('#000000');

      doc.fontSize(9);
      infoRows.forEach((row, i) => {
        const ry = y + i * rowH;
        doc.text(row[0], pageLeft + 6, ry + 5, { width: labelColW - 10 });
        doc.text(row[1], pageLeft + labelColW + 6, ry + 5, { width: contentWidth - labelColW - 12 });
      });
      y += boxH + 14;

      // —— Line items table ——
      const colNo = 22;
      const colDesc = Math.max(120, Math.floor(contentWidth * 0.28));
      const colQty = 34;
      const colPrice = 48;
      const colTaxable = 54;
      const colVat = 52;
      const colLine = contentWidth - (colNo + colDesc + colQty + colPrice + colTaxable + colVat);
      const xNo = pageLeft;
      const xDesc = xNo + colNo;
      const xQty = xDesc + colDesc;
      const xPrice = xQty + colQty;
      const xTaxable = xPrice + colPrice;
      const xVat = xTaxable + colTaxable;
      const xLine = xVat + colVat;

      const headerRowH = 28;
      doc.save();
      doc.fillColor('#f3f4f6').rect(pageLeft, y, contentWidth, headerRowH).fill();
      doc.restore();
      doc.fillColor('#000000').fontSize(8);
      doc.text(LABELS.no.en, xNo, y + 6, { width: colNo, align: 'center' });
      const hdrDesc = hasAmiri ? `${LABELS.itemName.en} ${LABELS.itemName.ar}` : LABELS.itemName.en;
      doc.text(hdrDesc, xDesc, y + 6, { width: colDesc });
      const hdrQty = hasAmiri ? `${LABELS.quantity.en} ${LABELS.quantity.ar}` : LABELS.quantity.en;
      doc.text(hdrQty, xQty, y + 6, { width: colQty, align: 'right' });
      const hdrPrice = hasAmiri ? `${LABELS.price.en} ${LABELS.price.ar}` : LABELS.price.en;
      doc.text(hdrPrice, xPrice, y + 6, { width: colPrice, align: 'right' });
      const hdrTax = hasAmiri ? `${LABELS.taxableAmount.en} ${LABELS.taxableAmount.ar}` : LABELS.taxableAmount.en;
      doc.text(hdrTax, xTaxable, y + 4, { width: colTaxable, align: 'right' });
      const hdrVatCol = hasAmiri ? `${LABELS.vatColumn.en} ${LABELS.vatColumn.ar}` : LABELS.vatColumn.en;
      doc.text(hdrVatCol, xVat, y + 4, { width: colVat, align: 'right' });
      const hdrLine = hasAmiri ? `${LABELS.total.en} ${LABELS.total.ar}` : LABELS.total.en;
      doc.text(hdrLine, xLine, y + 6, { width: colLine, align: 'right' });

      doc.lineWidth(0.5).strokeColor('#9ca3af');
      doc.moveTo(pageLeft, y + headerRowH).lineTo(pageRight, y + headerRowH).stroke();
      doc.strokeColor('#000000');

      y += headerRowH;
      doc.fontSize(9);
      const items = invoice.items || [];
      items.forEach((item, idx) => {
        const rowTop = y;
        const taxable = lineTaxableAmount(item);
        const vatAmt = Number(item.vatAmount);
        const lineTot = Number(item.lineTotal);
        const rate = Number(item.vatRate);
        doc.text(String(idx + 1), xNo, rowTop + 2, { width: colNo, align: 'center' });
        doc.text(item.name, xDesc, rowTop + 2, { width: colDesc });
        doc.text(String(item.quantity), xQty, rowTop + 2, { width: colQty, align: 'right' });
        doc.text(Number(item.unitPrice).toFixed(2), xPrice, rowTop + 2, { width: colPrice, align: 'right' });
        doc.text(taxable.toFixed(2), xTaxable, rowTop + 2, { width: colTaxable, align: 'right' });
        doc.text(vatAmt.toFixed(2), xVat, rowTop + 2, { width: colVat, align: 'right' });
        doc.fontSize(7).fillColor('#4b5563');
        doc.text(`${rate}%`, xVat, rowTop + 12, { width: colVat, align: 'right' });
        doc.fillColor('#000000').fontSize(9);
        doc.text(lineTot.toFixed(2), xLine, rowTop + 2, { width: colLine, align: 'right' });
        y += 26;
        doc.moveTo(pageLeft, y).lineTo(pageRight, y).strokeColor('#e5e7eb').stroke().strokeColor('#000000');
      });

      y += 12;

      // —— QR (B2C only) + totals ——
      const showInvoiceQr = customer.type === 'B2C' && invoice.qrCode;
      const qrSize = 96;
      const totalsWidth = Math.min(240, Math.floor(contentWidth * 0.42));
      const totalsX = pageRight - totalsWidth;
      const qrBlockLeft = pageLeft;

      if (showInvoiceQr) {
        try {
          const base64Data = invoice.qrCode.replace(/^data:image\/png;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          doc.image(imageBuffer, qrBlockLeft, y, { fit: [qrSize, qrSize] });
          doc.fontSize(7).fillColor('#4b5563');
          const noteY = y + qrSize + 4;
          doc.text(LABELS.zatcaQrNote.en, qrBlockLeft, noteY, { width: qrSize + 120, align: 'left' });
          if (hasAmiri) {
            doc.text(LABELS.zatcaQrNote.ar, qrBlockLeft, doc.y + 2, { width: qrSize + 160, align: 'left' });
          }
          doc.fillColor('#000000');
        } catch {
          /* ignore */
        }
      }

      const subtotal = Number(invoice.subtotal);
      const vatAmount = Number(invoice.vatAmount);
      const total = Number(invoice.totalAmount);

      const totalsTop = y;
      doc.fontSize(10);
      let ty = totalsTop;
      doc.text(hasAmiri ? `${LABELS.subtotal.en} ${LABELS.subtotal.ar}` : LABELS.subtotal.en, totalsX, ty, {
        width: totalsWidth - 72,
      });
      doc.text(riyalAmount(subtotal), totalsX, ty, { width: totalsWidth, align: 'right' });
      ty += 16;
      doc.text(hasAmiri ? `${LABELS.vatAmount.en} ${LABELS.vatAmount.ar}` : LABELS.vatAmount.en, totalsX, ty, {
        width: totalsWidth - 72,
      });
      doc.text(riyalAmount(vatAmount), totalsX, ty, { width: totalsWidth, align: 'right' });
      ty += 16;
      doc.fontSize(11);
      doc.text(hasAmiri ? `${LABELS.totalAmount.en} ${LABELS.totalAmount.ar}` : LABELS.totalAmount.en, totalsX, ty, {
        width: totalsWidth - 72,
      });
      doc.text(riyalAmount(total), totalsX, ty, { width: totalsWidth, align: 'right' });
      ty += 22;

      const qrBlockBottom = showInvoiceQr ? y + qrSize + (hasAmiri ? 52 : 34) : ty;
      y = Math.max(ty, qrBlockBottom) + 8;

      const amountWords = amountToArabicWords(total);
      doc.fontSize(9).fillColor('#374151');
      doc.text(hasAmiri ? `${LABELS.amountInWords.ar}: ${amountWords}` : `${LABELS.amountInWords.en}: ${amountWords}`, pageLeft, y, {
        width: contentWidth,
      });
      doc.fillColor('#000000');

      // —— Footer: company center, page + invoice right ——
      const footY = pageBottom - 28;
      doc.fontSize(8).fillColor('#9ca3af');
      doc.text(company.name, pageLeft, footY, { width: contentWidth, align: 'center' });
      doc.text(`Page 1 of 1 - ${invoice.invoiceNumber}`, pageLeft, footY, {
        width: contentWidth,
        align: 'right',
      });
      doc.fillColor('#6b7280');
      doc.text(hasAmiri ? `${LABELS.footer.en} | ${LABELS.footer.ar}` : LABELS.footer.en, pageLeft, footY + 12, {
        width: contentWidth,
        align: 'center',
      });
      doc.fillColor('#000000');

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
      pdf.text(riyalAmount(doc.subtotal), 480, y);
      y += 15;
      pdf.text(hasAmiri ? `${LABELS.vatAmount.en} / ${LABELS.vatAmount.ar}` : LABELS.vatAmount.en, 350, y);
      pdf.text(riyalAmount(doc.vatAmount), 480, y);
      y += 15;
      pdf.fontSize(12).text(hasAmiri ? `${LABELS.totalAmount.en} / ${LABELS.totalAmount.ar}` : LABELS.totalAmount.en, 350, y);
      pdf.fontSize(12).text(riyalAmount(doc.totalAmount), 480, y);
      y += 20;
      const amountWords = amountToArabicWords(doc.totalAmount);
      pdf.fontSize(11);
      pdf.text(hasAmiri ? `${LABELS.amountInWords.ar}: ${amountWords}` : `Amount: ${riyalAmount(doc.totalAmount)}`, 50, y);
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
