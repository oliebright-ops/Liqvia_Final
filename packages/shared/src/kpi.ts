import type { LiquidityStatus } from './treasury';

/** Locked MVP calculation constants — keep in sync with docs/finance-logic/kpi-dictionary.md */
export const KPI_DEFAULTS = {
  burnLookbackWeeks: 4,
  upcomingPayablesDays: 14,
  forecastHorizonWeeks: 13,
} as const;

export interface BankBalanceInput {
  balance: number;
  balanceDate: string;
}

export interface WeeklyCashFlowInput {
  weekStart: string;
  inflows: number;
  outflows: number;
}

export interface ReceivableInput {
  outstandingAmount: number;
  invoiceDate: string;
  dueDate: string;
}

export interface PayableInput {
  outstandingAmount: number;
  billDate: string;
  dueDate: string;
}

export interface BudgetActualInput {
  period: string;
  category: string;
  budgetAmount: number;
  actualAmount: number;
}

export interface ForecastLineInput {
  weekIndex: number;
  closingCash: number;
}

export interface BudgetVarianceResult {
  period: string;
  category: string;
  budgetAmount: number;
  actualAmount: number;
  varianceAmount: number;
  variancePercent: number | null;
}

export interface TreasuryKpiDashboard {
  currency: string;
  asOfDate: string;
  currentCash: number;
  week13ClosingCash: number | null;
  weeklyNetBurn: number;
  runwayWeeks: number | null;
  liquidityStatus: LiquidityStatus;
  overdueReceivables: number;
  upcomingPayables: number;
  budgetVariances: BudgetVarianceResult[];
  forecastVarianceAmount: number | null;
  collectionDays: number | null;
  payablesDays: number | null;
}
