import { Module } from '@nestjs/common';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { RecurringObligationsModule } from '../recurring-obligations/recurring-obligations.module';
import { ExpectedSettlementsModule } from '../expected-settlements/expected-settlements.module';
import { CashDrivenController } from './cash-driven.controller';
import { CashDrivenService } from './cash-driven.service';

@Module({
  imports: [BankAccountsModule, RecurringObligationsModule, ExpectedSettlementsModule],
  controllers: [CashDrivenController],
  providers: [CashDrivenService],
  exports: [CashDrivenService],
})
export class CashDrivenModule {}
