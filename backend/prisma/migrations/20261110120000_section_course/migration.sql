-- CS2: attach the PUP Santa Maria program/course code to sections. Two
-- sections can share a subject while belonging to different courses, so the
-- course travels with the section row. Nullable and additive: legacy sections
-- keep rendering without a course and no backfill is forced. The IF NOT EXISTS
-- guard keeps replayed/partially patched databases from crashing.
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "course" TEXT;
