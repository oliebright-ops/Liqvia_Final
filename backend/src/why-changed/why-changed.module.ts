import { Module } from '@nestjs/common';
import { TreasuryModule } from '../treasury/treasury.module';
import { FreeCashModule } from '../free-cash/free-cash.module';
import { AiModule } from '../ai/ai.module';
import { WhyChangedController } from './why-changed.controller';
import { WhyChangedService } from './why-changed.service';
import { KpiSnapshotService } from './kpi-snapshot.service';

@Module({
  imports: [TreasuryModule, FreeCashModule, AiModule],
  controllers: [WhyChangedController],
  providers: [WhyChangedService, KpiSnapshotService],
  exports: [KpiSnapshotService],
})
export class WhyChangedModule {}
