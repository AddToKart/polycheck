-- Wave 4: excuse workflow + notification center.
-- PostgreSQL 12+ allows ADD VALUE inside a transaction as long as the new value
-- is not used before commit (it is only used by later application traffic).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AttendanceStatus' AND e.enumlabel = 'excused'
  ) THEN
    ALTER TYPE "AttendanceStatus" ADD VALUE 'excused';
  END IF;
END $$;

ALTER TABLE "AttendanceRecord"
  ADD COLUMN IF NOT EXISTS "excuseStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "excuseReason" TEXT,
  ADD COLUMN IF NOT EXISTS "excuseDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "excuseEvidencePath" TEXT,
  ADD COLUMN IF NOT EXISTS "excuseReviewedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "excuseReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "excuseReviewNote" TEXT;

CREATE INDEX IF NOT EXISTS "AttendanceRecord_excuseStatus_idx" ON "AttendanceRecord"("excuseStatus");

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_token_key" ON "PushSubscription"("token");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

ALTER TABLE "PushSubscription" DROP CONSTRAINT IF EXISTS "PushSubscription_userId_fkey";
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
