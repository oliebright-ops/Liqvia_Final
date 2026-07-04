-- CreateTable
CREATE TABLE "KpiSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "currentCash" DECIMAL(18,2) NOT NULL,
    "runwayWeeks" DECIMAL(6,2),
    "overdueReceivables" DECIMAL(18,2) NOT NULL,
    "upcomingPayables" DECIMAL(18,2) NOT NULL,
    "freeAvailableCash" DECIMAL(18,2) NOT NULL,
    "liquidityStatus" "LiquidityStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiSnapshot_companyId_asOfDate_idx" ON "KpiSnapshot"("companyId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "KpiSnapshot_companyId_asOfDate_key" ON "KpiSnapshot"("companyId", "asOfDate");

-- AddForeignKey
ALTER TABLE "KpiSnapshot" ADD CONSTRAINT "KpiSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
