-- PUP Santa Maria concurrent administrative designations ("dual-hat" faculty)
-- plus the institution maintenance-mode settings. Every designation column is
-- defaulted false so existing accounts keep today's behavior exactly until a
-- super admin assigns a designation. The settings inserts are idempotent so
-- dirty/replayed databases and hand-seeded rows keep their configured values.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isItCoordinator"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isDepartmentHead" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isUserRegistrar"  BOOLEAN NOT NULL DEFAULT false;

-- Department oversight and registrar lookups scan designated faculty by
-- department; the partial index keeps those scans cheap without indexing the
-- whole teacher population.
CREATE INDEX IF NOT EXISTS "user_designee_department_idx"
  ON "User" ("department")
  WHERE "role" = 'teacher' AND ("isDepartmentHead" = true OR "isUserRegistrar" = true);

INSERT INTO "InstitutionSetting" ("key", "value", "updatedBy", "updatedAt")
VALUES
  ('maintenance_mode_enabled', 'false', 'system', CURRENT_TIMESTAMP),
  ('maintenance_message',      '',      'system', CURRENT_TIMESTAMP),
  ('maintenance_until',        '',      'system', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
