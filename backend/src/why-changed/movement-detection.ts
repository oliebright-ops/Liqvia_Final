import { BudgetCategory } from '@prisma/client';

export interface MaterialMovement {
  label: string;
  current: number;
  previous: number;
  delta: number;
  percentChange: number | null;
  currentPeriod: string;
  previousPeriod: string;
}

/** A dollar movement below this AND below the percent threshold is noise, not signal. */
const MATERIALITY_ABS = 500;
const MATERIALITY_PCT = 15;
/** Runway is in weeks, not dollars — a separate, smaller absolute threshold applies. */
const MATERIALITY_RUNWAY_WEEKS = 1;

export function isMaterial(delta: number, previous: number): boolean {
  if (Math.abs(delta) >= MATERIALITY_ABS) return true;
  if (previous !== 0 && Math.abs((delta / Math.abs(previous)) * 100) >= MATERIALITY_PCT) return true;
  return false;
}

export function isMaterialRunwayChange(deltaWeeks: number): boolean {
  return Math.abs(deltaWeeks) >= MATERIALITY_RUNWAY_WEEKS;
}

function percentChange(delta: number, previous: number): number | null {
  return previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
}

const CATEGORY_LABEL: Record<BudgetCategory, string> = {
  revenue: 'Revenue',
  payroll: 'Payroll',
  expenses: 'Expenses',
  capex: 'Capital expenditure',
  loan_repayment: 'Loan repayments',
};

/**
 * Compares actuals from the two most recent distinct periods present, per category —
 * this uses genuinely existing historical data (WeeklyActual already has real period
 * history), so it works from day one rather than needing weeks of new snapshots to
 * accumulate before it has anything to compare.
 */
export function buildActualMovements(
  actuals: Array<{ period: string; category: BudgetCategory; amount: number }>,
): MaterialMovement[] {
  const periods = [...new Set(actuals.map((a) => a.period))].sort();
  if (periods.length < 2) return [];
  const currentPeriod = periods[periods.length - 1];
  const previousPeriod = periods[periods.length - 2];

  const sumFor = (period: string, category: BudgetCategory) =>
    actuals
      .filter((a) => a.period === period && a.category === category)
      .reduce((sum, a) => sum + a.amount, 0);

  const categories = [...new Set(actuals.map((a) => a.category))];
  const movements: MaterialMovement[] = [];

  for (const category of categories) {
    const current = sumFor(currentPeriod, category);
    const previous = sumFor(previousPeriod, category);
    const delta = current - previous;
    if (!isMaterial(delta, previous)) continue;
    movements.push({
      label: CATEGORY_LABEL[category],
      current,
      previous,
      delta,
      percentChange: percentChange(delta, previous),
      currentPeriod,
      previousPeriod,
    });
  }

  return movements.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export interface KpiPoint {
  asOfDate: string;
  currentCash: number;
  runwayWeeks: number | null;
  overdueReceivables: number;
  upcomingPayables: number;
  freeAvailableCash: number;
}

/** Compares the live KPI position against the most recent snapshot old enough to be
 * a meaningful "previous period" — see KpiSnapshotService for how that's sourced. */
export function buildSnapshotMovements(current: KpiPoint, previous: KpiPoint): MaterialMovement[] {
  const movements: MaterialMovement[] = [];

  const pushIfMaterial = (label: string, curr: number, prev: number) => {
    const delta = curr - prev;
    if (isMaterial(delta, prev)) {
      movements.push({
        label,
        current: curr,
        previous: prev,
        delta,
        percentChange: percentChange(delta, prev),
        currentPeriod: current.asOfDate,
        previousPeriod: previous.asOfDate,
      });
    }
  };

  pushIfMaterial('Cash position', current.currentCash, previous.currentCash);
  pushIfMaterial('Overdue receivables', current.overdueReceivables, previous.overdueReceivables);
  pushIfMaterial('Upcoming payables', current.upcomingPayables, previous.upcomingPayables);
  pushIfMaterial('Free available cash', current.freeAvailableCash, previous.freeAvailableCash);

  if (current.runwayWeeks !== null && previous.runwayWeeks !== null) {
    const deltaWeeks = current.runwayWeeks - previous.runwayWeeks;
    if (isMaterialRunwayChange(deltaWeeks)) {
      movements.push({
        label: 'Cash runway (weeks)',
        current: current.runwayWeeks,
        previous: previous.runwayWeeks,
        delta: deltaWeeks,
        percentChange: percentChange(deltaWeeks, previous.runwayWeeks),
        currentPeriod: current.asOfDate,
        previousPeriod: previous.asOfDate,
      });
    }
  }

  return movements.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
