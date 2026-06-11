import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TreasuryDataService } from './treasury-data.service';

@Module({
  imports: [TreasuryModule, BudgetModule],
  controllers: [DashboardController],
  providers: [DashboardService, TreasuryDataService],
  exports: [DashboardService],
})
export class DashboardModule {}
