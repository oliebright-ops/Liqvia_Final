import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ACTIVE_CONSENT_VERSION,
  CONSENT_REQUIRED_MESSAGE_RU,
  MARKETING_CONSENT_ENABLED,
  MARKETING_LEAD_CONSENT_SUBJECT,
  REQUIRED_LEAD_CONSENT_SUBJECT,
  lookupConsentText,
} from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentService } from '../consent/consent.service';
import { currentDataPlane } from '../residency/data-plane';
import { describeErrorClassForLog } from '../security/log-redaction';
import { CreateCashOsLeadDto, LeadConsentDto } from './dto/create-cash-os-lead.dto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    this.assertRequiredConsent(dto.consent);
    const marketingConsent = this.resolveMarketingConsent(dto.marketingConsent);

    // Lead and consent records are written in one transaction: a lead must never
    // exist without its evidence, and evidence must never point at a missing lead.
    try {
      await this.writeLead(dto, name, companyName, email, marketingConsent);
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

    return { status: 'ok' as const };
  }

  private async writeLead(
    dto: CreateCashOsLeadDto,
    name: string,
    companyName: string,
    email: string,
    marketingConsent: LeadConsentDto | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
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
        },
      });

      await this.consent.recordWithin(tx, {
        subjectId: dto.consent.subjectId,
        version: dto.consent.version,
        consentText: dto.consent.consentText,
        locale: dto.consent.locale,
        acknowledgedAt: dto.consent.acknowledgedAt,
        method: 'checkbox',
        cashOsLeadId: lead.id,
      });

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
          cashOsLeadId: lead.id,
        });
      }
    });
  }

  /**
   * Server-side enforcement of the required consent.
   *
   * The browser checkbox is a usability affordance, not a control: anything can
   * POST to this endpoint. A submission is accepted only when it carries the
   * required notice, a wording version that this server actually knows, and an
   * affirmative acknowledgement.
   *
   * Any *registered* version is accepted rather than only the active one, so a
   * browser holding a cached bundle across a wording change still delivers its
   * lead — the stored evidence records which version that person actually saw.
   * A superseded version is logged so the rollout can be observed.
   */
  private assertRequiredConsent(consent: LeadConsentDto | undefined): void {
    if (!consent?.subjectId || !consent?.version) {
      throw new BadRequestException(CONSENT_REQUIRED_MESSAGE_RU);
    }
    if (consent.subjectId !== REQUIRED_LEAD_CONSENT_SUBJECT) {
      throw new BadRequestException(CONSENT_REQUIRED_MESSAGE_RU);
    }
    // `accepted` is optional for compatibility with clients that omit it, but an
    // explicit `false` is a refusal and must never be stored as a consent.
    if (consent.accepted === false) {
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
    if (consent.accepted === false) return null;

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
