import { calcARCollectionSchedule, type ArCollectionBucket } from './treasury-rules';
import { resolveScheduleWeekIndex } from './forecast-model';
import {
  AP_PAYMENT_PRIORITY_ORDER,
  type ApPaymentPriority,
  clampForecastHorizon,
  DEFAULT_FORECAST_HORIZON,
} from './treasury';
import { computeRollingAverage, type WeeklyAmountRow } from './rolling-budget';

export interface ApPriorityTotals {
  priority: ApPaymentPriority;
  totalOutstanding: number;
  overdueAmount: number;
  scheduledInHorizon: number;
}

export interface ForecastDiagnostics {
  /** Overdue receivables forced into forecast week 1 (current model behaviour). */
  overdueArWeek1: number;
  /** Receivables scheduled on or after as-of date within the horizon. */
  scheduledArOnDueDate: number;
  overdueArInvoiceCount: number;
  avgOverdueArDays: number | null;
  arCollectionBuckets: ArCollectionBucket[];
  /** Informational weighted expectation — not used in baseline forecast. */
  weightedCollectionExpectation: number;
  apByPriority: ApPriorityTotals[];
  apDeferrableTotal: number;
  apEssentialTotal: number;
  payrollDueWeek1: number;
  week1CashCoverageGap: number | null;
  rollingBurn: {
    lookbackWeeks: number;
    avgWeeklyInflows: number;
    avgWeeklyOutflows: number;
    avgWeeklyNet: number;
    sourcePeriods: string[];
    trend: 'rising' | 'falling' | 'stable' | 'unknown';
  } | null;
}

