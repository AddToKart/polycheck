-- A section president may start and end the sessions they create.
-- Additive only: every existing session keeps NULL host columns and is verified
-- with the professor's key exactly as before.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "hostStudentId" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "hostPublicKey" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "hostStartedAt" TIMESTAMP(3);

-- The professor chooses how many sessions a permission allows. Revoking is
-- recorded apart from expiry, so a started session can still be ended after the
-- time limit but not after a revoke.
ALTER TABLE "SessionPermission" ADD COLUMN IF NOT EXISTS "sessionLimit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SessionPermission" ADD COLUMN IF NOT EXISTS "sessionsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SessionPermission" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
