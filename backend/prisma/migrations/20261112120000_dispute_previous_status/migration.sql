-- DD-B2: preserve the attendance status that existed before a dispute was
-- filed, so rejecting the dispute restores `late`/`present`/... instead of
-- forcing `absent` (which made rejecting worse than never disputing).
-- Nullable and backfill-free: legacy disputed rows fall back to `absent`.
-- IF NOT EXISTS keeps replayed/partially patched databases from crashing.

ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "disputePreviousStatus" "AttendanceStatus";
