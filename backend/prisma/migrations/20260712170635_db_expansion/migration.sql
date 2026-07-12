-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'late', 'absent', 'pending', 'disputed');

-- CreateEnum
CREATE TYPE "SectionRoleType" AS ENUM ('president', 'qac');

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "enrollmentCode" TEXT,
    "enrollmentCodeExpiry" TIMESTAMP(3),
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDay" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,

    CONSTRAINT "ScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "qrValidityMinutes" INTEGER NOT NULL,
    "gracePeriodMinutes" INTEGER NOT NULL,
    "geofenceLatitude" DOUBLE PRECISION NOT NULL,
    "geofenceLongitude" DOUBLE PRECISION NOT NULL,
    "geofenceRadiusMeters" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "qrToken" TEXT,
    "qrTokenExpiresAt" TIMESTAMP(3),
    "qrGeneratedAt" TIMESTAMP(3),
    "isRescheduled" BOOLEAN NOT NULL DEFAULT false,
    "rescheduledFromDate" TEXT,
    "originalScheduleTime" TEXT,
    "originalRoom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentProgram" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "deviceId" TEXT,
    "tokenSnapshot" TEXT,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "disputeDescription" TEXT,
    "disputeResolved" BOOLEAN NOT NULL DEFAULT false,
    "manuallySet" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionRole" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "role" "SectionRoleType" NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPermission" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SessionPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofOfClass" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByStudentName" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "ProofOfClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subject_code_idx" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Section_enrollmentCode_key" ON "Section"("enrollmentCode");

-- CreateIndex
CREATE INDEX "Section_teacherId_idx" ON "Section"("teacherId");

-- CreateIndex
CREATE INDEX "Section_subjectId_idx" ON "Section"("subjectId");

-- CreateIndex
CREATE INDEX "Section_enrollmentCode_idx" ON "Section"("enrollmentCode");

-- CreateIndex
CREATE INDEX "ScheduleDay_sectionId_idx" ON "ScheduleDay"("sectionId");

-- CreateIndex
CREATE INDEX "Enrollment_sectionId_idx" ON "Enrollment"("sectionId");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_sectionId_key" ON "Enrollment"("studentId", "sectionId");

-- CreateIndex
CREATE INDEX "Session_sectionId_idx" ON "Session"("sectionId");

-- CreateIndex
CREATE INDEX "Session_teacherId_idx" ON "Session"("teacherId");

-- CreateIndex
CREATE INDEX "Session_date_idx" ON "Session"("date");

-- CreateIndex
CREATE INDEX "Session_isActive_idx" ON "Session"("isActive");

-- CreateIndex
CREATE INDEX "AttendanceRecord_sessionId_idx" ON "AttendanceRecord"("sessionId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_sectionId_idx" ON "AttendanceRecord"("sectionId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_isSynced_idx" ON "AttendanceRecord"("isSynced");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_sessionId_studentId_key" ON "AttendanceRecord"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "SectionRole_sectionId_idx" ON "SectionRole"("sectionId");

-- CreateIndex
CREATE INDEX "SectionRole_studentId_idx" ON "SectionRole"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionRole_sectionId_studentId_role_key" ON "SectionRole"("sectionId", "studentId", "role");

-- CreateIndex
CREATE INDEX "SessionPermission_sectionId_idx" ON "SessionPermission"("sectionId");

-- CreateIndex
CREATE INDEX "SessionPermission_studentId_idx" ON "SessionPermission"("studentId");

-- CreateIndex
CREATE INDEX "SessionPermission_isActive_expiresAt_idx" ON "SessionPermission"("isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "ProofOfClass_sessionId_idx" ON "ProofOfClass"("sessionId");

-- CreateIndex
CREATE INDEX "ProofOfClass_sectionId_idx" ON "ProofOfClass"("sectionId");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDay" ADD CONSTRAINT "ScheduleDay_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionRole" ADD CONSTRAINT "SectionRole_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionRole" ADD CONSTRAINT "SectionRole_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPermission" ADD CONSTRAINT "SessionPermission_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionPermission" ADD CONSTRAINT "SessionPermission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfClass" ADD CONSTRAINT "ProofOfClass_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfClass" ADD CONSTRAINT "ProofOfClass_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfClass" ADD CONSTRAINT "ProofOfClass_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
