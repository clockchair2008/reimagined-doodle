import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { randomUUID } from 'crypto';
import { Invoice } from '../../entities/invoice.entity';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';

@Injectable()
export class Ubl21ZatcaService {
  generateInvoiceXml(
    invoice: Invoice,
    company: Company,
    customer: Customer,
    previousInvoiceHash: string | null,
  ): { xml: string; uuid: string; invoiceTypeCode: string } {
    const uuid = randomUUID();
    const invoiceTypeCode = customer.type === 'B2C' ? '388' : '388';
    const profileId = customer.type === 'B2C' ? 'reporting:1.0' : 'clearance:1.0';

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('Invoice', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
    });

    root.ele('ext:UBLExtensions').ele('ext:UBLExtension').ele('ext:ExtensionContent');
    root.ele('cbc:UBLVersionID').txt('2.1');
    root.ele('cbc:CustomizationID').txt('urn:zatca:customization:tax-invoice:1.0');
    root.ele('cbc:ProfileID').txt(profileId);
    root.ele('cbc:ID').txt(invoice.invoiceNumber);
    root.ele('cbc:UUID').txt(uuid);
    root.ele('cbc:IssueDate').txt(invoice.issueDateTime.toISOString().slice(0, 10));
    root.ele('cbc:IssueTime').txt(invoice.issueDateTime.toISOString().slice(11, 19));
    root.ele('cbc:InvoiceTypeCode').txt(invoiceTypeCode);
    root.ele('cbc:DocumentCurrencyCode').txt('SAR');
    root.ele('cbc:TaxCurrencyCode').txt('SAR');

    const pihRef = root.ele('cac:AdditionalDocumentReference');
    pihRef.ele('cbc:ID').txt('PIH');
    pihRef.ele('cac:Attachment').ele('cbc:EmbeddedDocumentBinaryObject', {
      mimeCode: 'text/plain',
    }).txt(previousInvoiceHash ?? '');

    const supplier = root.ele('cac:AccountingSupplierParty').ele('cac:Party');
    supplier.ele('cac:PartyName').ele('cbc:Name').txt(company.name);
    supplier.ele('cac:PartyTaxScheme').ele('cbc:CompanyID').txt(company.vatNumber);

    const customerNode = root.ele('cac:AccountingCustomerParty').ele('cac:Party');
    customerNode.ele('cac:PartyName').ele('cbc:Name').txt(customer.name);
    if (customer.vatNumber) {
      customerNode.ele('cac:PartyTaxScheme').ele('cbc:CompanyID').txt(customer.vatNumber);
    }

    for (let i = 0; i < invoice.items.length; i += 1) {
      const item = invoice.items[i];
      const net = Number(item.quantity) * Number(item.unitPrice);
      const line = root.ele('cac:InvoiceLine');
      line.ele('cbc:ID').txt(String(i + 1));
      line.ele('cbc:InvoicedQuantity', { unitCode: 'C62' }).txt(String(item.quantity));
      line.ele('cbc:LineExtensionAmount', { currencyID: 'SAR' }).txt(net.toFixed(2));
      line.ele('cac:Item').ele('cbc:Name').txt(item.name);
      line.ele('cac:Price').ele('cbc:PriceAmount', { currencyID: 'SAR' }).txt(Number(item.unitPrice).toFixed(2));
    }

    const taxTotal = root.ele('cac:TaxTotal');
    taxTotal.ele('cbc:TaxAmount', { currencyID: 'SAR' }).txt(Number(invoice.vatAmount).toFixed(2));

    const legalMonetaryTotal = root.ele('cac:LegalMonetaryTotal');
    legalMonetaryTotal.ele('cbc:LineExtensionAmount', { currencyID: 'SAR' }).txt(
      Number(invoice.subtotal).toFixed(2),
    );
    legalMonetaryTotal.ele('cbc:TaxExclusiveAmount', { currencyID: 'SAR' }).txt(
      Number(invoice.subtotal).toFixed(2),
    );
    legalMonetaryTotal.ele('cbc:TaxInclusiveAmount', { currencyID: 'SAR' }).txt(
      Number(invoice.totalAmount).toFixed(2),
    );
    legalMonetaryTotal.ele('cbc:PayableAmount', { currencyID: 'SAR' }).txt(
      Number(invoice.totalAmount).toFixed(2),
    );

    return { xml: root.end({ prettyPrint: true }), uuid, invoiceTypeCode };
  }

  injectSignatureExtension(xml: string, signatureExtensionXml: string): string {
    return xml.replace(
      '<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>',
      signatureExtensionXml,
    );
  }
}

