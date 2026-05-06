import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

interface ZatcaSubmitPayload {
  invoiceHash: string;
  uuid: string;
  invoice: string;
}

@Injectable()
export class ZatcaIntegrationService {
  constructor(private readonly configService: ConfigService) {}

  private async postJson(url: string, payload: Record<string, any>): Promise<any> {
    const certPath = this.configService.get<string>('ZATCA_CERT_PATH');
    const keyPath = this.configService.get<string>('ZATCA_PRIVATE_KEY_PATH');
    const passphrase = this.configService.get<string>('ZATCA_PRIVATE_KEY_PASSPHRASE');
    const authToken = this.configService.get<string>('ZATCA_AUTH_TOKEN');

    const parsedUrl = new URL(url);
    const body = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'POST',
          cert: certPath ? fs.readFileSync(path.resolve(certPath)) : undefined,
          key: keyPath ? fs.readFileSync(path.resolve(keyPath)) : undefined,
          passphrase,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authToken ? { Authorization: `Basic ${authToken}` } : {}),
          },
        },
        (res) => {
          let chunks = '';
          res.on('data', (chunk) => {
            chunks += chunk.toString();
          });
          res.on('end', () => {
            const parsed = chunks ? JSON.parse(chunks) : {};
            resolve({ statusCode: res.statusCode, body: parsed });
          });
        },
      );

      req.on('error', (error) => reject(error));
      req.write(body);
      req.end();
    });
  }

  async submitForClearance(payload: ZatcaSubmitPayload): Promise<any> {
    const endpoint = this.configService.get<string>(
      'ZATCA_CLEARANCE_API',
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single',
    );
    try {
      return await this.postJson(endpoint, payload);
    } catch (error) {
      throw new InternalServerErrorException(`ZATCA clearance call failed: ${error.message}`);
    }
  }

  async submitForReporting(payload: ZatcaSubmitPayload): Promise<any> {
    const endpoint = this.configService.get<string>(
      'ZATCA_REPORTING_API',
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single',
    );
    try {
      return await this.postJson(endpoint, payload);
    } catch (error) {
      throw new InternalServerErrorException(`ZATCA reporting call failed: ${error.message}`);
    }
  }
}

