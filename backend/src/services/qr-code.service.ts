import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

export interface QRCodeData {
  sellerName: string;
  vatRegistrationNumber: string;
  timestamp: string;
  invoiceTotal: number;
  vatTotal: number;
}

@Injectable()
export class QrCodeService {
  /**
   * Generate TLV-encoded QR code data for simplified invoices
   * TLV Format: Tag-Length-Value
   */
  generateTLVData(data: QRCodeData): string {
    const fields = [
      { tag: 1, value: data.sellerName },
      { tag: 2, value: data.vatRegistrationNumber },
      { tag: 3, value: data.timestamp },
      { tag: 4, value: data.invoiceTotal.toString() },
      { tag: 5, value: data.vatTotal.toString() },
    ];

    const bytes: Buffer[] = [];
    for (const field of fields) {
      const value = field.value.toString();
      const valueBuffer = Buffer.from(value, 'utf8');
      const length = valueBuffer.length;

      // Tag (1 byte) + Length (1 byte) + Value bytes (UTF-8)
      bytes.push(Buffer.from([field.tag]));
      bytes.push(Buffer.from([length]));
      bytes.push(valueBuffer);
    }

    return Buffer.concat(bytes).toString('base64');
  }

  /**
   * Generate QR code image from TLV data
   */
  async generateQRCodeImage(tlvData: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(tlvData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate complete QR code for invoice
   */
  async generateInvoiceQRCode(
    sellerName: string,
    vatNumber: string,
    timestamp: Date,
    invoiceTotal: number,
    vatTotal: number,
  ): Promise<{ tlvData: string; image: string }> {
    const qrData: QRCodeData = {
      sellerName,
      vatRegistrationNumber: vatNumber,
      timestamp: timestamp.toISOString(),
      invoiceTotal,
      vatTotal,
    };

    const tlvData = this.generateTLVData(qrData);
    const image = await this.generateQRCodeImage(tlvData);

    return { tlvData, image };
  }
}
