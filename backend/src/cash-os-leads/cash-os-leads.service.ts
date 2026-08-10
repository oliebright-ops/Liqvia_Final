import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ACTIVE_CONSENT_VERSION,
  CASH_OS_LEAD_FORM_NOTICE_TEXT,
  CONSENT_REQUIRED_MESSAGE_RU,
  LEAD_NOTICE_SUBJECT,
  LEAD_NOTICE_VERSION,
  MARKETING_CONSENT_ENABLED,
  MARKETING_LEAD_CONSENT_SUBJECT,
  REQUIRED_LEAD_CONSENT_SUBJECT,
  lookupConsentText,
  normaliseLeadAttribution,
  type LeadAttribution,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentService } from '../consent/consent.service';
import { currentDataPlane } from '../residency/data-plane';
import { describeErrorClassForLog } from '../security/log-redaction';
import { CreateCashOsLeadDto, LeadConsentDto } from './dto/create-cash-os-lead.dto';
import { LeadNotificationService } from './lead-notification.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Upper bounds for every free-text field the public form accepts.
 *
 * The endpoint is unauthenticated and the columns are unbounded `text`, so
 * without a ceiling a single caller can store megabytes per submission — the
 * rate limit caps how *often* that happens, not how large each one is. The
 * limits are generous enough that no genuine Russian business name, job title
 * or enquiry reaches them; `comment` is the only field a real person writes at
 * length, hence its much larger allowance.
 *
 * `email` follows the RFC 5321 practical maximum of 320 characters.
 */
const MAX_FIELD_LENGTHS = {
  name: 200,
  role: 200,
  companyName: 200,
  phone: 64,
  email: 320,
  employeeCount: 32,
  industry: 120,
  comment: 5_000,
  source: 120,
} as const satisfies Record<string, number>;

/** Longest consent wording the registry will ever legitimately hold. */
const MAX_CONSENT_TEXT_LENGTH = 5_000;
/** Bounds on the short identifying fields carried with a consent record. */
const MAX_CONSENT_FIELD_LENGTH = 200;

/**
 * Shown when the lead cannot be stored.
 *
 * Deliberately says "try again later" rather than "we've received your request": a person who
 * believes their enquiry arrived will not resend it, and the enquiry is gone. Russian, because
 * the form is Russian.
 */
export const LEAD_STORAGE_UNAVAILABLE_MESSAGE_RU =
  'Не удалось сохранить заявку из-за временной технической ошибки. ' +
  'Пожалуйста, попробуйте отправить форму ещё раз через несколько минут.';

@Injectable()
export class CashOsLeadsService {
  private readonly logger = new Logger(CashOsLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
    private readonly notifications: LeadNotificationService,
  ) {}

