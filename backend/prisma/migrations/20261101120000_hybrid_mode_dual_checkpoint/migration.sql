-- Hybrid learning mode: session modes, dual checkpoints, meeting PIN, and
-- zero-GPS attendance (plan/hybrid-attendance-plan.md, HYB2).
--
-- Everything is idempotent so dirty development databases and re-runs behave
-- exactly like the rest of this migration history. Historical rows are all
-- in-person sessions with a single QR checkpoint and keep their shape; the new
-- columns stay NULL for them (resolution branches on Session.mode).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AttendanceStatus' AND e.enumlabel = 'incomplete'
  ) THEN
    ALTER TYPE "AttendanceStatus" ADD VALUE 'incomplete';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionMode') THEN
    CREATE TYPE "SessionMode" AS ENUM ('in_person', 'online');
  END IF;
END $$;

-- ── Session: mode, dual checkpoints, auto-end deadline, nullable geofence ──

ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "mode" "SessionMode" NOT NULL DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS "startQrValiditySeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "startGraceMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "endQrValiditySeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "endGraceMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "startQrToken" TEXT,
  ADD COLUMN IF NOT EXISTS "startTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "startQrGeneratedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "startPinHash" TEXT,
  ADD COLUMN IF NOT EXISTS "endQrToken" TEXT,
  ADD COLUMN IF NOT EXISTS "endTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endQrGeneratedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endPinHash" TEXT,
  ADD COLUMN IF NOT EXISTS "autoEndAt" TIMESTAMP(3);

ALTER TABLE "Session" ALTER COLUMN "geofenceLatitude" DROP NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "geofenceLongitude" DROP NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "geofenceRadiusMeters" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Session_autoEndAt_idx" ON "Session"("autoEndAt");

-- Backfill the unified auto-end deadline for any session that is active while
-- this migration runs. It reproduces the cron's former derived expiry
-- (expiresAt + grace) so in-flight sessions keep behaving identically.
UPDATE "Session"
SET "autoEndAt" = "qrTokenExpiresAt" + ("gracePeriodMinutes" * INTERVAL '1 minute')
WHERE "autoEndAt" IS NULL
  AND "isActive" = TRUE
  AND "qrTokenExpiresAt" IS NOT NULL;

-- Mode/column coherence guard (application logic is primary; this is
-- defense-in-depth against direct SQL writes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Session_mode_columns_ck'
  ) THEN
    ALTER TABLE "Session"
      ADD CONSTRAINT "Session_mode_columns_ck" CHECK (
        (
          "mode" = 'online'
          AND "geofenceLatitude" IS NULL
          AND "geofenceLongitude" IS NULL
          AND "geofenceRadiusMeters" IS NULL
          AND "startQrValiditySeconds" IS NOT NULL
          AND "endQrValiditySeconds" IS NOT NULL
        )
        OR (
          "mode" = 'in_person'
          AND "startQrToken" IS NULL
          AND "endQrToken" IS NULL
          AND "startPinHash" IS NULL
          AND "endPinHash" IS NULL
          AND "startQrValiditySeconds" IS NULL
          AND "endQrValiditySeconds" IS NULL
        )
      );
  END IF;
END $$;

-- ── ScanAttempt: nullable coordinates + checkpoint/PIN audit ──

ALTER TABLE "ScanAttempt" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "ScanAttempt" ALTER COLUMN "longitude" DROP NOT NULL;

ALTER TABLE "ScanAttempt"
  ADD COLUMN IF NOT EXISTS "checkpoint" TEXT,
  ADD COLUMN IF NOT EXISTS "pinVerified" BOOLEAN;

-- ── AttendanceRecord: dual checkpoint state + nullable coordinates ──

ALTER TABLE "AttendanceRecord" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "longitude" DROP NOT NULL;

ALTER TABLE "AttendanceRecord"
  ADD COLUMN IF NOT EXISTS "checkInTime" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checkInStatus" "AttendanceStatus",
  ADD COLUMN IF NOT EXISTS "checkOutTime" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checkOutStatus" "AttendanceStatus",
  ADD COLUMN IF NOT EXISTS "checkInToken" TEXT,
  ADD COLUMN IF NOT EXISTS "checkOutToken" TEXT,
  ADD COLUMN IF NOT EXISTS "checkInAttemptId" TEXT,
  ADD COLUMN IF NOT EXISTS "checkOutAttemptId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_checkInAttemptId_key"
  ON "AttendanceRecord"("checkInAttemptId");
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_checkOutAttemptId_key"
  ON "AttendanceRecord"("checkOutAttemptId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_checkInAttemptId_fkey'
  ) THEN
    ALTER TABLE "AttendanceRecord"
      ADD CONSTRAINT "AttendanceRecord_checkInAttemptId_fkey"
      FOREIGN KEY ("checkInAttemptId") REFERENCES "ScanAttempt"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_checkInAttemptId_fkey' AND convalidated = FALSE
  ) THEN
    ALTER TABLE "AttendanceRecord" VALIDATE CONSTRAINT "AttendanceRecord_checkInAttemptId_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_checkOutAttemptId_fkey'
  ) THEN
    ALTER TABLE "AttendanceRecord"
      ADD CONSTRAINT "AttendanceRecord_checkOutAttemptId_fkey"
      FOREIGN KEY ("checkOutAttemptId") REFERENCES "ScanAttempt"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_checkOutAttemptId_fkey' AND convalidated = FALSE
  ) THEN
    ALTER TABLE "AttendanceRecord" VALIDATE CONSTRAINT "AttendanceRecord_checkOutAttemptId_fkey";
  END IF;
END $$;
