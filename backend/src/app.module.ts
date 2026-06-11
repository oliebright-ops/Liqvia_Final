import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TreasuryModule } from './treasury/treasury.module';
import { UploadModule } from './uploads/upload.module';
import { BudgetModule } from './budget/budget.module';
import { ScenarioModule } from './scenarios/scenario.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiModule } from './ai/ai.module';
import { UsersModule } from './users/users.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { LedgerModule } from './ledger/ledger.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { SettingsModule } from './settings/settings.module';
import { FreeCashModule } from './free-cash/free-cash.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OnboardingModule,
    UsersModule,
    TreasuryModule,
    UploadModule,
    BudgetModule,
    ScenarioModule,
    DashboardModule,
    LedgerModule,
    BankAccountsModule,
    SettingsModule,
    FreeCashModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
