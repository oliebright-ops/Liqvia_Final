import { Module } from '@nestjs/common';
import { RecurringObligationsModule } from '../recurring-obligations/recurring-obligations.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { FreeCashModule } from '../free-cash/free-cash.module';
import { AiModule } from '../ai/ai.module';
import { BusinessPulseController } from './business-pulse.controller';
import { BusinessPulseService } from './business-pulse.service';

@Module({
  imports: [RecurringObligationsModule, TreasuryModule, FreeCashModule, AiModule],
  controllers: [BusinessPulseController],
  providers: [BusinessPulseService],
  exports: [BusinessPulseService],
})
export class BusinessPulseModule {}