export interface ForecastDiagnosticsInput {
  asOfDate: string;
  horizonWeeks?: number;
  openingCash: number;
  receivables: Array<{
    outstandingAmount: number;
    invoiceDate: string;
    dueDate: string;
  }>;
  payables: Array<{
    outstandingAmount: number;
    dueDate: string;
    supplierPriority?: ApPaymentPriority;
  }>;
  weeklyActuals?: WeeklyAmountRow[];
  forecastLookbackWeeks?: number;
  week1Inflows?: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(`${end.slice(0, 10)}T00:00:00.000Z`).getTime()
    - new Date(`${start.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function emptyApTotals(): ApPriorityTotals[] {
  return AP_PAYMENT_PRIORITY_ORDER.map((priority) => ({
    priority,
    totalOutstanding: 0,
    overdueAmount: 0,
    scheduledInHorizon: 0,
  }));
}

function resolveRollingTrend(
  rows: WeeklyAmountRow[],
  lookbackWeeks: number,
  asOfDate: string,
): ForecastDiagnostics['rollingBurn'] {
  const avg = computeRollingAverage(rows, lookbackWeeks, asOfDate);
  if (avg.sourcePeriods.length === 0) return null;

  const byPeriod = new Map<string, number>();
  for (const row of rows) {
    if (!avg.sourcePeriods.includes(row.period)) continue;
    const magnitude = Math.abs(row.amount);
    const sign = row.category === 'revenue' ? 1 : -1;
    byPeriod.set(row.period, (byPeriod.get(row.period) ?? 0) + magnitude * sign);
  }

  const nets = avg.sourcePeriods.map((p) => byPeriod.get(p) ?? 0);
  let trend: 'rising' | 'falling' | 'stable' | 'unknown' = 'unknown';
  if (nets.length >= 2) {
    const firstHalf = nets.slice(0, Math.ceil(nets.length / 2));
    const secondHalf = nets.slice(Math.ceil(nets.length / 2));
    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const delta = secondAvg - firstAvg;
    if (Math.abs(delta) < Math.max(500, Math.abs(firstAvg) * 0.05)) trend = 'stable';
    else if (delta < 0) trend = 'falling';
    else trend = 'rising';
  }

  return {
    lookbackWeeks: avg.lookbackWeeks,
    avgWeeklyInflows: avg.avgInflows,
    avgWeeklyOutflows: avg.avgOutflows,
    avgWeeklyNet: round2(avg.avgInflows - avg.avgOutflows),
    sourcePeriods: avg.sourcePeriods,
    trend,
  };
}

/** Read-only diagnostics — does not alter forecast numbers. */
export function computeForecastDiagnostics(input: ForecastDiagnosticsInput): ForecastDiagnostics {
  const horizonWeeks = clampForecastHorizon(input.horizonWeeks ?? DEFAULT_FORECAST_HORIZON);
  const lookbackWeeks = input.forecastLookbackWeeks ?? 4;

  let overdueArWeek1 = 0;
  let scheduledArOnDueDate = 0;
  let overdueArInvoiceCount = 0;
  let overdueDaysSum = 0;

  for (const ar of input.receivables) {
    if (ar.outstandingAmount <= 0) continue;
    if (ar.dueDate < input.asOfDate) {
      overdueArWeek1 += ar.outstandingAmount;
      overdueArInvoiceCount += 1;
      overdueDaysSum += daysBetween(ar.dueDate, input.asOfDate);
    } else if (resolveScheduleWeekIndex(input.asOfDate, ar.dueDate, horizonWeeks) !== null) {
      scheduledArOnDueDate += ar.outstandingAmount;
    }
  }

  const arCollectionBuckets = calcARCollectionSchedule(
    input.receivables.map((r) => ({
      outstandingAmount: r.outstandingAmount,
      invoiceDate: r.invoiceDate,
    })),
    input.asOfDate,
  );
  const weightedCollectionExpectation = round2(
    arCollectionBuckets.reduce((sum, bucket) => sum + bucket.amount * bucket.weight, 0),
  );

  const apByPriority = emptyApTotals();
  const tierIndex = new Map(apByPriority.map((t, i) => [t.priority, i]));
  const deferrable: ApPaymentPriority[] = ['flexible', 'non_essential'];
  let apDeferrableTotal = 0;
  let apEssentialTotal = 0;
  let payrollDueWeek1 = 0;

  for (const ap of input.payables) {
    if (ap.outstandingAmount <= 0) continue;
    const priority = ap.supplierPriority ?? 'flexible';
    const idx = tierIndex.get(priority);
    if (idx === undefined) continue;

    apByPriority[idx].totalOutstanding = round2(
      apByPriority[idx].totalOutstanding + ap.outstandingAmount,
    );
    if (ap.dueDate < input.asOfDate) {
      apByPriority[idx].overdueAmount = round2(
        apByPriority[idx].overdueAmount + ap.outstandingAmount,
      );
    }
    const weekIndex = resolveScheduleWeekIndex(input.asOfDate, ap.dueDate, horizonWeeks);
    if (weekIndex !== null) {
      apByPriority[idx].scheduledInHorizon = round2(
        apByPriority[idx].scheduledInHorizon + ap.outstandingAmount,
      );
      if (weekIndex === 1 && priority === 'payroll') {
        payrollDueWeek1 = round2(payrollDueWeek1 + ap.outstandingAmount);
      }
    }
    if (deferrable.includes(priority)) {
      apDeferrableTotal = round2(apDeferrableTotal + ap.outstandingAmount);
    } else {
      apEssentialTotal = round2(apEssentialTotal + ap.outstandingAmount);
    }
  }

  const week1Inflows = input.week1Inflows ?? overdueArWeek1;
  const week1Coverage = round2(input.openingCash + week1Inflows);
  const week1CashCoverageGap =
    payrollDueWeek1 > 0 ? round2(week1Coverage - payrollDueWeek1) : null;

  return {
    overdueArWeek1: round2(overdueArWeek1),
    scheduledArOnDueDate: round2(scheduledArOnDueDate),
    overdueArInvoiceCount,
    avgOverdueArDays:
      overdueArInvoiceCount > 0
        ? Math.round(overdueDaysSum / overdueArInvoiceCount)
        : null,
    arCollectionBuckets,
    weightedCollectionExpectation,
    apByPriority,
    apDeferrableTotal,
    apEssentialTotal,
    payrollDueWeek1,
    week1CashCoverageGap,
    rollingBurn: input.weeklyActuals?.length
      ? resolveRollingTrend(input.weeklyActuals, lookbackWeeks, input.asOfDate)
      : null,
  };
}
