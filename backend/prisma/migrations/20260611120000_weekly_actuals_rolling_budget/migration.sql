-- Weekly actuals upload + rolling forecast lookback
ALTER TYPE "UploadTemplateType" ADD VALUE 'weekly_actuals';

ALTER TABLE "Company" ADD COLUMN "forecastLookbackWeeks" INTEGER NOT NULL DEFAULT 4;

CREATE TABLE "WeeklyActual" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "accountCode" TEXT,
    "actualAmount" DECIMAL(18,2) NOT NULL,
    "uploadBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyActual_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyActual_companyId_period_idx" ON "WeeklyActual"("companyId", "period");
CREATE INDEX "WeeklyActual_uploadBatchId_idx" ON "WeeklyActual"("uploadBatchId");
CREATE UNIQUE INDEX "WeeklyActual_companyId_period_category_accountCode_key" ON "WeeklyActual"("companyId", "period", "category", "accountCode");

ALTER TABLE "WeeklyActual" ADD CONSTRAINT "WeeklyActual_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyActual" ADD CONSTRAINT "WeeklyActual_uploadBatchId_fkey" FOREIGN KEY ("uploadBatchId") REFERENCES "UploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
