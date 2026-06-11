import { buildForecastModel, type ForecastModelInput } from './forecast-model';
import { clampForecastHorizon, type TreasuryAlert } from './treasury';

export interface PayableHorizonInput {
  dueDate: string;
  outstandingAmount: number;
}

export interface FreeCashWeekLine {
  weekIndex: number;
  weekStart: string;
  apOutflows: number;
  recurringOutflows: number;
  totalOutflows: number;
  cumulativeOutflows: number;
}

/** Executive free-cash snapshot — horizon-scoped via cumulative forecast outflows. */
export interface FreeCashReport {
  asOfDate: string;
  horizonWeeks: number;
  currency: string;
  closingBalance: number;
  /** Cumulative baseline forecast outflows (AP + recurring) over weeks 1..N. */
  fixedOutflowsHorizon: number;
  apOutflowsHorizon: number;
  recurringOutflowsHorizon: number;
  overduePayables: number;
  freeAvailableCash: number;
  weeks: FreeCashWeekLine[];
}

export interface FreeAvailableCashResult {
  freeAvailableCash: number;
  fixedOutflowsHorizon: number;
  closingBalance: number;
  horizonWeeks: number;
}

/**
 * Build a horizon-scoped free cash report from the baseline forecast model.
 * Fixed outflows = Σ forecastOutflows for weeks 1..horizon (AP scheduled + recurring burn).
 */
export function buildFreeCashReport(
  closingBalance: number,
  forecastInput: ForecastModelInput,
  overduePayables: number,
  currency: string,
): FreeCashReport {
  const horizonWeeks = clampForecastHorizon(forecastInput.horizonWeeks ?? 13);
  const model = buildForecastModel({ ...forecastInput, horizonWeeks });
  const weeksInScope = model.weeks.filter((w) => w.weekIndex <= horizonWeeks);

  let cumulative = 0;
  const weeks: FreeCashWeekLine[] = weeksInScope.map((w) => {
    const apOutflows = w.arApOutflows;
    const recurringOutflows = round2(w.forecastOutflows - apOutflows);
    cumulative += w.forecastOutflows;
    return {
      weekIndex: w.weekIndex,
      weekStart: w.weekStart,
      apOutflows,
      recurringOutflows,
      totalOutflows: w.forecastOutflows,
      cumulativeOutflows: round2(cumulative),
    };
  });

  const fixedOutflowsHorizon = round2(weeksInScope.reduce((sum, w) => sum + w.forecastOutflows, 0));
  const apOutflowsHorizon = round2(weeksInScope.reduce((sum, w) => sum + w.arApOutflows, 0));
  const recurringOutflowsHorizon = round2(fixedOutflowsHorizon - apOutflowsHorizon);

  return {
    asOfDate: forecastInput.asOfDate,
    horizonWeeks,
    currency,
    closingBalance: round2(closingBalance),
    fixedOutflowsHorizon,
    apOutflowsHorizon,
    recurringOutflowsHorizon,
    overduePayables: round2(overduePayables),
    freeAvailableCash: round2(closingBalance - fixedOutflowsHorizon),
    weeks,
  };
}

/** @deprecated Prefer buildFreeCashReport — kept for legacy callers. */
export function sumFixedOutflowsInHorizon(
  payables: PayableHorizonInput[],
  asOfDate: string,
  horizonWeeks: number,
): number {
  const input: ForecastModelInput = {
    asOfDate,
    openingCash: 0,
    horizonWeeks,
    receivables: [],
    payables: payables.map((p, i) => ({
      id: `ap-${i}`,
      counterparty: 'Payable',
      dueDate: p.dueDate,
      outstandingAmount: p.outstandingAmount,
    })),
  };
  const model = buildForecastModel(input);
  return round2(
    model.weeks
      .filter((w) => w.weekIndex <= clampForecastHorizon(horizonWeeks))
      .reduce((sum, w) => sum + w.forecastOutflows, 0),
  );
}

/** @deprecated Prefer buildFreeCashReport. */
export function computeFreeAvailableCash(
  closingBalance: number,
  payables: PayableHorizonInput[],
  asOfDate: string,
  horizonWeeks: number,
): FreeAvailableCashResult {
  const report = buildFreeCashReport(
    closingBalance,
    {
      asOfDate,
      openingCash: closingBalance,
      horizonWeeks,
      receivables: [],
      payables: payables.map((p, i) => ({
        id: `ap-${i}`,
        counterparty: 'Payable',
        dueDate: p.dueDate,
        outstandingAmount: p.outstandingAmount,
      })),
    },
    payables
      .filter((p) => p.dueDate < asOfDate && p.outstandingAmount > 0)
      .reduce((s, p) => s + p.outstandingAmount, 0),
    'RUB',
  );
  return {
    freeAvailableCash: report.freeAvailableCash,
    fixedOutflowsHorizon: report.fixedOutflowsHorizon,
    closingBalance: report.closingBalance,
    horizonWeeks: report.horizonWeeks,
  };
}

/** Liquidity alerts when horizon-scoped free cash is negative or critically low. */
export function evaluateFreeCashAlerts(
  freeAvailableCash: number,
  cashTotal: number,
  horizonWeeks: number,
): TreasuryAlert[] {
  const horizon = clampForecastHorizon(horizonWeeks);
  const alerts: TreasuryAlert[] = [];

  if (freeAvailableCash < 0) {
    alerts.push({
      alertType: 'free_cash_risk',
      severity: 'critical',
      message: `Free available cash is negative after ${horizon}-week forecast outflows`,
      params: { amount: round2(freeAvailableCash), horizonWeeks: horizon, kind: 'negative' },
    });
    return alerts;
  }

  if (cashTotal > 0 && freeAvailableCash < cashTotal * 0.1) {
    alerts.push({
      alertType: 'free_cash_risk',
      severity: 'warning',
      message: `Free available cash is low after ${horizon}-week forecast outflows`,
      params: { amount: round2(freeAvailableCash), horizonWeeks: horizon, kind: 'low' },
    });
  }

  return alerts;
}

export function mergeFreeCashAlerts(
  alerts: TreasuryAlert[],
  freeAvailableCash: number,
  cashTotal: number,
  horizonWeeks: number,
): TreasuryAlert[] {
  const without = alerts.filter((a) => a.alertType !== 'free_cash_risk');
  return [...without, ...evaluateFreeCashAlerts(freeAvailableCash, cashTotal, horizonWeeks)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
