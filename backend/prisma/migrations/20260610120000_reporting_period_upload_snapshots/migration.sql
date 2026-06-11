-- Financial reporting period + upload row snapshots for reference
CREATE TYPE "PeriodGranularity" AS ENUM ('monthly', 'weekly');

ALTER TABLE "Company" ADD COLUMN "reportingPeriod" TEXT;
ALTER TABLE "Company" ADD COLUMN "periodGranularity" "PeriodGranularity" NOT NULL DEFAULT 'monthly';

ALTER TABLE "UploadBatch" ADD COLUMN "rowSnapshot" JSONB;
