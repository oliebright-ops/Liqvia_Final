import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { currentDataPlane } from '../residency/data-plane';

/**
 * Retention for landing-page leads.
 *
 * Owner decision (2026-08-10): a lead's personal data is kept for **at most one
 * month**. "At most" is the operative phrase — the month is a ceiling, not a
 * licence to hold data for thirty days regardless. Where the purpose has been
 * achieved, or consent has been withdrawn, or the subject has asked processing to
 * stop, erasure is due on its own statutory clock and must not wait for the month
 * to elapse. {@link eraseLead} exists for exactly those events.
 *
 * ## Erasure by overwriting, not by deleting
 *
 * An expired lead is erased by overwriting every identifying column in place and
 * stamping `anonymisedAt`, rather than by deleting the row. Deleting would take
 * the consent evidence with it — evidence that answers a different question ("was
 * this processing lawful when it happened?") which outlives the data it
 * authorised. After erasure the row holds no personal data: what remains is an
 * opaque id, a timestamp and a campaign tag.
 *
 * ## Consent evidence is never touched here
 *
 * `ConsentRecord` has its own retention category, and it is deliberately
 * unresolved — marked REVIEW REQUIRED in docs/RU_MINIMUM_SCHEMA.md rather than
 * guessed at. Nothing in this service deletes or modifies a consent record.
 */

/** Ceiling on how long a lead's personal data may be kept. */
export const LEAD_RETENTION_DAYS = 30;

/** How often the sweep runs. Daily is ample for a ceiling measured in a month. */
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Delay before the first sweep, so it never competes with application startup. */
const INITIAL_SWEEP_DELAY_MS = 60 * 1000;

/**
 * Written over every identifying column. A fixed token rather than `null`,
 * because the columns are `NOT NULL` and because a reader of the row should see
 * that the data was erased rather than never supplied.
 */
export const ERASED_PLACEHOLDER = '[удалено]';

export type ErasureReason =
  /** The one-month ceiling was reached. */
  | 'retention-expiry'
  /** The subject withdrew their consent. */
  | 'consent-withdrawn'
  /** The enquiry was concluded and the purpose no longer requires the data. */
  | 'purpose-ended'
  /** The subject asked for deletion. */
  | 'subject-request';

@Injectable()
export class LeadRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadRetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // A plain timer, deliberately: the sweep is idempotent, so a second instance
    // running it concurrently is harmless, and a scheduler or queue would be more
    // moving parts than a once-a-day UPDATE justifies.
    this.timer = setInterval(() => {
      void this.sweep();
    }, SWEEP_INTERVAL_MS);
    this.timer.unref?.();

    const first = setTimeout(() => {
      void this.sweep();
    }, INITIAL_SWEEP_DELAY_MS);
    first.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** The cut-off: leads created before this still hold personal data unlawfully. */
  expiryCutoff(now: Date = new Date()): Date {
    return new Date(now.getTime() - LEAD_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Erases every lead past the retention ceiling.
   *
   * Returns the number of rows erased. Idempotent: rows already carrying
   * `anonymisedAt` are excluded, so re-running changes nothing.
   */
  async sweep(now: Date = new Date()): Promise<number> {
    const cutoff = this.expiryCutoff(now);

    try {
      const { count } = await this.prisma.cashOsLead.updateMany({
        where: { anonymisedAt: null, createdAt: { lt: cutoff } },
        data: this.erasureData('retention-expiry', now),
      });

      if (count > 0) {
        // Count and reason only. Naming which leads were erased would put the
        // identifiers of real people into a log sink as a side effect of
        // protecting them.
        this.logger.log(
          `Retention sweep on the ${currentDataPlane()} data plane erased ${count} ` +
            `lead(s) past the ${LEAD_RETENTION_DAYS}-day ceiling.`,
        );
      }
      return count;
    } catch (err) {
      // Never interpolate the error: a Prisma failure embeds the rows it touched.
      this.logger.error(
        `Retention sweep failed: ${err instanceof Error ? err.name : '[non-error thrown]'}. ` +
          'No personal data was logged.',
      );
      throw err;
    }
  }

  /**
   * Erases a single lead ahead of the ceiling.
   *
   * This is the path for consent withdrawal, a subject's deletion request, or a
   * concluded enquiry — the events that carry their own deadlines and must not
   * wait for the monthly sweep.
   *
   * Returns false when the lead does not exist or was already erased, so a
   * repeated withdrawal request is not an error.
   */
  async eraseLead(leadId: string, reason: ErasureReason, now: Date = new Date()): Promise<boolean> {
    const { count } = await this.prisma.cashOsLead.updateMany({
      where: { id: leadId, anonymisedAt: null },
      data: this.erasureData(reason, now),
    });

    if (count > 0) {
      // The internal lead id is not personal data and is what makes the action
      // auditable, which is the whole point of recording it.
      this.logger.log(`Lead ${leadId} erased (${reason}). Consent evidence retained.`);
    }
    return count > 0;
  }

  /**
   * Overwrites every column that carries personal data.
   *
   * `companyName` is included: for a sole trader or a single-owner company the
   * name of the business identifies the individual behind it. `source` and
   * `createdAt` are kept — a campaign tag and a timestamp identify nobody, and
   * they are what makes a funnel measurable after erasure.
   *
   * The UTM columns are kept for the same reason: "this campaign produced eleven
   * leads" must still be answerable next quarter, and a campaign name, medium or
   * matched keyword describes an advert, not a person.
   *
   * `yclid` is the exception, and is cleared. It identifies one particular click
   * by one particular visitor, and Yandex holds the other half of that mapping —
   * so it is the one attribution value that could help re-attach an erased row to
   * the person it came from. Keeping it would make the erasure partly cosmetic.
   */
  private erasureData(reason: ErasureReason, now: Date) {
    return {
      name: ERASED_PLACEHOLDER,
      email: ERASED_PLACEHOLDER,
      companyName: ERASED_PLACEHOLDER,
      role: null,
      phone: null,
      comment: null,
      employeeCount: null,
      industry: null,
      yclid: null,
      anonymisedAt: now,
      anonymisedReason: reason,
    };
  }
}
