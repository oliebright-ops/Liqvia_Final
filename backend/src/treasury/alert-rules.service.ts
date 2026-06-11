import { Injectable } from '@nestjs/common';
import {
  formatCurrency,
  LiquidityStatus,
  TreasuryAlert,
  WeeklyForecastLine,
} from '@liqvia2/shared';

export interface AlertEvaluationInput {
  forecastLines: WeeklyForecastLine[];
  overdueReceivables: number;
  upcomingPayables: number;
  runwayWeeks: number | null;
  liquidityStatus: LiquidityStatus;
  currency?: string;
  overdueThreshold?: number;
  upcomingPayablesThreshold?: number;
}

@Injectable()
export class AlertRulesService {
  private readonly defaultOverdueThreshold = 10_000;
  private readonly defaultUpcomingThreshold = 20_000;

  evaluate(input: AlertEvaluationInput): TreasuryAlert[] {
    const alerts: TreasuryAlert[] = [];
    const currency = input.currency ?? 'USD';
    const fmt = (amount: number) => formatCurrency(amount, currency);
    const overdueThreshold = input.overdueThreshold ?? this.defaultOverdueThreshold;
    const upcomingThreshold = input.upcomingPayablesThreshold ?? this.defaultUpcomingThreshold;

    for (const line of input.forecastLines) {
      if (line.closingCash < 0) {
        alerts.push({
          alertType: 'negative_cash',
          severity: 'critical',
          message: `Projected negative cash (${fmt(line.closingCash)}) in week ${line.weekIndex}`,
          weekIndex: line.weekIndex,
          params: { amount: line.closingCash, weekIndex: line.weekIndex },
        });
      }
    }

    if (input.liquidityStatus === 'critical' || input.liquidityStatus === 'high_risk') {
      alerts.push({
        alertType: 'liquidity_stress',
        severity: input.liquidityStatus === 'critical' ? 'critical' : 'warning',
        message: `Liquidity status is ${input.liquidityStatus.replace('_', ' ')}`,
        params: { status: input.liquidityStatus },
      });
    }

    if (input.runwayWeeks !== null && input.runwayWeeks < 4) {
      alerts.push({
        alertType: 'runway',
        severity: 'critical',
        message: `Cash runway is ${input.runwayWeeks.toFixed(1)} weeks`,
        params: { weeks: input.runwayWeeks },
      });
    } else if (input.runwayWeeks !== null && input.runwayWeeks < 8) {
      alerts.push({
        alertType: 'runway',
        severity: 'warning',
        message: `Cash runway is ${input.runwayWeeks.toFixed(1)} weeks`,
        params: { weeks: input.runwayWeeks },
      });
    }

    if (input.overdueReceivables >= overdueThreshold) {
      alerts.push({
        alertType: 'delayed_collection',
        severity: 'warning',
        message: `Overdue receivables total ${fmt(input.overdueReceivables)}`,
        params: { amount: input.overdueReceivables },
      });
    }

    if (input.upcomingPayables >= upcomingThreshold) {
      alerts.push({
        alertType: 'upcoming_obligation',
        severity: 'warning',
        message: `Upcoming payables total ${fmt(input.upcomingPayables)} in the next 14 days`,
        params: { amount: input.upcomingPayables },
      });
    }

    const horizonWeek =
      input.forecastLines.length > 0
        ? Math.max(...input.forecastLines.map((l) => l.weekIndex))
        : null;
    const horizonClosing = horizonWeek
      ? input.forecastLines.find((l) => l.weekIndex === horizonWeek)
      : undefined;
    if (
      horizonClosing &&
      horizonClosing.closingCash < 0 &&
      !alerts.some((a) => a.alertType === 'negative_cash')
    ) {
      alerts.push({
        alertType: 'negative_cash',
        severity: 'critical',
        message: `Week ${horizonWeek} closing cash is negative (${fmt(horizonClosing.closingCash)})`,
        weekIndex: horizonWeek!,
        params: {
          amount: horizonClosing.closingCash,
          weekIndex: horizonWeek!,
          closing: true,
        },
      });
    }

    return alerts;
  }
}
