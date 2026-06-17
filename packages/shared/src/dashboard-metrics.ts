import { accountClosingBalance, isBalanceAnchor } from './bank-ledger';
import { computeBudgetVarianceAmount } from './budget-variance';
import type { LiquidityStatus } from './treasury';
import { categorizeTransaction, getLiquidityBand } from './treasury-rules';

export interface CashPositionMetrics {
  totalBalance: number;
  bankAccountCount: number;
  weekOverWeekChangePct: number | null;
  hasData: boolean;
}

export interface CashRunwayMetrics {
  runwayWeeks: number | null;
  weeklyBurn: number;
  liquidityStatus: LiquidityStatus;
  hasData: boolean;
}

export interface BudgetVarianceMtdMetrics {
  varianceAmount: number | null;
  variancePct: number | null;
  period: string;
  hasData: boolean;
}

export interface ArDue30Metrics {
  amountDue30Days: number | null;
  delayed90PlusDays: number | null;
  hasData: boolean;
}

export interface DashboardKpiCards {
  cashPosition: CashPositionMetrics;
  cashRunway: CashRunwayMetrics;
  budgetVarianceMtd: BudgetVarianceMtdMetrics;
  arDue30Days: ArDue30Metrics;
}

export interface DashboardTransactionRow {
  id: string;
  direction: 'IN' | 'OUT';
  description: string;
  category: string;
  transactionDate: string;
  amount: number;
  status: 'cleared' | 'pending';
}

export interface CashMovementInput {
  id: string;
  bankAccountId: string;
  movementDate: string;
  amount: number;
  isInflow: boolean;
  description?: string | null;
}

export interface ReceivableMetricInput {
  outstandingAmount: number;
  invoiceDate: string;
  dueDate: string;
}

export interface BudgetLineMetricInput {
  period: string;
  category?: string;
  budgetAmount: number;
  actualAmount: number;
}

function inferBudgetCategory(line: BudgetLineMetricInput): string {
  if (line.category) return line.category;
  if (line.budgetAmount >= 0 && line.actualAmount >= 0) return 'revenue';
  return 'expenses';
}

export function computeCashPosition(
  bankAccountIds: string[],
  movements: CashMovementInput[],
  asOfDate: string,
): CashPositionMetrics {
  if (bankAccountIds.length === 0) {
    return { totalBalance: 0, bankAccountCount: 0, weekOverWeekChangePct: null, hasData: false };
  }

  const totalBalance = bankAccountIds.reduce(
    (sum, id) =>
      sum +
      accountClosingBalance(
        movements.filter((m) => m.bankAccountId === id),
        asOfDate,
      ),
    0,
  );
  const sevenDaysAgo = addDays(asOfDate, -7);
  const balance7dAgo = bankAccountIds.reduce(
    (sum, id) =>
      sum +
      accountClosingBalance(
        movements.filter((m) => m.bankAccountId === id),
        sevenDaysAgo,
      ),
    0,
  );

  const weekOverWeekChangePct =
    balance7dAgo > 0 ? round1(((totalBalance - balance7dAgo) / balance7dAgo) * 100) : null;

  return {
    totalBalance: round2(totalBalance),
    bankAccountCount: bankAccountIds.length,
    weekOverWeekChangePct,
    hasData: totalBalance > 0 || movements.length > 0,
  };
}

export function computeCashRunway(
  openingCash: number,
  movements: CashMovementInput[],
  asOfDate: string,
): CashRunwayMetrics {
  const fourWeeksAgo = addDays(asOfDate, -28);
  const outflows = movements
    .filter(
      (m) =>
        !m.isInflow &&
        !isBalanceAnchor(m.description) &&
        m.movementDate.slice(0, 10) > fourWeeksAgo &&
        m.movementDate.slice(0, 10) <= asOfDate,
    )
    .reduce((s, m) => s + m.amount, 0);

  const weeklyBurn = round2(outflows / 4);
  const rawRunway = weeklyBurn <= 0 ? null : openingCash / weeklyBurn;
  const runwayWeeks = rawRunway === null ? null : Math.round(rawRunway);

  return {
    runwayWeeks,
    weeklyBurn,
    liquidityStatus: getLiquidityBand(rawRunway),
    hasData: openingCash > 0 || movements.some((m) => !isBalanceAnchor(m.description)),
  };
}

