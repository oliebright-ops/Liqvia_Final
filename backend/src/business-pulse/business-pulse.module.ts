import { Module } from '@nestjs/common';
import { RecurringObligationsModule } from '../recurring-obligations/recurring-obligations.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { FreeCashModule } from '../free-cash/free-cash.module';
import { DataQualityModule } from '../data-quality/data-quality.module';
import { AiModule } from '../ai/ai.module';
import { CashDrivenModule } from '../cash-driven/cash-driven.module';
import { BusinessPulseController } from './business-pulse.controller';
import { BusinessPulseService } from './business-pulse.service';

@Module({
  imports: [
    RecurringObligationsModule,
    TreasuryModule,
    FreeCashModule,
    DataQualityModule,
    AiModule,
    CashDrivenModule,
  ],
  controllers: [BusinessPulseController],
  providers: [BusinessPulseService],
  exports: [BusinessPulseService],
})
export class BusinessPulseModule {}
