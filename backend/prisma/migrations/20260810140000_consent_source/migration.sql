-- Records which form produced an acknowledgement.
--
-- Nullable with no backfill, deliberately. Every row written before this
-- migration was written by the landing form, but recording that as fact would be
-- an inference, and inferred evidence is not evidence. NULL means "not captured",
-- which is the truth for those rows.
--
-- Additive and reversible: dropping the column loses only data added after it.

ALTER TABLE "ConsentRecord" ADD COLUMN "source" TEXT;
