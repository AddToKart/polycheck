-- Bulk import support: forced first-login password rotation and import batch
-- audit summaries (counts only, never row PII).

ALTER TABLE "User"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "department" TEXT,
    "total" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "summary" JSONB,
    "rowChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportBatch_actorId_createdAt_idx" ON "ImportBatch"("actorId", "createdAt");
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

ALTER TABLE "ImportBatch"
  ADD CONSTRAINT "ImportBatch_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
