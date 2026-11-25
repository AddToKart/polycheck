-- Email account activation (plan/master-list-import-and-activation-plan.md).
-- Additive and idempotent: no backfill, every existing account keeps
-- activationPending = false and behaves exactly as before. The two settings are
-- seeded off/at their defaults so nothing changes until an administrator acts.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activationPending" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "AccountActivationToken" (
  "id"             TEXT        NOT NULL,
  "userId"         TEXT        NOT NULL,
  "tokenHash"      TEXT        NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "usedAt"         TIMESTAMP(3),
  "revokedAt"      TIMESTAMP(3),
  "failedAttempts" INTEGER     NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountActivationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountActivationToken_tokenHash_key" ON "AccountActivationToken" ("tokenHash");
CREATE INDEX IF NOT EXISTS "AccountActivationToken_userId_createdAt_idx" ON "AccountActivationToken" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AccountActivationToken_expiresAt_idx" ON "AccountActivationToken" ("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccountActivationToken_userId_fkey') THEN
    ALTER TABLE "AccountActivationToken"
      ADD CONSTRAINT "AccountActivationToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AccountMail" (
  "id"         TEXT         NOT NULL,
  "userId"     TEXT         NOT NULL,
  "kind"       TEXT         NOT NULL,
  "status"     TEXT         NOT NULL DEFAULT 'queued',
  "attempts"   INTEGER      NOT NULL DEFAULT 0,
  "providerId" TEXT,
  "errorCode"  TEXT,
  "queuedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"     TIMESTAMP(3),
  "batchId"    TEXT,
  CONSTRAINT "AccountMail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountMail_status_queuedAt_idx" ON "AccountMail" ("status", "queuedAt");
CREATE INDEX IF NOT EXISTS "AccountMail_userId_queuedAt_idx" ON "AccountMail" ("userId", "queuedAt");
CREATE INDEX IF NOT EXISTS "AccountMail_batchId_idx" ON "AccountMail" ("batchId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccountMail_userId_fkey') THEN
    ALTER TABLE "AccountMail"
      ADD CONSTRAINT "AccountMail_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "InstitutionSetting" ("key", "value", "updatedBy", "updatedAt")
VALUES
  ('activation_email_enabled', 'false', 'system', CURRENT_TIMESTAMP),
  ('activation_link_ttl_hours', '168', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
