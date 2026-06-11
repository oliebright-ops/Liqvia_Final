-- AlterTable: nullable company + demo mode
ALTER TABLE "UserProfile" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "UserProfile" ADD COLUMN "isDemoMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserCompanyLink" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCompanyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserCompanyLink_email_companyId_key" ON "UserCompanyLink"("email", "companyId");
CREATE INDEX "UserCompanyLink_email_idx" ON "UserCompanyLink"("email");

ALTER TABLE "UserCompanyLink" ADD CONSTRAINT "UserCompanyLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompanyLink" ADD CONSTRAINT "UserCompanyLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill links for existing users with a company
INSERT INTO "UserCompanyLink" ("id", "email", "companyId", "userId", "role", "createdAt", "updatedAt")
SELECT
    'link_' || u."id",
    u."email",
    u."companyId",
    u."id",
    u."role",
    u."createdAt",
    NOW()
FROM "UserProfile" u
WHERE u."companyId" IS NOT NULL
ON CONFLICT ("email", "companyId") DO NOTHING;
