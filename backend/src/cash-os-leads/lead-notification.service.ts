import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { describeErrorClassForLog } from '../security/log-redaction';

/**
 * Tells the operator that a lead arrived, without telling them who it is.
 *
 * The obvious implementation — put the name, email, phone and comment in the
 * email so the operator can just read it — is the one that must not be built. It
 * would take thirty seconds, look helpful, pass review, and quietly export every
 * Russian lead's personal data to a foreign mail provider, where it would sit in
 * a mailbox indefinitely, outside the residency boundary and outside every
 * control this project has built.
 *
 * So the notification carries an internal reference and nothing else. Identity is
 * retrieved afterwards from the RU-hosted environment by an authorised person.
 * That survives the mailbox being breached, screenshotted into a group chat, or
 * forwarded to a contractor: the worst case is a leaked reference number.
 *
 * Because the body contains no personal data of the data subject, the mail
 * provider's jurisdiction is not a residency question. That property is exactly
 * what {@link buildNotificationBody} must keep true, and what its tests assert.
 */

/** Fields that must never appear in a notification body. */
export interface LeadNotificationInput {
  /** Internal lead id — not personal data. */
  leadId: string;
  /** Non-identifying campaign tag, if any. */
  source?: string | null;
  /** When the lead was received. */
  receivedAt: Date;
}

/** Reference shown to the operator, e.g. `RU-4F2A9C`. Derived from the internal id. */
export function leadReference(leadId: string): string {
  const tail = leadId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  return `RU-${tail || '000000'}`;
}

/**
 * The complete notification body.
 *
 * Contains: a reference, a timestamp, a campaign tag, and where to look.
 * Contains no name, email, phone, company or comment — by construction, because
 * this function is not given them.
 */
export function buildNotificationBody(input: LeadNotificationInput, appUrl: string): string {
  const ref = leadReference(input.leadId);
  const when = input.receivedAt.toISOString().replace('T', ' ').slice(0, 16);
  return [
    'Новая заявка Liqvia (Россия).',
    `Идентификатор: ${ref}`,
    `Получена: ${when} UTC`,
    input.source ? `Кампания: ${input.source}` : 'Кампания: не указана',
    '',
    'Контактные данные не включены в это письмо намеренно.',
    `Открыть заявку: ${appUrl}/leads/${ref}`,
  ].join('\n');
}

@Injectable()
export class LeadNotificationService {
  private readonly logger = new Logger(LeadNotificationService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;
    const host = process.env.LEAD_NOTIFY_SMTP_HOST?.trim();
    if (!host) return null;

    const port = Number(process.env.LEAD_NOTIFY_SMTP_PORT ?? 587);
    const user = process.env.LEAD_NOTIFY_SMTP_USER?.trim();
    const pass = process.env.LEAD_NOTIFY_SMTP_PASS?.trim();
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    return this.transporter;
  }

  /**
   * Sends the notification. Never throws: a lead that was stored successfully
   * must not be reported as failed because a mail server was unreachable. The
   * evidence of the lead is the database row, not the email.
   */
  async notify(input: LeadNotificationInput): Promise<boolean> {
    const to = process.env.LEAD_NOTIFY_TO?.trim();
    const transporter = this.getTransporter();
    const ref = leadReference(input.leadId);

    if (!to || !transporter) {
      // Still useful: the reference reaches the operator through the log, which
      // contains no personal data either.
      this.logger.log(`Lead ${ref} received. Notification not configured.`);
      return false;
    }

    try {
      await transporter.sendMail({
        from: process.env.LEAD_NOTIFY_FROM?.trim() ?? to,
        to,
        subject: `Новая заявка Liqvia — ${ref}`,
        text: buildNotificationBody(input, process.env.APP_URL ?? 'https://liqvia.info'),
      });
      this.logger.log(`Lead ${ref} notification sent.`);
      return true;
    } catch (err) {
      this.logger.error(
        `Lead ${ref} notification failed: ${describeErrorClassForLog(err)}. The lead is stored.`,
      );
      return false;
    }
  }
}
