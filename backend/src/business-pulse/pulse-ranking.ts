import { ApPaymentPriority } from '@liqvia2/shared';
import { ObligationCategory } from '@prisma/client';

export type PulseSeverity = 'critical' | 'warning' | 'info';

export type PulseCategory =
  | 'obligation_due'
  | 'overdue_payable'
  | 'overdue_receivable'
  | 'expected_receipt'
  | 'cash_buffer'
  | 'forecast_shortfall'
  | 'stale_bank_data';

/**
 * Structured data only — no pre-baked English sentences. Business Pulse is shown in
 * 4 locales, and a server-templated "X overdue by Y days" string can't be translated
 * client-side; the frontend builds the localized title/message/action from these
 * fields via its wording library (see business-pulse-card.tsx).
 */
export interface BusinessPulseItem {
  id: string;
  severity: PulseSeverity;
  category: PulseCategory;
  linkPath: string;
  /** Internal urgency score used to rank/cap the list — not for display. */
  score: number;
  /** Proper noun (obligation name / supplier / customer) — empty when not applicable. */
  name: string;
  amount: number;
  currency: string;
  dueDate?: string;
  daysOverdue?: number;
  daysUntilDue?: number;
  runwayWeeks?: number;
  /** overdue_payable only — distinguishes "payroll overdue" from "supplier overdue" wording. */
  isPayrollPriority?: boolean;
  /** forecast_shortfall only. */
  weekIndex?: number;
  /** stale_bank_data only. */
  daysSinceUpdate?: number;
}

