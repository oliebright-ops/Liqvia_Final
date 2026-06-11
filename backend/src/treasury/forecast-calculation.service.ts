import { Injectable } from '@nestjs/common';
import {
  buildForecastModel,
  ForecastCalculationInput,
  WeeklyForecastLine,
  type RollingBudgetCategory,
} from '@liqvia2/shared';

@Injectable()
export class ForecastCalculationService {
  calculateBaselineForecast(input: ForecastCalculationInput): WeeklyForecastLine[] {
    const result = buildForecastModel({
      asOfDate: input.asOfDate,
      openingCash: input.openingCash,
      horizonWeeks: input.horizonWeeks,
      weeklyActuals: input.weeklyActuals?.map((row) => ({
        period: row.period,
        category: row.category as RollingBudgetCategory,
        amount: row.amount,
        accountCode: row.accountCode,
      })),
      forecastLookbackWeeks: input.forecastLookbackWeeks,
      receivables: input.receivables.map((r, index) => ({
        id: `ar-${index}`,
        counterparty: 'Receivable',
        dueDate: r.dueDate ?? r.invoiceDate,
        outstandingAmount: r.outstandingAmount,
      })),
      payables: input.payables.map((p, index) => ({
        id: `ap-${index}`,
        counterparty: 'Payable',
        dueDate: p.dueDate,
        outstandingAmount: p.outstandingAmount,
      })),
      weeklyAdjustments: input.weeklyAdjustments,
    });

    return result.weeks.map((w) => ({
      weekIndex: w.weekIndex,
      weekStart: w.weekStart,
      openingCash: w.openingCash,
      forecastInflows: w.forecastInflows,
      forecastOutflows: w.forecastOutflows,
      closingCash: w.closingCash,
      liquidityStatus: w.liquidityStatus,
    }));
  }
}

export { dateToWeekIndex, startOfWeekUtc } from '@liqvia2/shared';
