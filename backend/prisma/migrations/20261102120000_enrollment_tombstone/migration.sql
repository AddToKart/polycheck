-- V3 hardening: record students removed by the instructor so an unexpired
-- enrollment code cannot silently re-admit them. Additive-create; no
-- backfill (previously removed students are not retroactively blocked).
CREATE TABLE IF NOT EXISTS "EnrollmentTombstone" (
    "id"            TEXT NOT NULL,
    "sectionId"     TEXT NOT NULL,
    "studentId"     TEXT NOT NULL,
    "removedById"   TEXT NOT NULL,
    "removedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason"        TEXT,
    CONSTRAINT "EnrollmentTombstone_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS "EnrollmentTombstone_sectionId_studentId_key"
        ON "EnrollmentTombstone"("sectionId", "studentId");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "EnrollmentTombstone"
        ADD CONSTRAINT "EnrollmentTombstone_sectionId_studentId_removedById_key"
        UNIQUE ("sectionId", "studentId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "EnrollmentTombstone_studentId_idx" ON "EnrollmentTombstone"("studentId");

DO $$ BEGIN
    ALTER TABLE "EnrollmentTombstone"
        ADD CONSTRAINT "EnrollmentTombstone_sectionId_fkey"
        FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "EnrollmentTombstone"
        ADD CONSTRAINT "EnrollmentTombstone_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "EnrollmentTombstone"
        ADD CONSTRAINT "EnrollmentTombstone_removedById_fkey"
        FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
