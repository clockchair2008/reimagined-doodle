import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  private getFrom(): string {
    return (
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('SMTP_USER') ||
      'Clock Chair Portal <admin@clockchair.com>'
    );
  }

  private hasResend(): boolean {
    return Boolean(this.configService.get<string>('RESEND_API_KEY'));
  }

  private hasSmtp(): boolean {
    return Boolean(
      this.configService.get<string>('SMTP_HOST') &&
        this.configService.get<string>('SMTP_USER') &&
        this.configService.get<string>('SMTP_PASS'),
    );
  }

  private async sendViaResend(to: string, resetUrl: string): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.getFrom();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Reset your Clock Chair portal password',
        text: [
          'You requested a password reset for the Clock Chair E-Invoicing portal.',
          '',
          'Open this link to set a new password (valid for 1 hour):',
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
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Resend API failed (${response.status}): ${body}`);
      throw new ServiceUnavailableException(
        'Could not send password reset email. Check RESEND_API_KEY and verified sender domain.',
      );
    }
  }

  private async sendViaSmtp(to: string, resetUrl: string): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure =
      this.configService.get<string>('SMTP_SECURE') === 'true' || port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 20_000,
    });

    await transporter.sendMail({
      from: this.getFrom(),
      to,
      subject: 'Reset your Clock Chair portal password',
      text: [
        'You requested a password reset for the Clock Chair E-Invoicing portal.',
        '',
        'Open this link to set a new password (valid for 1 hour):',
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

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    // Prefer Resend (HTTPS) — Railway Hobby/Free blocks outbound SMTP.
    if (this.hasResend()) {
      try {
        await this.sendViaResend(to, resetUrl);
        return;
      } catch (err) {
        if (err instanceof ServiceUnavailableException) throw err;
        this.logger.error(`Resend send failed: ${String(err)}`);
        throw new ServiceUnavailableException(
          'Could not send password reset email via Resend.',
        );
      }
    }

    if (!this.hasSmtp()) {
      this.logger.error(
        'No mail provider configured. Set RESEND_API_KEY (recommended on Railway) or SMTP_HOST/SMTP_USER/SMTP_PASS.',
      );
      throw new ServiceUnavailableException(
        'Password reset email is not configured yet. Contact the administrator.',
      );
    }

    try {
      await this.sendViaSmtp(to, resetUrl);
    } catch (err) {
      this.logger.error(`SMTP send failed: ${String(err)}`);
      throw new ServiceUnavailableException(
        'Could not send password reset email. On Railway Hobby/Free, SMTP is blocked — use RESEND_API_KEY instead.',
      );
    }
  }
}
