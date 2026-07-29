ALTER TABLE "ScanAttempt"
ADD COLUMN "clientAttemptId" TEXT,
ADD COLUMN "clientScannedAt" TIMESTAMP(3),
ADD COLUMN "receivedAt" TIMESTAMP(3),
ADD COLUMN "locationCapturedAt" TIMESTAMP(3),
ADD COLUMN "accuracyMeters" DOUBLE PRECISION,
ADD COLUMN "mocked" BOOLEAN,
ADD COLUMN "inputChannel" TEXT,
ADD COLUMN "offline" BOOLEAN,
ADD COLUMN "distanceMeters" DOUBLE PRECISION,
ADD COLUMN "geofenceRadiusMeters" INTEGER,
ADD COLUMN "riskSignals" JSONB;

UPDATE "ScanAttempt" SET "receivedAt" = "createdAt" WHERE "receivedAt" IS NULL;

ALTER TABLE "ScanAttempt"
ALTER COLUMN "receivedAt" SET NOT NULL,
ALTER COLUMN "receivedAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "offline" SET DEFAULT false;

ALTER TABLE "AttendanceRecord" ADD COLUMN "acceptedScanAttemptId" TEXT;

CREATE UNIQUE INDEX "ScanAttempt_studentId_clientAttemptId_key" ON "ScanAttempt"("studentId", "clientAttemptId");
CREATE INDEX "ScanAttempt_receivedAt_idx" ON "ScanAttempt"("receivedAt");
CREATE INDEX "ScanAttempt_createdAt_idx" ON "ScanAttempt"("createdAt");
CREATE INDEX "ScanAttempt_studentId_deviceId_receivedAt_idx" ON "ScanAttempt"("studentId", "deviceId", "receivedAt");
CREATE UNIQUE INDEX "AttendanceRecord_acceptedScanAttemptId_key" ON "AttendanceRecord"("acceptedScanAttemptId");
CREATE INDEX "AttendanceRecord_sessionId_status_idx" ON "AttendanceRecord"("sessionId", "status");
CREATE INDEX "AttendanceRecord_sectionId_status_idx" ON "AttendanceRecord"("sectionId", "status");
CREATE INDEX "AttendanceRecord_studentId_sectionId_timestamp_idx" ON "AttendanceRecord"("studentId", "sectionId", "timestamp");

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_acceptedScanAttemptId_fkey"
FOREIGN KEY ("acceptedScanAttemptId") REFERENCES "ScanAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AttendanceRecord" VALIDATE CONSTRAINT "AttendanceRecord_acceptedScanAttemptId_fkey";
