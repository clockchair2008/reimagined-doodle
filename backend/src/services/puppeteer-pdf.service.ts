import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser } from 'puppeteer';

import { Company } from '../entities/company.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import {
  mapInvoiceToTemplateInput,
  renderZatcaInvoiceHtml,
  type InvoicePdfTemplateInput,
} from './pdf/invoice-template';

type PdfResult = { buffer: Buffer; html: string };

function toDataUrlIfBase64Png(maybeDataUrl: string | null | undefined): string | null {
  if (!maybeDataUrl) return null;
  if (maybeDataUrl.startsWith('data:image/')) return maybeDataUrl;
  return `data:image/png;base64,${maybeDataUrl}`;
}

@Injectable()
export class PuppeteerPdfService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Lazily launched on first use if needed.
    if (this.configService.get<string>('PDF_PUPPETEER_LAUNCH_ON_BOOT', 'true') === 'true') {
      await this.ensureBrowser();
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  private resolveFontBase64(fontPath: string): string | null {
    try {
      if (!fs.existsSync(fontPath)) return null;
      const buf = fs.readFileSync(fontPath);
      return buf.toString('base64');
    } catch {
      return null;
    }
  }

  private buildEmbeddedFontsCss(): string {
    // Put fonts under backend/fonts/
    const candidates = [
      {
        family: 'Noto Sans Arabic',
        file: 'NotoSansArabic-Regular.ttf',
        weight: 400,
      },
      {
        family: 'Noto Naskh Arabic',
        file: 'NotoNaskhArabic-Regular.ttf',
        weight: 400,
      },
      {
        family: 'Amiri',
        file: 'Amiri-Regular.ttf',
        weight: 400,
      },
      // Saudi Riyal symbol font (Sep 2025) – any filename containing "riyal" or "saudi"
      {
        family: 'SaudiRiyal',
        file: 'saudi_riyal.ttf',
        weight: 400,
      },
    ];

    const dirs = [
      path.resolve(process.cwd(), 'backend', 'fonts'),
      path.resolve(process.cwd(), 'fonts'),
      path.resolve(__dirname, '../../fonts'),
    ];

    const rules: string[] = [];

    for (const c of candidates) {
      let base64: string | null = null;
      for (const dir of dirs) {
        const p = path.join(dir, c.file);
        base64 = this.resolveFontBase64(p);
        if (base64) break;
      }

      // Special: try to discover Saudi Riyal font by filename.
      if (!base64 && c.family === 'SaudiRiyal') {
        for (const dir of dirs) {
          try {
            if (!fs.existsSync(dir)) continue;
            const ttf = fs
              .readdirSync(dir)
              .find(
                (f) =>
                  f.toLowerCase().endsWith('.ttf') &&
                  (f.toLowerCase().includes('riyal') || f.toLowerCase().includes('saudi')),
              );
            if (!ttf) continue;
            base64 = this.resolveFontBase64(path.join(dir, ttf));
            if (base64) break;
          } catch {
            // ignore
          }
        }
      }

      if (!base64) continue;

      rules.push(`
@font-face {
  font-family: "${c.family}";
  font-style: normal;
  font-weight: ${c.weight};
  src: url(data:font/ttf;base64,${base64}) format("truetype");
}
      `.trim());
    }

    return rules.join('\n\n');
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    const executablePath =
      this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH') ||
      this.configService.get<string>('CHROME_EXECUTABLE_PATH') ||
      undefined;

    this.browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=medium',
        '--disable-dev-shm-usage',
      ],
    });

    return this.browser;
  }

  private async renderHtmlToPdf(html: string): Promise<PdfResult> {
    const browser = await this.ensureBrowser().catch((e) => {
      throw new ServiceUnavailableException(
        `PDF renderer failed to start: ${e?.message || 'unknown error'}`,
      );
    });

    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] });
      await page.emulateMediaType('screen');

      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      });

      return { buffer: Buffer.from(pdfBytes), html };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async generateInvoicePdf(params: {
    invoice: Invoice;
    company: Company;
    customer: Customer;
    titleEn: string;
    titleAr: string;
  }): Promise<PdfResult> {
    const embeddedFontsCss = this.buildEmbeddedFontsCss();

    const input: InvoicePdfTemplateInput = {
      ...mapInvoiceToTemplateInput({
        invoice: params.invoice,
        company: params.company,
        customer: params.customer,
        titleEn: params.titleEn,
        titleAr: params.titleAr,
        qrDataUrl: toDataUrlIfBase64Png((params.invoice as any)?.qrCode),
      }),
      embeddedFontsCss,
      logoDataUrl: params.company.logo ?? null,
    };

    const html = renderZatcaInvoiceHtml(input);
    return this.renderHtmlToPdf(html);
  }

  async writePdfToPath(pdf: Buffer, outputPath: string) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await fs.promises.writeFile(outputPath, pdf);
  }
}

