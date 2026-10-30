-- Lightweight system issue & feedback reporting. Everyone's submissions are
-- cascade-deleted with their account (the report stream never outlives its
-- submitter); admin triage indexes keep the cockpit list and stats queries
-- bounded.

CREATE TYPE "ReportCategory" AS ENUM ('scanner_camera', 'geofence_gps', 'ui_display', 'enrollment_roster', 'account_login', 'feedback_suggestion');

CREATE TYPE "ReportSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE "ReportStatus" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

CREATE TABLE "SystemReport" (
    "id"            TEXT              NOT NULL,
    "userId"        TEXT              NOT NULL,
    "userRole"      "UserRole"        NOT NULL,
    "category"      "ReportCategory"  NOT NULL,
    "severity"      "ReportSeverity"  NOT NULL DEFAULT 'medium',
    "title"         TEXT              NOT NULL,
    "description"   TEXT              NOT NULL,
    "status"        "ReportStatus"    NOT NULL DEFAULT 'open',
    "deviceInfo"    TEXT,
    "appVersion"    TEXT,
    "route"         TEXT,
    "networkType"   TEXT,
    "screenshotUrl" TEXT,
    "adminNotes"    TEXT,
    "resolvedAt"    TIMESTAMP(3),
    "resolvedBy"    TEXT,
    "createdAt"     TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "SystemReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemReport_userId_createdAt_idx" ON "SystemReport"("userId" ASC, "createdAt" ASC);

CREATE INDEX "SystemReport_status_createdAt_idx" ON "SystemReport"("status" ASC, "createdAt" ASC);

CREATE INDEX "SystemReport_category_idx" ON "SystemReport"("category" ASC);

CREATE INDEX "SystemReport_severity_idx" ON "SystemReport"("severity" ASC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SystemReport_userId_fkey'
    ) THEN
        ALTER TABLE "SystemReport"
            ADD CONSTRAINT "SystemReport_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
