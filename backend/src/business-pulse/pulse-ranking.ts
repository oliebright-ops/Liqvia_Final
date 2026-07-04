import { ApPaymentPriority } from '@liqvia2/shared';
import { ObligationCategory } from '@prisma/client';

export type PulseSeverity = 'critical' | 'warning' | 'info';

export type PulseCategory =
  | 'obligation_due'
  | 'overdue_payable'
  | 'overdue_receivable'
  | 'expected_receipt'
  | 'cash_buffer';

/**
 * Structured data only — no pre-baked English sentences. Business Pulse is shown in
 * 4 locales, and a server-templated "X overdue by Y days" string can't be translated
 * client-side; the frontend builds the localized title/message from these fields.
 */
export interface BusinessPulseItem {
  id: string;
  severity: PulseSeverity;
  category: PulseCategory;
  linkPath: string;
  /** Internal urgency score used to rank/cap the list — not for display. */
  score: number;
  /** Proper noun (obligation name / supplier / customer) — empty for cash_buffer. */
  name: string;
  amount: number;
  currency: string;
  dueDate?: string;
  daysOverdue?: number;
  daysUntilDue?: number;
  runwayWeeks?: number;
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
  const isCriticalPriority = payable.supplierPriority === 'payroll' || payable.supplierPriority === 'tax';
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

/** Sorts by urgency score (desc) and caps to the top N — the 30-second dashboard rule. */
export function rankPulseItems(candidates: BusinessPulseItem[], max = 5): BusinessPulseItem[] {
  return candidates
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