export function computeBudgetVarianceMtd(
  lines: BudgetLineMetricInput[],
  asOfDate: string,
): BudgetVarianceMtdMetrics {
  const period = asOfDate.slice(0, 7);
  const mtd = lines.filter((l) => l.period === period);

  if (mtd.length === 0) {
    return { varianceAmount: null, variancePct: null, period, hasData: false };
  }

  const totalBudget = mtd.reduce((s, l) => s + l.budgetAmount, 0);
  const varianceAmount = round2(
    mtd.reduce(
      (s, l) =>
        s + computeBudgetVarianceAmount(inferBudgetCategory(l), l.budgetAmount, l.actualAmount),
      0,
    ),
  );
  const budgetBase = Math.abs(totalBudget);
  const variancePct = budgetBase !== 0 ? round1((varianceAmount / budgetBase) * 100) : null;

  return { varianceAmount, variancePct, period, hasData: true };
}

export function computeArDue30Days(
  receivables: ReceivableMetricInput[],
  asOfDate: string,
): ArDue30Metrics {
  if (receivables.length === 0) {
    return { amountDue30Days: null, delayed90PlusDays: null, hasData: false };
  }

  const thirtyDaysOut = addDays(asOfDate, 30);
  const open = receivables.filter((r) => r.outstandingAmount > 0);

  const amountDue30Days = open
    .filter((r) => r.dueDate >= asOfDate && r.dueDate <= thirtyDaysOut)
    .reduce((s, r) => s + r.outstandingAmount, 0);

  const delayed90PlusDays = open
    .filter(
      (r) => daysBetween(r.dueDate, asOfDate) > 90 || daysBetween(r.invoiceDate, asOfDate) > 90,
    )
    .reduce((s, r) => s + r.outstandingAmount, 0);

  return {
    amountDue30Days: round2(amountDue30Days),
    delayed90PlusDays: round2(delayed90PlusDays),
    hasData: open.length > 0,
  };
}

export function mapRecentTransactions(
  movements: CashMovementInput[],
  asOfDate: string,
  limit = 10,
): DashboardTransactionRow[] {
  return movements
    .filter((m) => !isBalanceAnchor(m.description))
    .sort((a, b) => b.movementDate.localeCompare(a.movementDate))
    .slice(0, limit)
    .map((m) => {
      const date = m.movementDate.slice(0, 10);
      const daysSince = daysBetween(date, asOfDate);
      return {
        id: m.id,
        direction: m.isInflow ? 'IN' : 'OUT',
        description: m.description?.trim() || (m.isInflow ? 'Inflow' : 'Outflow'),
        category: categorizeTransaction(m.description),
        transactionDate: date,
        amount: m.amount,
        status: daysSince <= 3 ? 'pending' : 'cleared',
      };
    });
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const PENDING_CLEARANCE_DAYS = 3;
export const STALE_RECONCILIATION_HOURS = 48;

/** Pending bank items older than 48h — stale reconciliation candidates. */
export function hasStaleUnreconciledTransactions(
  movements: CashMovementInput[],
  asOfDate: string,
): boolean {
  return countStaleUnreconciledTransactions(movements, asOfDate) > 0;
}

export function countStaleUnreconciledTransactions(
  movements: CashMovementInput[],
  asOfDate: string,
): number {
  return movements.filter((m) => isStaleUnreconciledTransaction(m, asOfDate)).length;
}

function isStaleUnreconciledTransaction(m: CashMovementInput, asOfDate: string): boolean {
  if (isBalanceAnchor(m.description)) return false;
  const date = m.movementDate.slice(0, 10);
  const days = daysBetween(date, asOfDate);
  const hours = hoursBetween(date, asOfDate);
  return days <= PENDING_CLEARANCE_DAYS && hours > STALE_RECONCILIATION_HOURS;
}

function hoursBetween(start: string, end: string): number {
  const startMs = new Date(`${start.slice(0, 10)}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end.slice(0, 10)}T12:00:00.000Z`).getTime();
  return Math.max(0, (endMs - startMs) / (1000 * 60 * 60));
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