  async create(dto: CreateCashOsLeadDto) {
    const name = dto.name?.trim();
    const companyName = dto.companyName?.trim();
    const email = dto.email?.trim();

    if (!name) {
      throw new BadRequestException('Name is required');
    }
    if (!companyName) {
      throw new BadRequestException('Company name is required');
    }
    if (!email || !EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('A valid email is required');
    }

    this.assertWithinLengthLimits(dto);
    if (dto.consent) {
      this.assertAffirmativeConsent(dto.consent);
    }
    const marketingConsent = this.resolveMarketingConsent(dto.marketingConsent);

    // Re-sanitised server-side regardless of what the browser did: the values
    // originate in a query string, so they are attacker-controlled. Never throws —
    // unusable attribution yields {} and the lead proceeds without it.
    const attribution = normaliseLeadAttribution(dto.attribution);

    // Lead and consent records are written in one transaction: a lead must never
    // exist without its evidence, and evidence must never point at a missing lead.
    let lead: { id: string; createdAt: Date };
    try {
      lead = await this.writeLead(dto, name, companyName, email, marketingConsent, attribution);
    } catch (err) {
      // Fail closed. There is deliberately no second destination to try: on the RU
      // plane the only correct outcome of an unavailable RU database is that no
      // personal data is stored anywhere. Falling back to the global database would
      // put Russian personal data outside Russia at exactly the moment nobody is
      // watching, and would look like success.
      //
      // The error CLASS only, never its message. A Prisma write error embeds the row it
      // failed to write — name, email, phone, comment — and pattern-based redaction
      // cannot catch a name or free text. See describeErrorClassForLog.
      this.logger.error(
        `Lead submission could not be stored on the ${currentDataPlane()} data plane: ` +
          `${describeErrorClassForLog(err)}. No personal data was stored.`,
      );
      throw new ServiceUnavailableException(LEAD_STORAGE_UNAVAILABLE_MESSAGE_RU);
    }

    // Deliberately not awaited. The lead is committed and the visitor is owed an
    // answer now; an SMTP handshake can take seconds, and making someone watch a
    // spinner while a mail server is contacted would be the wrong trade. The
    // database row, not the message, is the record of the lead.
    //
    // The `.catch` is not redundant defensiveness: an un-awaited promise that
    // rejects is an unhandled rejection, which on a modern Node default takes the
    // whole process down. The notifier is written not to throw, but the lead path
    // must not depend on that remaining true.
    this.notifications
      .notify({
        leadId: lead.id,
        name,
        companyName,
        email,
        phone: dto.phone?.trim() || null,
        role: dto.role?.trim() || null,
        employeeCount: dto.employeeCount?.trim() || null,
        industry: dto.industry?.trim() || null,
        comment: dto.comment?.trim() || null,
        source: dto.source?.trim() || null,
        attribution,
        receivedAt: lead.createdAt,
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Lead notification threw unexpectedly: ${describeErrorClassForLog(err)}. ` +
            'The lead itself is stored.',
        );
      });

    return { status: 'ok' as const };
  }

  private async writeLead(
    dto: CreateCashOsLeadDto,
    name: string,
    companyName: string,
    email: string,
    marketingConsent: LeadConsentDto | null,
    attribution: LeadAttribution,
  ): Promise<{ id: string; createdAt: Date }> {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.cashOsLead.create({
        data: {
          name,
          role: dto.role?.trim() || null,
          companyName,
          phone: dto.phone?.trim() || null,
          email,
          employeeCount: dto.employeeCount?.trim() || null,
          industry: dto.industry?.trim() || null,
          comment: dto.comment?.trim() || null,
          source: dto.source?.trim() || null,
          // Spread of an already-sanitised object with a closed set of keys, so a
          // caller cannot reach any other column through it.
          ...attribution,
        },
      });

      if (dto.consent) {
        // A real tick, from a client that still renders the checkbox.
        await this.consent.recordWithin(tx, {
          subjectId: dto.consent.subjectId,
          version: dto.consent.version,
          consentText: dto.consent.consentText,
          locale: dto.consent.locale,
          acknowledgedAt: dto.consent.acknowledgedAt,
          method: 'checkbox',
          source: dto.source,
          cashOsLeadId: lead.id,
        });
      } else {
        // No tick happened, so the record must not claim one. What it records is
        // the true fact: this wording was displayed at the point of submission.
        //
        // Every field comes from the server's own registry rather than the
        // request — a passive notice is a property of the page, not something the
        // caller can report, so there is nothing here for a caller to forge. The
        // timestamp is deliberately left to the server: submission time is when
        // the notice was acted on, and there is no earlier moment to claim.
        await this.consent.recordWithin(tx, {
          subjectId: LEAD_NOTICE_SUBJECT,
          version: LEAD_NOTICE_VERSION,
          consentText: CASH_OS_LEAD_FORM_NOTICE_TEXT,
          locale: 'ru',
          method: 'passive-notice',
          source: dto.source,
          cashOsLeadId: lead.id,
        });
      }

      // A second, independent record. The marketing consent is never inferred
      // from the required one and never shares a row with it.
      if (marketingConsent) {
        await this.consent.recordWithin(tx, {
          subjectId: marketingConsent.subjectId,
          version: marketingConsent.version,
          consentText: marketingConsent.consentText,
          locale: marketingConsent.locale,
          acknowledgedAt: marketingConsent.acknowledgedAt,
          method: 'checkbox-optional',
          source: dto.source,
          cashOsLeadId: lead.id,
        });
      }

      return { id: lead.id, createdAt: lead.createdAt };
    });
  }

  /**
   * Rejects oversized input before anything is written.
   *
   * Trimmed length is what counts, matching what `writeLead` actually stores.
   * The message names the field and its limit rather than saying "too long", so
   * a person who genuinely wrote a long enquiry can see what to shorten — but it
   * never echoes the submitted value back.
   */
  private assertWithinLengthLimits(dto: CreateCashOsLeadDto): void {
    for (const [field, limit] of Object.entries(MAX_FIELD_LENGTHS)) {
      const value = dto[field as keyof typeof MAX_FIELD_LENGTHS]?.trim();
      if (value && value.length > limit) {
        throw new BadRequestException(
          `${field} must be ${limit} characters or fewer`,
        );
      }
    }

    // The consent payload is attacker-controlled too, and `consentText` is stored
    // verbatim as evidence. An unbounded one would be the largest field on the
    // request.
    for (const consent of [dto.consent, dto.marketingConsent]) {
      if (!consent) continue;
      if ((consent.consentText?.length ?? 0) > MAX_CONSENT_TEXT_LENGTH) {
        throw new BadRequestException('Consent text exceeds the permitted length');
      }
      for (const field of ['subjectId', 'version', 'locale', 'acknowledgedAt'] as const) {
        if ((consent[field]?.length ?? 0) > MAX_CONSENT_FIELD_LENGTH) {
          throw new BadRequestException('Consent metadata exceeds the permitted length');
        }
      }
    }
  }

  /**
   * Validates an affirmative consent when a client sends one.
   *
   * The form itself no longer shows a checkbox, so the shipped client sends
   * nothing here and `create` records the passive notice instead. This path
   * exists for the clients that still do: a browser holding a cached bundle from
   * before the change, where a person genuinely ticked a box and that tick is
   * evidence worth keeping.
   *
   * It stays strict. An acknowledgement that arrives malformed is rejected rather
   * than quietly downgraded to a notice, because "we could not make sense of your
   * consent claim, so we filed it as something weaker" is how evidence silently
   * becomes wrong. Anything can POST to this endpoint; a claim of an affirmative
   * act is only stored as one when it holds up.
   *
   * Any *registered* required version is accepted rather than only the active
   * one, so a stale bundle still delivers its lead against the wording that
   * person actually saw. A superseded version is logged so the rollout can be
   * observed.
   */
  private assertAffirmativeConsent(consent: LeadConsentDto): void {
    if (!consent.subjectId || !consent.version) {
      throw new BadRequestException(CONSENT_REQUIRED_MESSAGE_RU);
    }
    if (consent.subjectId !== REQUIRED_LEAD_CONSENT_SUBJECT) {
      throw new BadRequestException(CONSENT_REQUIRED_MESSAGE_RU);
    }
    // Only an affirmative `true` is consent. An omitted flag is not a refusal,
    // but it is not an acknowledgement either, and 152-FZ ч. 1 ст. 9 requires a
    // conscious act — so silence must not become evidence of one. Every shipped
    // client sends `accepted: true` explicitly (see lead-submission.ts), so this
    // rejects only hand-rolled or stale callers.
    if (consent.accepted !== true) {
      throw new BadRequestException(CONSENT_REQUIRED_MESSAGE_RU);
    }

    const registered = lookupConsentText(consent.subjectId, consent.version);
    if (!registered || registered.obligation !== 'required') {
      throw new BadRequestException(CONSENT_REQUIRED_MESSAGE_RU);
    }
    if (consent.version !== ACTIVE_CONSENT_VERSION[REQUIRED_LEAD_CONSENT_SUBJECT]) {
      this.logger.warn(
        `Lead submitted against superseded consent version ${consent.version}; ` +
          'accepted and recorded against that version.',
      );
    }
  }

  /**
   * Returns the optional marketing consent only when it is genuinely usable.
   *
   * Rejecting the lead here would be wrong — the required consent is what gates
   * the submission — so an unusable marketing consent is dropped and logged, and
   * the lead is still delivered.
   */
  private resolveMarketingConsent(consent: LeadConsentDto | undefined): LeadConsentDto | null {
    if (!consent) return null;
    // Same rule as the required consent: only an explicit tick counts. Dropping
    // it silently is correct here — the marketing box never gates the lead.
    if (consent.accepted !== true) return null;

    if (!MARKETING_CONSENT_ENABLED) {
      this.logger.warn(
        'Marketing consent submitted while promotional messaging is disabled; not recorded.',
      );
      return null;
    }
    if (consent.subjectId !== MARKETING_LEAD_CONSENT_SUBJECT) {
      this.logger.warn('Marketing consent submitted for an unexpected subject; not recorded.');
      return null;
    }

    const registered = lookupConsentText(consent.subjectId, consent.version);
    if (!registered || registered.obligation !== 'optional') {
      this.logger.warn(
        `Marketing consent submitted against unregistered version ${consent.version}; not recorded.`,
      );
      return null;
    }
    return consent;
  }
}
