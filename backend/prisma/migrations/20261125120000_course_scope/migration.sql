-- Course scope (plan/course-scope-plan.md): PUP Santa Maria has no academic
-- departments, so head/registrar oversight is scoped by program (course)
-- instead. Everything here is additive and idempotent. The new columns are
-- inert until COURSE_SCOPE_MODE=course, so applying this migration changes no
-- behavior by itself.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "managedCourses"    TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "managesAllCourses" BOOLEAN NOT NULL DEFAULT false;

-- Oversight and report filters become section.course lookups.
CREATE INDEX IF NOT EXISTS "Section_course_idx" ON "Section" ("course");

-- Backfill existing designees only; no other row is touched. The campus has no
-- departments, so there is no meaningful department -> course mapping beyond
-- the known seed/demo value: 'CCIS' (demo head and registrar) maps to 'BSIT'.
-- Any other department value keeps an empty scope (fail-closed) and must be
-- assigned from the Users console. The guards make a re-run a no-op and never
-- overwrite a scope an administrator already set.
UPDATE "User"
SET "managedCourses" = ARRAY['BSIT']::TEXT[]
WHERE "role" = 'teacher'
  AND ("isDepartmentHead" = true OR "isUserRegistrar" = true)
  AND upper(btrim(COALESCE("department", ''))) = 'CCIS'
  AND cardinality("managedCourses") = 0
  AND "managesAllCourses" = false;

-- The seeded campus registrar serves every program.
UPDATE "User"
SET "managesAllCourses" = true
WHERE "role" = 'teacher'
  AND "isUserRegistrar" = true
  AND lower(COALESCE("email", '')) = 'reg.campus@pup.edu.ph'
  AND "managesAllCourses" = false;
