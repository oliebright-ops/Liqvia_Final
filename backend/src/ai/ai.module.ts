import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { RecurringObligationsModule } from '../recurring-obligations/recurring-obligations.module';
import { DataQualityModule } from '../data-quality/data-quality.module';
import { AiController } from './ai.controller';
import { AiDataService } from './ai-data.service';
import { AiService } from './ai.service';

@Module({
  imports: [DashboardModule, RecurringObligationsModule, DataQualityModule],
  controllers: [AiController],
  providers: [AiDataService, AiService],
  exports: [AiService],
})
export class AiModule {}
