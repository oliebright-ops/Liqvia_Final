import { ApPaymentPriority, formatCurrency } from '@liqvia2/shared';
import { ObligationCategory } from '@prisma/client';

export type PulseSeverity = 'critical' | 'warning' | 'info';

export type PulseCategory =
  | 'obligation_due'
  | 'overdue_payable'
  | 'overdue_receivable'
  | 'expected_receipt'
  | 'cash_buffer';

export interface BusinessPulseItem {
  id: string;
  severity: PulseSeverity;
  category: PulseCategory;
  title: string;
  message: string;
  amount?: number;
  date?: string;
  linkPath: string;
  /** Internal urgency score used to rank/cap the list — not for display. */
  score: number;
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
  const dueWord = daysUntilDue <= 0 ? 'due today' : daysUntilDue === 1 ? 'due tomorrow' : `due in ${daysUntilDue} days`;

  return {
    id: `obligation:${obligation.obligationId}:${obligation.dueDate}`,
    severity,
    category: 'obligation_due',
    title: obligation.name,
    message: `${formatCurrency(obligation.amount, currency)} ${dueWord} (${obligation.dueDate}).`,
    amount: obligation.amount,
    date: obligation.dueDate,
    linkPath: '/settings?tab=obligations',
    score: CATEGORY_WEIGHT[obligation.category] * urgencyMultiplier,
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
    title: `${payable.counterparty} overdue`,
    message: `${formatCurrency(payable.outstandingAmount, currency)} overdue by ${payable.daysOverdue} day(s) (due ${payable.dueDate}).`,
    amount: payable.outstandingAmount,
    date: payable.dueDate,
    linkPath: '/ledger',
    score: priorityWeight + Math.min(payable.daysOverdue, 60) + Math.min(payable.outstandingAmount / 1000, 30),
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
    title: `Collect from ${receivable.counterparty}`,
    message: `${formatCurrency(receivable.outstandingAmount, currency)} overdue by ${receivable.daysOverdue} day(s) (due ${receivable.dueDate}).`,
    amount: receivable.outstandingAmount,
    date: receivable.dueDate,
    linkPath: '/ledger',
    score: Math.min(receivable.daysOverdue, 90) * 0.8 + Math.min(receivable.outstandingAmount / 1000, 30),
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
    title: `Expecting payment from ${receivable.counterparty}`,
    message: `${formatCurrency(receivable.outstandingAmount, currency)} expected in ${daysUntilDue} day(s) (due ${receivable.dueDate}).`,
    amount: receivable.outstandingAmount,
    date: receivable.dueDate,
    linkPath: '/ledger',
    score: 20 + Math.min(receivable.outstandingAmount / 2000, 20),
  };
}

/**
 * Only surfaced when genuinely concerning — a "you're fine" item here would just
 * repeat the runway KPI already on the dashboard. Framed around free cash (what's
 * safe to spend after known obligations) rather than runway-in-weeks, since that's
 * already shown elsewhere on the page.
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
      title: 'No safe cash buffer',
      message: `After known obligations, free available cash is ${formatCurrency(freeAvailableCash, currency)}.`,
      amount: freeAvailableCash,
      linkPath: '/forecast',
      score: 120,
    };
  }
  if (runwayWeeks !== null && runwayWeeks < 6) {
    return {
      id: 'cash_buffer',
      severity: 'warning',
      category: 'cash_buffer',
      title: 'Cash buffer is thin',
      message: `Only ${formatCurrency(freeAvailableCash, currency)} free after known obligations, with ${runwayWeeks.toFixed(1)} weeks of runway.`,
      amount: freeAvailableCash,
      linkPath: '/forecast',
      score: 80,
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
