import { Injectable } from '@nestjs/common';
import { AR_COLLECTION_WEIGHTS, LIQUIDITY_THRESHOLDS } from '@liqvia2/shared';

@Injectable()
export class TreasuryRulesService {
  getApprovedRules() {
    return {
      forecastModel: 'openingCash + inflows - outflows = closingCash',
      forecastWeeks: 13,
      granularity: 'weekly',
      arCollection: AR_COLLECTION_WEIGHTS,
      apPaymentPriority: ['payroll', 'tax', 'critical', 'flexible', 'non_essential'],
      runwayFormula: 'cash / weeklyNetBurn',
      liquidityThresholds: LIQUIDITY_THRESHOLDS,
      scenarioVariables: [
        'revenueDeclinePercent',
        'revenueGrowthPercent',
        'payrollIncreasePercent',
        'receivableDelayDays',
        'payableDelayDays',
        'expenseGrowthPercent',
        'taxIncreasePercent',
        'oneOffInflowAmount',
        'oneOffInflowWeek',
        'oneOffOutflowAmount',
        'oneOffOutflowWeek',
      ],
    };
  }
}
