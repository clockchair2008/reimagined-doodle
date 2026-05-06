import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createSign, generateKeyPairSync, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InvoiceCryptoService {
  constructor(private readonly configService: ConfigService) {}

  private getKeysDirectory(companyId: string): string {
    const storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
    return path.resolve(storagePath, 'zatca', 'keys', companyId);
  }

  ensureKeyPair(companyId: string): { privateKeyPath: string; publicKeyPath: string } {
    const dir = this.getKeysDirectory(companyId);
    const privateKeyPath = path.join(dir, 'private_key.pem');
    const publicKeyPath = path.join(dir, 'public_key.pem');

    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      return { privateKeyPath, publicKeyPath };
    }

    fs.mkdirSync(dir, { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    fs.writeFileSync(privateKeyPath, privateKey, 'utf-8');
    fs.writeFileSync(publicKeyPath, publicKey, 'utf-8');

    return { privateKeyPath, publicKeyPath };
  }

  computeInvoiceHash(xmlContent: string): string {
    const normalized = xmlContent.replace(/>\s+</g, '><').trim();
    return createHash('sha256').update(normalized, 'utf8').digest('hex');
  }

  signInvoiceHash(hashHex: string, privateKeyPath: string): string {
    try {
      const privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
      const signer = createSign('SHA256');
      signer.update(Buffer.from(hashHex, 'hex'));
      signer.end();
      return signer.sign(privateKey).toString('base64');
    } catch (error) {
      throw new InternalServerErrorException(`Failed to sign invoice hash: ${error.message}`);
    }
  }

  buildSignedPropertiesXml(signatureValue: string, invoiceHashHex: string): string {
    const signatureId = randomUUID();
    return [
      '<ext:UBLExtensions>',
      '  <ext:UBLExtension>',
      '    <ext:ExtensionContent>',
      '      <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"',
      '        xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"',
      '        xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">',
      '        <sac:SignatureInformation>',
      `          <cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">${signatureId}</cbc:ID>`,
      `          <sbc:ReferencedSignatureID>${invoiceHashHex}</sbc:ReferencedSignatureID>`,
      `          <sbc:SignatureValue>${signatureValue}</sbc:SignatureValue>`,
      '        </sac:SignatureInformation>',
      '      </sig:UBLDocumentSignatures>',
      '    </ext:ExtensionContent>',
      '  </ext:UBLExtension>',
      '</ext:UBLExtensions>',
    ].join('\n');
  }
}

