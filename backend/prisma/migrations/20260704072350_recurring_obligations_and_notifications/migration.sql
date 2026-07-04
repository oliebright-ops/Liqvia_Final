-- CreateEnum
CREATE TYPE "ObligationCategory" AS ENUM ('payroll', 'superannuation', 'payg_withholding', 'gst_bas', 'rent', 'loan_repayment', 'insurance', 'subscription', 'other');

-- CreateEnum
CREATE TYPE "ObligationFrequency" AS ENUM ('weekly', 'fortnightly', 'monthly', 'quarterly', 'annually');

-- CreateEnum
CREATE TYPE "CompanyPlan" AS ENUM ('free', 'pro');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('obligation_due_soon', 'payroll_shortfall', 'runway_risk');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "plan" "CompanyPlan" NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "RecurringObligation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ObligationCategory" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "frequency" "ObligationFrequency" NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RecurringObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringObligation_companyId_active_idx" ON "RecurringObligation"("companyId", "active");

-- CreateIndex
CREATE INDEX "RecurringObligation_companyId_nextDueDate_idx" ON "RecurringObligation"("companyId", "nextDueDate");

-- CreateIndex
CREATE INDEX "Notification_companyId_read_idx" ON "Notification"("companyId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_companyId_dedupeKey_key" ON "Notification"("companyId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "RecurringObligation" ADD CONSTRAINT "RecurringObligation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
