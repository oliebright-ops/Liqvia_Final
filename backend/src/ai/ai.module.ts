import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AiController } from './ai.controller';
import { AiDataService } from './ai-data.service';
import { AiService } from './ai.service';

@Module({
  imports: [DashboardModule],
  controllers: [AiController],
  providers: [AiDataService, AiService],
  exports: [AiService],
})
export class AiModule {}
