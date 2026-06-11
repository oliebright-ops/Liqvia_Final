ALTER TABLE "Company" ADD COLUMN "industry" TEXT;
ALTER TABLE "Company" ADD COLUMN "fiscalYearStart" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Company" ADD COLUMN "forecastHorizonWeeks" INTEGER NOT NULL DEFAULT 13;
ALTER TABLE "Company" ADD COLUMN "openingCashBalance" DECIMAL(18,2);
ALTER TABLE "Company" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
