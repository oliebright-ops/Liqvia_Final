import type { ScenarioVariables, SummaryReport } from '@liqvia2/shared';
import { formatCurrency } from '@liqvia2/shared';

export type { SummaryReport };
/** @deprecated Use SummaryReport */
export type DashboardPayload = SummaryReport;

export interface WeeklyForecastLine {
  weekIndex: number;
  weekStart: string;
  openingCash: number;
  forecastInflows: number;
  forecastOutflows: number;
  closingCash: number;
  liquidityStatus: string;
}

export interface DashboardAlert {
  alertType: string;
  severity: string;
  message: string;
  weekIndex?: number | null;
  params?: {
    amount?: number;
    weeks?: number;
    weekIndex?: number;
    horizonWeeks?: number;
    status?: string;
    closing?: boolean;
    kind?: 'negative' | 'low';
  };
}

export interface BudgetVarianceLine {
  period: string;
  category: string;
  budgetAmount: number;
  actualAmount: number;
  varianceAmount: number;
  variancePercent: number | null;
}

export interface ScenarioComparison {
  scenarioId: string;
  name: string;
  variables: ScenarioVariables;
  baseline: {
    lines: WeeklyForecastLine[];
    week13ClosingCash: number | null;
    runwayWeeks: number | null;
    liquidityStatus?: string;
  };
  scenario: {
    lines: WeeklyForecastLine[];
    week13ClosingCash: number | null;
    runwayWeeks: number | null;
    liquidityStatus?: string;
  };
  delta: { week13ClosingCash: number | null; runwayWeeks: number | null };
}

export interface AiInsightResponse {
  insight: string;
  model: string;
  source: 'openai' | 'rule_based';
}

export function liquidityVariant(
  status: string,
): 'success' | 'warning' | 'error' | 'muted' | 'default' {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'moderate':
      return 'warning';
    case 'high_risk':
    case 'critical':
      return 'error';
    default:
      return 'muted';
  }
}

/** @deprecated Use formatCurrency(value, currency) from @liqvia2/shared */
export function formatMoney(currency: string, value: number | null): string {
  return formatCurrency(value, currency);
}
