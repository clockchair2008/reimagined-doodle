import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  private isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('SMTP_HOST') &&
        this.configService.get<string>('SMTP_USER') &&
        this.configService.get<string>('SMTP_PASS'),
    );
  }

  private createTransport() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure =
      this.configService.get<string>('SMTP_SECURE') === 'true' || port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.error(
        'SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optional SMTP_PORT/SMTP_FROM).',
      );
      throw new ServiceUnavailableException(
        'Password reset email is not configured yet. Contact the administrator.',
      );
    }

    const from =
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('SMTP_USER') ||
      'noreply@clockchair.com';

    const transporter = this.createTransport();
    await transporter.sendMail({
      from,
      to,
      subject: 'Reset your Clock Chair portal password',
      text: [
        'You requested a password reset for the Clock Chair E-Invoicing portal.',
        '',
        `Open this link to set a new password (valid for 1 hour):`,
        resetUrl,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: `
        <p>You requested a password reset for the <strong>Clock Chair E-Invoicing</strong> portal.</p>
        <p><a href="${resetUrl}">Click here to set a new password</a></p>
        <p>This link expires in <strong>1 hour</strong>.</p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    });
  }
}
