import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Invoice } from '../../entities/invoice.entity';

@Injectable()
export class InvoiceStorageService {
  constructor(private readonly configService: ConfigService) {}

  private ensureDir(directory: string): void {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  persistInvoiceArtifacts(invoice: Invoice, payload: {
    jsonData: Record<string, any>;
    xmlContent: string;
    signedXmlContent: string;
    hash: string;
    zatcaResponse?: Record<string, any> | null;
  }): { jsonPath: string; xmlPath: string; signedXmlPath: string; hashPath: string } {
    const baseStorage = path.resolve(this.configService.get<string>('STORAGE_PATH', './storage'));
    const baseDir = path.join(baseStorage, 'invoices', invoice.companyId || 'unknown', invoice.invoiceNumber);
    this.ensureDir(baseDir);

    const jsonPath = path.join(baseDir, 'invoice.json');
    const xmlPath = path.join(baseDir, 'invoice.xml');
    const signedXmlPath = path.join(baseDir, 'invoice.signed.xml');
    const hashPath = path.join(baseDir, 'invoice.hash.txt');
    const responsePath = path.join(baseDir, 'zatca-response.json');

    fs.writeFileSync(jsonPath, JSON.stringify(payload.jsonData, null, 2), 'utf-8');
    fs.writeFileSync(xmlPath, payload.xmlContent, 'utf-8');
    fs.writeFileSync(signedXmlPath, payload.signedXmlContent, 'utf-8');
    fs.writeFileSync(hashPath, payload.hash, 'utf-8');
    if (payload.zatcaResponse) {
      fs.writeFileSync(responsePath, JSON.stringify(payload.zatcaResponse, null, 2), 'utf-8');
    }

    return { jsonPath, xmlPath, signedXmlPath, hashPath };
  }
}

