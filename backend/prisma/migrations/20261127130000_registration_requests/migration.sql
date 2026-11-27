-- Temporary self sign-up for data gathering. Additive only.
DO $$ BEGIN
  CREATE TYPE "RegistrationStatus" AS ENUM ('pending', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RegistrationRequest" (
  "id" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "studentId" TEXT,
  "program" TEXT,
  "yearLevel" INTEGER,
  -- Kept only while waiting; cleared on approval, deleted with a rejection.
  "passwordHash" TEXT,
  "status" "RegistrationStatus" NOT NULL DEFAULT 'pending',
  "consentVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdUserId" TEXT,
  CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegistrationRequest_status_createdAt_idx" ON "RegistrationRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RegistrationRequest_studentId_idx" ON "RegistrationRequest"("studentId");
CREATE INDEX IF NOT EXISTS "RegistrationRequest_email_idx" ON "RegistrationRequest"("email");
