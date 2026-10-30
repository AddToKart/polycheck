-- Account governance: delegated in-classroom password resets, per-teacher
-- capability overrides, and student mobile device binding with a self-service
-- cooldown. Every column is nullable so existing rows keep today's behavior
-- until a user or administrator acts. The settings insert is idempotent so
-- dirty/replayed databases and hand-seeded rows keep their configured values.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "boundDeviceId" TEXT,
  ADD COLUMN IF NOT EXISTS "deviceBoundAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deviceCooldownUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "canResetStudentPasswords" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "canEmergencyUnbindDevices" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

INSERT INTO "InstitutionSetting" ("key", "value", "updatedBy", "updatedAt")
VALUES
  ('allow_teacher_password_reset', 'true', 'system', CURRENT_TIMESTAMP),
  ('allow_teacher_emergency_device_unbind', 'true', 'system', CURRENT_TIMESTAMP),
  ('device_cooldown_hours', '2', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
