-- Paid-traffic attribution for landing-page leads, on the RU data plane.
--
-- Answers "which campaign, ad and search term produced this lead?", which is the
-- question Yandex Direct spend cannot be judged without. Before this migration
-- every lead carried the same hard-coded `source` literal and was therefore
-- indistinguishable from every other.
--
-- Typed columns rather than one free-text field, deliberately: each value is
-- parsed out of a named query parameter and length-capped by the application, so
-- no raw URL, fragment or unrecognised parameter is ever persisted. That preserves
-- the property `source` has always had — nothing arrives from the address bar
-- wholesale — while still recording attribution.
--
-- Nullable with no backfill. NULL means "not captured", which is the truth for
-- every row written before this and for any lead arriving from organic traffic.
--
-- Mirrors the global migration of the same name. See docs/RU_MINIMUM_SCHEMA.md §1.3
-- for why the RU minimum schema admits these six columns.

ALTER TABLE "CashOsLead" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "CashOsLead" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "CashOsLead" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "CashOsLead" ADD COLUMN "utmContent" TEXT;
ALTER TABLE "CashOsLead" ADD COLUMN "utmTerm" TEXT;
ALTER TABLE "CashOsLead" ADD COLUMN "yclid" TEXT;
