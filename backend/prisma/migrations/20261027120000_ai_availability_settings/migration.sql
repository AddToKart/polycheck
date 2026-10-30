-- AI assistant availability controls. All three switches default to enabled so
-- behavior is unchanged until an administrator acts. The insert is idempotent so
-- dirty/replayed databases and hand-seeded rows keep their configured values.

INSERT INTO "InstitutionSetting" ("key", "value", "updatedBy", "updatedAt")
VALUES
  ('ai_assistant_enabled', 'true', 'system', CURRENT_TIMESTAMP),
  ('ai_assistant_teacher_enabled', 'true', 'system', CURRENT_TIMESTAMP),
  ('ai_assistant_student_enabled', 'true', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