/** How urgent each obligation category is, independent of timing — payroll/tax first. */
const CATEGORY_WEIGHT: Record<ObligationCategory, number> = {
  payroll: 100,
  payg_withholding: 90,
  superannuation: 88,
  gst_bas: 85,
  loan_repayment: 70,
  rent: 65,
  insurance: 40,
  subscription: 20,
  other: 30,
};

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00.000Z`);
  const to = new Date(`${toIso}T00:00:00.000Z`);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildObligationItem(
  obligation: {
    obligationId: string;
    name: string;
    category: ObligationCategory;
    amount: number;
    dueDate: string;
  },
  asOfDate: string,
  currency: string,
): BusinessPulseItem {
  const daysUntilDue = daysBetween(asOfDate, obligation.dueDate);
  const urgencyMultiplier = daysUntilDue <= 0 ? 1.5 : daysUntilDue <= 3 ? 1.3 : daysUntilDue <= 7 ? 1.1 : 0.9;
  const severity: PulseSeverity = daysUntilDue <= 2 ? 'critical' : daysUntilDue <= 7 ? 'warning' : 'info';

  return {
    id: `obligation:${obligation.obligationId}:${obligation.dueDate}`,
    severity,
    category: 'obligation_due',
    linkPath: '/settings?tab=obligations',
    score: CATEGORY_WEIGHT[obligation.category] * urgencyMultiplier,
    name: obligation.name,
    amount: obligation.amount,
    currency,
    dueDate: obligation.dueDate,
    daysUntilDue,
  };
}

export function buildOverduePayableItem(payable: {
  id: string;
  counterparty: string;
  outstandingAmount: number;
  dueDate: string;
  daysOverdue: number;
  supplierPriority: ApPaymentPriority;
}, currency: string): BusinessPulseItem {
  const isPayrollPriority = payable.supplierPriority === 'payroll';
  const isCriticalPriority = isPayrollPriority || payable.supplierPriority === 'tax';
  const severity: PulseSeverity = isCriticalPriority || payable.daysOverdue > 30 ? 'critical' : 'warning';
  const priorityWeight = isCriticalPriority ? 90 : 40;

  return {
    id: `overdue_payable:${payable.id}`,
    severity,
    category: 'overdue_payable',
    linkPath: '/ledger',
    score: priorityWeight + Math.min(payable.daysOverdue, 60) + Math.min(payable.outstandingAmount / 1000, 30),
    name: payable.counterparty,
    amount: payable.outstandingAmount,
    currency,
    dueDate: payable.dueDate,
    daysOverdue: payable.daysOverdue,
    isPayrollPriority,
  };
}

export function buildOverdueReceivableItem(receivable: {
  id: string;
  counterparty: string;
  outstandingAmount: number;
  dueDate: string;
  daysOverdue: number;
}, currency: string): BusinessPulseItem {
  const severity: PulseSeverity = receivable.daysOverdue > 60 ? 'critical' : 'warning';

  return {
    id: `overdue_receivable:${receivable.id}`,
    severity,
    category: 'overdue_receivable',
    linkPath: '/ledger',
    score: Math.min(receivable.daysOverdue, 90) * 0.8 + Math.min(receivable.outstandingAmount / 1000, 30),
    name: receivable.counterparty,
    amount: receivable.outstandingAmount,
    currency,
    dueDate: receivable.dueDate,
    daysOverdue: receivable.daysOverdue,
  };
}

export function buildExpectedReceiptItem(receivable: {
  id: string;
  counterparty: string;
  outstandingAmount: number;
  dueDate: string;
}, asOfDate: string, currency: string): BusinessPulseItem {
  const daysUntilDue = daysBetween(asOfDate, receivable.dueDate);

  return {
    id: `expected_receipt:${receivable.id}`,
    severity: 'info',
    category: 'expected_receipt',
    linkPath: '/ledger',
    score: 20 + Math.min(receivable.outstandingAmount / 2000, 20),
    name: receivable.counterparty,
    amount: receivable.outstandingAmount,
    currency,
    dueDate: receivable.dueDate,
    daysUntilDue,
  };
}

/**
 * Only surfaced when genuinely concerning — a "you're fine" item here would just
 * repeat the runway KPI already on the dashboard. Framed around free cash (what's
 * safe to spend after known obligations) rather than runway-in-weeks, since that's
 * already shown elsewhere on the page. Severity alone distinguishes the negative-cash
 * vs thin-runway wording on the client (critical vs warning).
 */
export function buildCashBufferItem(
  freeAvailableCash: number,
  runwayWeeks: number | null,
  currency: string,
): BusinessPulseItem | null {
  if (freeAvailableCash < 0) {
    return {
      id: 'cash_buffer',
      severity: 'critical',
      category: 'cash_buffer',
      linkPath: '/forecast',
      score: 120,
      name: '',
      amount: freeAvailableCash,
      currency,
      runwayWeeks: runwayWeeks ?? undefined,
    };
  }
  if (runwayWeeks !== null && runwayWeeks < 6) {
    return {
      id: 'cash_buffer',
      severity: 'warning',
      category: 'cash_buffer',
      linkPath: '/forecast',
      score: 80,
      name: '',
      amount: freeAvailableCash,
      currency,
      runwayWeeks,
    };
  }
  return null;
}

/**
 * Distinct from buildCashBufferItem: that's a single point-in-time subtraction
 * (cash minus all known outflows over the horizon); this walks the actual week-by-
 * week forecast and flags the first week projected to go negative, which can catch
 * a timing-driven dip that free-cash alone doesn't surface.
 */
export function buildForecastShortfallItem(
  forecastLines: Array<{ weekIndex: number; weekStart: string; closingCash: number }>,
  currency: string,
): BusinessPulseItem | null {
  const firstNegative = forecastLines
    .slice()
    .sort((a, b) => a.weekIndex - b.weekIndex)
    .find((line) => line.closingCash < 0);
  if (!firstNegative) return null;

  const severity: PulseSeverity = firstNegative.weekIndex <= 4 ? 'critical' : 'warning';

  return {
    id: `forecast_shortfall:${firstNegative.weekIndex}`,
    severity,
    category: 'forecast_shortfall',
    linkPath: '/forecast',
    score: severity === 'critical' ? 110 : 65,
    name: '',
    amount: firstNegative.closingCash,
    currency,
    dueDate: firstNegative.weekStart,
    weekIndex: firstNegative.weekIndex,
  };
}

/** Low urgency by design (info/"Monitor") — a data-freshness nudge, not a risk. */
export function buildStaleBankDataItem(
  daysSinceUpdate: number | null,
  currency: string,
): BusinessPulseItem | null {
  if (daysSinceUpdate === null || daysSinceUpdate <= 14) return null;
  return {
    id: 'stale_bank_data',
    severity: 'info',
    category: 'stale_bank_data',
    linkPath: '/uploads',
    score: 15,
    name: '',
    amount: 0,
    currency,
    daysSinceUpdate,
  };
}

/** Sorts by urgency score (desc) and caps to the top N — the 30-second dashboard rule. */
export function rankPulseItems(candidates: BusinessPulseItem[], max = 5): BusinessPulseItem[] {
  return candidates
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
