-- Expand scenario variables for growth, payable delay, tax, and one-off cash events.
ALTER TABLE "Scenario" ADD COLUMN "revenueGrowthPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Scenario" ADD COLUMN "payableDelayDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Scenario" ADD COLUMN "taxIncreasePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Scenario" ADD COLUMN "oneOffInflowAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Scenario" ADD COLUMN "oneOffInflowWeek" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Scenario" ADD COLUMN "oneOffOutflowAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "Scenario" ADD COLUMN "oneOffOutflowWeek" INTEGER NOT NULL DEFAULT 1;
