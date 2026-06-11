-- Replace Clerk-based auth with JWT (email + password).

ALTER TABLE "UserProfile" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "name" TEXT;

UPDATE "UserProfile" SET
  "passwordHash" = '$2b$10$placeholderhashmustresetpassword1',
  "name" = split_part("email", '@', 1)
WHERE "passwordHash" IS NULL;

ALTER TABLE "UserProfile" ALTER COLUMN "passwordHash" SET NOT NULL;
ALTER TABLE "UserProfile" ALTER COLUMN "name" SET NOT NULL;

DROP INDEX IF EXISTS "UserProfile_clerkUserId_key";
ALTER TABLE "UserProfile" DROP COLUMN "clerkUserId";

CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");
DROP INDEX IF EXISTS "UserProfile_email_idx";
