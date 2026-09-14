-- Defense-in-depth constraints for values already validated by the API.
-- These prevent maintenance scripts and future services from persisting states
-- that the attendance domain cannot interpret safely.

ALTER TABLE "User"
  ADD CONSTRAINT "User_yearLevel_range"
  CHECK ("yearLevel" IS NULL OR "yearLevel" BETWEEN 1 AND 8),
  ADD CONSTRAINT "User_role_fields_valid"
  CHECK (
    ("role" = 'student' AND "studentId" IS NOT NULL AND "program" IS NOT NULL AND "yearLevel" IS NOT NULL AND "department" IS NOT NULL AND "scope" IS NULL)
    OR ("role" = 'teacher' AND "email" IS NOT NULL AND "scope" IS NULL)
    OR ("role" = 'super_admin' AND "scope" IN ('department', 'institution'))
  ),
  ADD CONSTRAINT "User_department_scope_valid"
  CHECK ("role" <> 'super_admin' OR "scope" <> 'department' OR "department" IS NOT NULL);

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_qrValidityMinutes_range"
  CHECK ("qrValidityMinutes" BETWEEN 1 AND 15),
  ADD CONSTRAINT "Session_gracePeriodMinutes_range"
  CHECK ("gracePeriodMinutes" BETWEEN 0 AND 60),
  ADD CONSTRAINT "Session_time_order"
  CHECK ("startTime" < "endTime"),
  ADD CONSTRAINT "Session_end_state_valid"
  CHECK (NOT ("isActive" AND "endedAt" IS NOT NULL));

ALTER TABLE "ScheduleDay"
  ADD CONSTRAINT "ScheduleDay_time_order"
  CHECK ("startTime" < "endTime");
