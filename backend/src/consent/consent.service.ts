import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { lookupConsentText } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Guard against a client posting an unbounded blob as "the wording I agreed to". */
const MAX_CONSENT_TEXT_LENGTH = 2000;

/** The subset of Prisma needed here — satisfied by both PrismaService and a `$transaction` client. */
export type ConsentWriteClient = Pick<PrismaService, 'consentRecord'>;

export interface RecordConsentInput {
  subjectId: string;
  version: string;
  /** The wording the client says it displayed. Verified against the server registry. */
  consentText: string;
  locale?: string;
  method?: string;
  /** ISO timestamp reported by the client; only used if it is sane. */
  acknowledgedAt?: string;
  cashOsLeadId?: string;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Whitespace-insensitive comparison — line wrapping in JSX must not fail verification. */
function canonicalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists evidence of an acknowledgement.
   *
   * The wording is verified against the append-only registry in
   * `packages/shared/src/consent.ts`. A mismatch does not reject the submission —
   * the user did acknowledge something — but the record is stored with
   * `textVerified = false` so it can be reviewed rather than silently trusted.
   */
  async record(input: RecordConsentInput) {
    return this.recordWithin(this.prisma, input);
  }

  /** Same as {@link record}, but joins a caller's transaction. */
  async recordWithin(client: ConsentWriteClient, input: RecordConsentInput) {
    const registered = lookupConsentText(input.subjectId, input.version);
    if (!registered) {
      throw new BadRequestException(
        `Unknown consent notice "${input.subjectId}@${input.version}"`,
      );
    }

    const submitted = input.consentText?.slice(0, MAX_CONSENT_TEXT_LENGTH) ?? '';
    const textVerified = canonicalise(submitted) === canonicalise(registered.text);

    if (!textVerified) {
      // Never log the submitted text itself — treat client-supplied strings as untrusted.
      this.logger.warn(
        `Consent wording mismatch for ${input.subjectId}@${input.version}; storing record flagged for review.`,
      );
    }

    // Store the registry wording when verification passed, so the record is
    // authoritative rather than client-controlled.
    const consentText = textVerified ? registered.text : submitted;

    return client.consentRecord.create({
      data: {
        subjectId: registered.id,
        version: registered.version,
        policyVersion: registered.policyVersion,
        locale: input.locale?.slice(0, 16) || registered.locale,
        consentText,
        consentTextSha256: sha256Hex(consentText),
        textVerified,
        method: input.method?.slice(0, 32) || 'checkbox',
        acknowledgedAt: this.resolveAcknowledgedAt(input.acknowledgedAt),
        cashOsLeadId: input.cashOsLeadId ?? null,
      },
    });
  }

  /** Client clocks are not trusted: fall back to server time when implausible. */
  private resolveAcknowledgedAt(reported?: string): Date {
    if (!reported) return new Date();
    const parsed = new Date(reported);
    if (Number.isNaN(parsed.getTime())) return new Date();
    const now = Date.now();
    const skewMs = Math.abs(parsed.getTime() - now);
    const ONE_HOUR = 60 * 60 * 1000;
    return skewMs > ONE_HOUR ? new Date() : parsed;
  }
}
