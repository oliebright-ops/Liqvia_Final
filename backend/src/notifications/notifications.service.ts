import { Injectable } from '@nestjs/common';
import { AlertSeverity, NotificationType, Prisma } from '@prisma/client';
import { DEFAULT_DEMO_COMPANY_ID } from '@liqvia2/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringObligationsService } from '../recurring-obligations/recurring-obligations.service';
import { TreasuryEngineService } from '../treasury/treasury-engine.service';

/** Obligations due within this many days trigger an obligation-due-soon notification. */
const OBLIGATION_DUE_SOON_DAYS = 7;
/** Runway below this many weeks triggers a runway-risk notification. */
const RUNWAY_RISK_WEEKS = 6;

interface DraftNotification {
  type: NotificationType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  dedupeKey: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurringObligations: RecurringObligationsService,
    private readonly treasuryEngine: TreasuryEngineService,
  ) {}

  /** Detects current conditions and persists any not-yet-recorded-today notifications. */
  async refreshForCompany(companyId: string = DEFAULT_DEMO_COMPANY_ID): Promise<void> {
    const asOfDate = new Date().toISOString().slice(0, 10);
    const drafts: DraftNotification[] = [];

    const [nextDueDates, engineResult] = await Promise.all([
      this.recurringObligations.nextDueDates(companyId, asOfDate),
      this.treasuryEngine.generateForCompany(companyId, false),
    ]);

    const dueSoonCutoff = addDaysIso(asOfDate, OBLIGATION_DUE_SOON_DAYS);
    for (const obligation of nextDueDates) {
      if (obligation.dueDate >= asOfDate && obligation.dueDate <= dueSoonCutoff) {
        drafts.push({
          type: 'obligation_due_soon',
          severity: 'warning',
          title: `${obligation.name} due soon`,
          message: `${obligation.name} (${obligation.category}) of ${obligation.amount.toLocaleString()} is due ${obligation.dueDate}.`,
          metadata: { obligationId: obligation.obligationId, dueDate: obligation.dueDate },
          dedupeKey: `obligation_due_soon:${obligation.obligationId}:${asOfDate}`,
        });
      }
    }

    const payrollDueDates = new Set(
      nextDueDates.filter((o) => o.category === 'payroll').map((o) => o.dueDate),
    );
    for (const line of engineResult.forecastLines) {
      if (line.closingCash >= 0) continue;
      const weekOverlapsPayroll = [...payrollDueDates].some(
        (d) => d >= line.weekStart && d <= addDaysIso(line.weekStart, 6),
      );
      if (!weekOverlapsPayroll) continue;
      drafts.push({
        type: 'payroll_shortfall',
        severity: 'critical',
        title: 'Payroll shortfall risk',
        message: `Forecast cash goes negative (${line.closingCash.toLocaleString()}) in the week of ${line.weekStart}, which overlaps a payroll due date.`,
        metadata: { weekStart: line.weekStart, closingCash: line.closingCash },
        dedupeKey: `payroll_shortfall:${line.weekStart}:${asOfDate}`,
      });
      break; // one shortfall notification per day is enough signal
    }

    if (engineResult.runwayWeeks !== null && engineResult.runwayWeeks < RUNWAY_RISK_WEEKS) {
      drafts.push({
        type: 'runway_risk',
        severity: engineResult.runwayWeeks < 2 ? 'critical' : 'warning',
        title: 'Runway risk',
        message: `Cash runway is approximately ${engineResult.runwayWeeks.toFixed(1)} week(s) at the current burn rate.`,
        metadata: { runwayWeeks: engineResult.runwayWeeks },
        dedupeKey: `runway_risk:${asOfDate}`,
      });
    }

    for (const draft of drafts) {
      await this.prisma.notification
        .create({
          data: {
            companyId,
            type: draft.type,
            severity: draft.severity,
            title: draft.title,
            message: draft.message,
            metadata: draft.metadata as Prisma.InputJsonValue | undefined,
            dedupeKey: draft.dedupeKey,
          },
        })
        .catch((err) => {
          // Unique constraint violation means today's notification already exists — expected on repeat calls.
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
            throw err;
          }
        });
    }
  }

  async list(companyId: string) {
    await this.refreshForCompany(companyId);

    const [notifications, company] = await Promise.all([
      this.prisma.notification.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
    ]);

    if ((company?.plan ?? 'free') === 'free') {
      const unreadCount = notifications.filter((n) => !n.read).length;
      return {
        locked: true,
        unreadCount,
        message: 'Upgrade to Pro to see full notification details.',
        preview: notifications.slice(0, 3).map((n) => ({ severity: n.severity, type: n.type })),
      };
    }

    return { locked: false, notifications };
  }

  async markRead(companyId: string, id: string) {
    const existing = await this.prisma.notification.findFirst({ where: { id, companyId } });
    if (!existing) return null;
    return this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }
}

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
