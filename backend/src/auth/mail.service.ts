import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST?.trim();
    if (!host) return null;

    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.transporter;
  }

  isConfigured(): boolean {
    return this.getTransporter() !== null;
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    const from = process.env.SMTP_FROM?.trim() ?? 'noreply@liqvia.com';
    const transporter = this.getTransporter();

    if (!transporter) {
      this.logger.warn(`SMTP not configured. Password reset requested for ${to} (link omitted from logs).`);
      return false;
    }

    try {
      await transporter.sendMail({
        from,
        to,
        subject: 'Reset your Liqvia password',
        text: [
          'You requested a password reset for your Liqvia account.',
          '',
          `Open this link to choose a new password (valid for 1 hour):`,
          resetUrl,
          '',
          'If you did not request this, you can ignore this email.',
        ].join('\n'),
        html: [
          '<p>You requested a password reset for your Liqvia account.</p>',
          `<p><a href="${resetUrl}">Reset your password</a> (link valid for 1 hour)</p>`,
          '<p>If you did not request this, you can ignore this email.</p>',
        ].join(''),
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${to}`, err);
      return false;
    }
  }
}
