-- Retention support for landing-page leads.
--
-- Two changes, both required by the one-month retention policy:
--
--  1. CashOsLead gains anonymisedAt/anonymisedReason. Expired leads are erased by
--     overwriting every identifying column in place rather than by deleting the row,
--     so the consent evidence pointing at the row stays meaningful.
--
--  2. ConsentRecord.cashOsLeadId becomes ON DELETE SET NULL instead of ON DELETE
--     CASCADE. Consent evidence proves that processing was lawful when it happened,
--     which outlives the data it authorised; under a cascade, routine retention
--     expiry would destroy exactly the record needed if the collection is ever
--     challenged. Erasure of a subject's data and destruction of the proof that
--     collecting it was lawful are different acts and must not share a code path.

ALTER TABLE "CashOsLead" ADD COLUMN "anonymisedAt" TIMESTAMP(3);
ALTER TABLE "CashOsLead" ADD COLUMN "anonymisedReason" TEXT;

CREATE INDEX "CashOsLead_anonymisedAt_createdAt_idx"
  ON "CashOsLead" ("anonymisedAt", "createdAt");

ALTER TABLE "ConsentRecord" DROP CONSTRAINT "ConsentRecord_cashOsLeadId_fkey";

ALTER TABLE "ConsentRecord"
  ADD CONSTRAINT "ConsentRecord_cashOsLeadId_fkey"
  FOREIGN KEY ("cashOsLeadId") REFERENCES "CashOsLead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
