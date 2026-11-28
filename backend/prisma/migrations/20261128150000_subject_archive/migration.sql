-- Archiving hides a subject at the end of a semester and starts the 90-day evidence countdown.
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "evidencePurgedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Subject_archivedAt_idx" ON "Subject"("archivedAt");

-- A code only has to be unique among active subjects, so next semester can reuse the code of an
-- archived one. Prisma cannot express a partial index, so it lives here.
DROP INDEX IF EXISTS "Subject_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Subject_code_active_key" ON "Subject"("code") WHERE "archivedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "Subject_code_idx" ON "Subject"("code");
