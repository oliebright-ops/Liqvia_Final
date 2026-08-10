import { Injectable, Logger } from '@nestjs/common';
import { request as httpsRequest } from 'node:https';
import { createTransport, type Transporter } from 'nodemailer';
import { describeAttribution, type LeadAttribution } from '@liqvia2/shared';
import { describeErrorClassForLog } from '../security/log-redaction';

/**
 * Tells the operator that a lead arrived, with enough to act on it.
 *
 * ## What the message contains, and why
 *
 * This service originally sent a reference number and nothing else, on the
 * reasoning that a notification leaving the Russian data plane should identify
 * nobody, with the operator looking the lead up afterwards in an RU-hosted view.
 *
 * There is no such view. The owner decided on 2026-08-10 not to build one, and
 * to receive the contact details directly instead — which is coherent, because
 * without a place to look a lead up, a notification that withholds the contact
 * details cannot be acted on at all and the enquiry simply sits unanswered.
 *
 * So the message now carries name, company, email, phone, the enquiry text and
 * the campaign that produced it. The consequence, recorded here because it is
 * real and was accepted deliberately rather than by drift: **a Russian lead's
 * personal data now leaves the RU plane** into Telegram and a mail provider, and
 * persists in those mailboxes outside every control this project built. The
 * database remains the system of record; these copies are not managed by the
 * retention sweep and will not be erased by it.
 *
 * What is still true: nothing here is logged. The body is assembled and handed
 * to a transport, and only the reference and an error *class* ever reach a log
 * sink — see the boundary tests in ru-lead-boundary.spec.ts.
 *
 * ## Delivery
 *
 * Two independent channels, both optional, both best-effort. Neither can fail a
 * lead: the database row is the record and it is already committed by the time
 * anything here runs.
 */

/** Everything the notifier is allowed to say. */
export interface LeadNotificationInput {
  /** Internal lead id — not personal data. */
  leadId: string;
  name: string;
  companyName: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  employeeCount?: string | null;
  industry?: string | null;
  /** The visitor's own words. Unbounded free text. */
  comment?: string | null;
  /** Non-identifying form/campaign tag, if any. */
  source?: string | null;
  /** Campaign metadata — describes the advert, never the visitor. */
  attribution?: LeadAttribution;
  receivedAt: Date;
}

/** Reference shown to the operator, e.g. `RU-4F2A9C`. Derived from the internal id. */
export function leadReference(leadId: string): string {
  const tail = leadId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  return `RU-${tail || '000000'}`;
}

const TELEGRAM_HOST = 'api.telegram.org';
const TELEGRAM_TIMEOUT_MS = 10_000;

/**
 * The complete notification body.
 *
 * Optional fields are omitted rather than shown empty, so the message stays
 * short enough to read on a phone notification.
 */
