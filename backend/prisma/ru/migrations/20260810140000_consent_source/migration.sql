-- Records which form produced an acknowledgement, on the RU data plane.
--
-- Mirrors the global migration of the same name. Nullable with no backfill: NULL
-- means "not captured", which is the truth for any row written before this.

ALTER TABLE "ConsentRecord" ADD COLUMN "source" TEXT;
