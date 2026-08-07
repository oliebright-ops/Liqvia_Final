-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_companyId_fkey";

-- DropIndex
DROP INDEX "WeeklyActual_uploadBatchId_idx";

-- CreateTable
CREATE TABLE "CashOsLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "companyName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "comment" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashOsLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashOsLead_createdAt_idx" ON "CashOsLead"("createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