export function buildNotificationBody(input: LeadNotificationInput): string {
  const lines = [
    'Новая заявка Liqvia (Россия).',
    `Идентификатор: ${leadReference(input.leadId)}`,
    `Получена: ${input.receivedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`,
    '',
    `Имя: ${input.name}`,
    `Компания: ${input.companyName}`,
    `Email: ${input.email}`,
  ];

  if (input.phone) lines.push(`Телефон / Telegram: ${input.phone}`);
  if (input.role) lines.push(`Должность: ${input.role}`);
  if (input.employeeCount) lines.push(`Сотрудников: ${input.employeeCount}`);
  if (input.industry) lines.push(`Отрасль: ${input.industry}`);
  if (input.comment) lines.push('', `Комментарий: ${input.comment}`);

  lines.push(
    '',
    `Привлечение: ${describeAttribution(input.attribution ?? {})}`,
    `Форма: ${input.source ?? 'не указана'}`,
  );

  return lines.join('\n');
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
   * Sends on every configured channel.
   *
   * Never throws and never rejects: a lead that was stored successfully must not
   * be reported as failed because a mail server was unreachable.
   */
  async notify(input: LeadNotificationInput): Promise<{ email: boolean; telegram: boolean }> {
    const ref = leadReference(input.leadId);
    const body = buildNotificationBody(input);

    const [email, telegram] = await Promise.all([
      this.sendEmail(ref, body),
      this.sendTelegram(ref, body),
    ]);

    if (!email && !telegram) {
      // The reference still reaches the operator through the log, which contains
      // no personal data.
      this.logger.error(
        `Lead ${ref} received but NO notification channel delivered. The lead is stored.`,
      );
    }
    return { email, telegram };
  }

  private async sendEmail(ref: string, body: string): Promise<boolean> {
    const to = process.env.LEAD_NOTIFY_TO?.trim();
    const transporter = this.getTransporter();
    if (!to || !transporter) return false;

    try {
      await transporter.sendMail({
        from: process.env.LEAD_NOTIFY_FROM?.trim() ?? to,
        to,
        subject: `Новая заявка Liqvia — ${ref}`,
        text: body,
      });
      this.logger.log(`Lead ${ref} notification sent by email.`);
      return true;
    } catch (err) {
      this.logger.error(
        `Lead ${ref} email notification failed: ${describeErrorClassForLog(err)}. The lead is stored.`,
      );
      return false;
    }
  }

  /**
   * Sends to every configured Telegram chat.
   *
   * `LEAD_NOTIFY_TELEGRAM_CHAT_ID` accepts a comma-separated list. Each chat is
   * attempted independently: one unreachable recipient must not silence the
   * others. Returns true if at least one delivery succeeded.
   */
  private async sendTelegram(ref: string, body: string): Promise<boolean> {
    const token = process.env.LEAD_NOTIFY_TELEGRAM_TOKEN?.trim();
    const chatIds = (process.env.LEAD_NOTIFY_TELEGRAM_CHAT_ID ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!token || chatIds.length === 0) return false;

    const results = await Promise.all(
      chatIds.map((chatId) => this.sendTelegramTo(ref, chatId, token, body)),
    );
    return results.some(Boolean);
  }

  /**
   * One chat, working around a routing quirk on the RU host.
   *
   * Verified on the production instance 2026-08-10: `api.telegram.org` resolves
   * there to an address that is **unroutable from that host** (connections hang
   * until timeout), while other addresses for the same name complete a normal
   * TLS handshake. IPv6 egress is broken on the box entirely. Left to ordinary
   * DNS, every Telegram notification would silently time out.
   *
   * So `LEAD_NOTIFY_TELEGRAM_IPS` may pin addresses to try before falling back
   * to DNS. TLS is still verified against `api.telegram.org` via SNI, so pinning
   * does not weaken certificate checking: a wrong or hostile address fails the
   * handshake rather than being trusted.
   *
   * This is a workaround for someone else's routing and is brittle by nature —
   * Telegram rotates addresses. Hence DNS is always tried last, and hence email
   * exists as an independent channel.
   */
  private async sendTelegramTo(
    ref: string,
    chatId: string,
    token: string,
    body: string,
  ): Promise<boolean> {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: body,
      disable_web_page_preview: true,
    });

    const pinned = (process.env.LEAD_NOTIFY_TELEGRAM_IPS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // `null` means "resolve normally" and is always tried last, so a rotated
    // address still works once the pinned ones stop responding.
    const candidates: (string | null)[] = [...pinned, null];

    for (const address of candidates) {
      try {
        const status = await this.telegramRequest(address, token, payload);
        if (status >= 200 && status < 300) {
          this.logger.log(`Lead ${ref} notification sent by Telegram.`);
          return true;
        }
        // A 4xx is Telegram rejecting the request itself — a bad token or chat
        // id. Another address cannot fix that, so stop.
        if (status >= 400 && status < 500) {
          this.logger.error(
            `Lead ${ref} Telegram notification rejected with status ${status}. ` +
              'Check LEAD_NOTIFY_TELEGRAM_TOKEN and LEAD_NOTIFY_TELEGRAM_CHAT_ID.',
          );
          return false;
        }
      } catch (err) {
        // Connection-level failure against this address: try the next.
        this.logger.warn(
          `Lead ${ref} Telegram attempt via ${address ?? 'DNS'} failed: ` +
            `${describeErrorClassForLog(err)}.`,
        );
      }
    }

    this.logger.error(
      `Lead ${ref} Telegram notification failed on all addresses. The lead is stored.`,
    );
    return false;
  }

  /** One HTTPS attempt against a specific address. Resolves with the status code. */
  private telegramRequest(
    address: string | null,
    token: string,
    payload: string,
  ): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const req = httpsRequest(
        {
          host: address ?? TELEGRAM_HOST,
          // Certificate is validated against the real hostname regardless of the
          // address dialled. This is what keeps address pinning safe.
          servername: TELEGRAM_HOST,
          headers: {
            Host: TELEGRAM_HOST,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          port: 443,
          path: `/bot${token}/sendMessage`,
          method: 'POST',
          // IPv6 egress is broken on the RU host and would otherwise be preferred.
          family: 4,
          timeout: TELEGRAM_TIMEOUT_MS,
        },
        (res) => {
          // Drain, or the socket is held open and the process leaks handles.
          res.resume();
          res.on('end', () => resolve(res.statusCode ?? 0));
        },
      );

      req.on('timeout', () => req.destroy(new Error('Telegram request timed out')));
      req.on('error', reject);
      req.end(payload);
    });
  }
}
