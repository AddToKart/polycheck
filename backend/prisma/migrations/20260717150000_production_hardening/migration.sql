-- Integrity constraints and indexes required by the production API.
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");
DROP INDEX IF EXISTS "Subject_code_idx";

CREATE UNIQUE INDEX "Section_subjectId_section_semester_teacherId_key"
ON "Section"("subjectId", "section", "semester", "teacherId");

DELETE FROM "SessionPermission" older
USING "SessionPermission" newer
WHERE older."sectionId" = newer."sectionId"
  AND older."studentId" = newer."studentId"
  AND (older."grantedAt", older."id") < (newer."grantedAt", newer."id");

CREATE UNIQUE INDEX "SessionPermission_sectionId_studentId_key"
ON "SessionPermission"("sectionId", "studentId");

CREATE INDEX "Session_teacherId_date_idx" ON "Session"("teacherId", "date");
CREATE INDEX "Session_sectionId_date_idx" ON "Session"("sectionId", "date");

ALTER TABLE "AttendanceRecord"
ADD CONSTRAINT "AttendanceRecord_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Section" ADD CONSTRAINT "Section_studentCount_nonnegative" CHECK ("studentCount" >= 0);
ALTER TABLE "Session" ADD CONSTRAINT "Session_latitude_range" CHECK ("geofenceLatitude" BETWEEN -90 AND 90);
ALTER TABLE "Session" ADD CONSTRAINT "Session_longitude_range" CHECK ("geofenceLongitude" BETWEEN -180 AND 180);
ALTER TABLE "Session" ADD CONSTRAINT "Session_radius_range" CHECK ("geofenceRadiusMeters" BETWEEN 10 AND 500);
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_latitude_range" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
