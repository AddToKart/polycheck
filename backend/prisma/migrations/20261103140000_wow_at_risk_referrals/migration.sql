-- F5 (WF-LD7): CHED CMO No. 40 "Notice of Impending Drop" referral slip.
-- Self-healing style: idempotent pre-checks so re-runs and partially patched
-- development databases cannot crash this migration. No backfills needed
-- (referrals only exist going forward).
DO $$ BEGIN
    CREATE TYPE "ReferralStatus" AS ENUM ('generated', 'acknowledged', 'counseling_scheduled', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AtRiskReferral" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'generated',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AtRiskReferral_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AtRiskReferral_sectionId_idx"
    ON "AtRiskReferral"("sectionId");
CREATE INDEX IF NOT EXISTS "AtRiskReferral_status_idx"
    ON "AtRiskReferral"("status");
CREATE INDEX IF NOT EXISTS "AtRiskReferral_studentId_idx"
    ON "AtRiskReferral"("studentId");

DO $$ BEGIN
    ALTER TABLE "AtRiskReferral"
        ADD CONSTRAINT "AtRiskReferral_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AtRiskReferral"
        ADD CONSTRAINT "AtRiskReferral_sectionId_fkey"
        FOREIGN KEY ("sectionId") REFERENCES "Section"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AtRiskReferral"
        ADD CONSTRAINT "AtRiskReferral_generatedById_fkey"
        FOREIGN KEY ("generatedById") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
