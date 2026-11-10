-- F9 (WF-LD11): per-session attendance hash chain. Additive nullable columns
-- keep the migration online; the chain math itself (SHA-256 over
-- `prevHash|studentId|timestampIso|sessionId|salt`) lives in
-- shared/src/utils/ledger.ts. Historical rows are backfilled by the run-once
-- script prisma/backfills/ledger-backfill.ts (per session, ordered by
-- (timestamp, id)) - SQL cannot express sha256 chains over row state.
DO $$ BEGIN
    ALTER TABLE "AttendanceRecord"
        ADD COLUMN IF NOT EXISTS "prevHash" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AttendanceRecord"
        ADD COLUMN IF NOT EXISTS "recordHash" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AttendanceRecord"
        ADD COLUMN IF NOT EXISTS "salt" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "AttendanceRecord_sessionId_timestamp_idx"
    ON "AttendanceRecord"("sessionId", "timestamp");

CREATE INDEX IF NOT EXISTS "AttendanceRecord_recordHash_idx"
    ON "AttendanceRecord"("recordHash");
