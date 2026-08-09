-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "consentTextSha256" TEXT NOT NULL,
    "textVerified" BOOLEAN NOT NULL DEFAULT true,
    "method" TEXT NOT NULL DEFAULT 'checkbox',
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashOsLeadId" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRecord_subjectId_version_idx" ON "ConsentRecord"("subjectId", "version");

-- CreateIndex
CREATE INDEX "ConsentRecord_cashOsLeadId_idx" ON "ConsentRecord"("cashOsLeadId");

-- CreateIndex
CREATE INDEX "ConsentRecord_acknowledgedAt_idx" ON "ConsentRecord"("acknowledgedAt");

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_cashOsLeadId_fkey" FOREIGN KEY ("cashOsLeadId") REFERENCES "CashOsLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
