-- CreateEnum
CREATE TYPE "BusinessMode" AS ENUM ('invoice_driven', 'cash_driven', 'mixed');

-- CreateEnum
CREATE TYPE "AccountPurpose" AS ENUM ('operating', 'payroll_reserve', 'tax_reserve', 'ndis_settlement', 'merchant_clearing', 'amex_settlement', 'savings', 'emergency_reserve', 'loan_offset', 'project_funds', 'other');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('expected', 'pending', 'received', 'delayed', 'unknown');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ObligationCategory" ADD VALUE 'tax';
ALTER TYPE "ObligationCategory" ADD VALUE 'utilities';
ALTER TYPE "ObligationCategory" ADD VALUE 'vehicle';
ALTER TYPE "ObligationCategory" ADD VALUE 'merchant_fees';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "businessMode" "BusinessMode" NOT NULL DEFAULT 'invoice_driven';

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "accountPurpose" "AccountPurpose" NOT NULL DEFAULT 'operating';

-- AlterTable
ALTER TABLE "RecurringObligation" ADD COLUMN     "confidence" "ConfidenceLevel",
ADD COLUMN     "linkedBankAccountId" TEXT,
ADD COLUMN     "paymentMethod" TEXT;

-- CreateTable
CREATE TABLE "ExpectedSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "frequency" "ObligationFrequency" NOT NULL,
    "nextExpectedDate" TIMESTAMP(3) NOT NULL,
    "destinationAccountId" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'expected',
    "confidence" "ConfidenceLevel",
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExpectedSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpectedSettlement_companyId_active_idx" ON "ExpectedSettlement"("companyId", "active");

-- CreateIndex
CREATE INDEX "ExpectedSettlement_companyId_nextExpectedDate_idx" ON "ExpectedSettlement"("companyId", "nextExpectedDate");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_accountPurpose_idx" ON "BankAccount"("companyId", "accountPurpose");

-- AddForeignKey
ALTER TABLE "RecurringObligation" ADD CONSTRAINT "RecurringObligation_linkedBankAccountId_fkey" FOREIGN KEY ("linkedBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedSettlement" ADD CONSTRAINT "ExpectedSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedSettlement" ADD CONSTRAINT "ExpectedSettlement_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

