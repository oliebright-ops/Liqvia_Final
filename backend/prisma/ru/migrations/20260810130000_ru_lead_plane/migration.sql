-- Initial schema for the RUSSIAN LEAD DATA PLANE.
--
-- Two tables, deliberately. See docs/RU_MINIMUM_SCHEMA.md.
--
-- This migration history is independent of the global one. Applying the global
-- migrations here would create all 30 tables of the authenticated application
-- inside Russian infrastructure, which is precisely what this data plane exists
-- to avoid.
--
-- After applying, the verification in docs/RU_DATABASE_CONFIGURATION.md §3 must
-- return exactly: CashOsLead, ConsentRecord, _prisma_migrations. Anything else
-- means the wrong schema was deployed — rebuild the database rather than dropping
-- the extra tables, because provenance is the whole point of this exercise.

CREATE TABLE "CashOsLead" (
    "id"               TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "role"             TEXT,
    "companyName"      TEXT NOT NULL,
    "phone"            TEXT,
    "email"            TEXT NOT NULL,
    "employeeCount"    TEXT,
    "industry"         TEXT,
    "comment"          TEXT,
    "source"           TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonymisedAt"     TIMESTAMP(3),
    "anonymisedReason" TEXT,

    CONSTRAINT "CashOsLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentRecord" (
    "id"                TEXT NOT NULL,
    "subjectId"         TEXT NOT NULL,
    "version"           TEXT NOT NULL,
    "policyVersion"     TEXT NOT NULL,
    "locale"            TEXT NOT NULL,
    "consentText"       TEXT NOT NULL,
    "consentTextSha256" TEXT NOT NULL,
    "textVerified"      BOOLEAN NOT NULL DEFAULT true,
    "method"            TEXT NOT NULL DEFAULT 'checkbox',
    "acknowledgedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashOsLeadId"      TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashOsLead_createdAt_idx" ON "CashOsLead"("createdAt");

-- Drives the retention sweep: find rows that still hold personal data.
CREATE INDEX "CashOsLead_anonymisedAt_createdAt_idx" ON "CashOsLead"("anonymisedAt", "createdAt");

CREATE INDEX "ConsentRecord_subjectId_version_idx" ON "ConsentRecord"("subjectId", "version");
CREATE INDEX "ConsentRecord_cashOsLeadId_idx" ON "ConsentRecord"("cashOsLeadId");
CREATE INDEX "ConsentRecord_acknowledgedAt_idx" ON "ConsentRecord"("acknowledgedAt");

-- ON DELETE SET NULL, not CASCADE: consent evidence outlives the lead it
-- authorised. Under a cascade, routine one-month retention expiry would destroy
-- the record proving that collecting the lead was lawful.
ALTER TABLE "ConsentRecord"
    ADD CONSTRAINT "ConsentRecord_cashOsLeadId_fkey"
    FOREIGN KEY ("cashOsLeadId") REFERENCES "CashOsLead"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
