import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { RecurringObligationsModule } from './recurring-obligations/recurring-obligations.module';
import { ExpectedSettlementsModule } from './expected-settlements/expected-settlements.module';
import { CashDrivenModule } from './cash-driven/cash-driven.module';
import { DataQualityModule } from './data-quality/data-quality.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BusinessPulseModule } from './business-pulse/business-pulse.module';
import { DecisionCentreModule } from './decision-centre/decision-centre.module';
import { WhyChangedModule } from './why-changed/why-changed.module';

@Module({
  imports: [
    // Rate limits are tracked per (controller + handler + IP), i.e. per individual
    // endpoint — not shared globally across the whole API. `default` had little
    // headroom for a single active user hitting the same endpoint repeatedly
    // (dashboard refresh, scenario preview debounce, etc.); raised for breathing
    // room without materially weakening abuse protection. See F19/F20.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 200 },
      { name: 'auth', ttl: 60_000, limit: 10 },
      { name: 'demo', ttl: 60_000, limit: 3 },
    ]),
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
    RecurringObligationsModule,
    ExpectedSettlementsModule,
    CashDrivenModule,
    DataQualityModule,
    NotificationsModule,
    AiModule,
    BusinessPulseModule,
    DecisionCentreModule,
    WhyChangedModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
