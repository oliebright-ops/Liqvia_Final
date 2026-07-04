import { Module } from '@nestjs/common';
import { RecurringObligationsModule } from '../recurring-obligations/recurring-obligations.module';
import { AlertRulesService } from './alert-rules.service';
import { ForecastCalculationService } from './forecast-calculation.service';
import { LiquidityRiskService } from './liquidity-risk.service';
import { TreasuryController } from './treasury.controller';
import { TreasuryEngineService } from './treasury-engine.service';
import { TreasuryKpiService } from './treasury-kpi.service';
import { TreasuryRulesService } from './treasury-rules.service';

@Module({
  imports: [RecurringObligationsModule],
  controllers: [TreasuryController],
  providers: [
    TreasuryRulesService,
    LiquidityRiskService,
    TreasuryKpiService,
    ForecastCalculationService,
    AlertRulesService,
    TreasuryEngineService,
  ],
  exports: [
    TreasuryRulesService,
    LiquidityRiskService,
    TreasuryKpiService,
    ForecastCalculationService,
    AlertRulesService,
    TreasuryEngineService,
  ],
})
export class TreasuryModule {}
