-- AlterTable
ALTER TABLE "CashOsLead" ADD COLUMN     "employeeCount" TEXT,
ADD COLUMN     "industry" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;
