CREATE TABLE "ScanAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "deviceId" TEXT,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "message" TEXT,
    "tokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScanAttempt_sessionId_timestamp_idx" ON "ScanAttempt"("sessionId", "timestamp");
CREATE INDEX "ScanAttempt_studentId_timestamp_idx" ON "ScanAttempt"("studentId", "timestamp");
CREATE INDEX "ScanAttempt_deviceId_idx" ON "ScanAttempt"("deviceId");

ALTER TABLE "ScanAttempt" ADD CONSTRAINT "ScanAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScanAttempt" ADD CONSTRAINT "ScanAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
