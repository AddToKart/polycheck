-- Shared column-mapping profiles for master-list imports: once one administrator confirms how a given
-- header layout maps onto the import fields, every administrator gets it automatically. Headers and column
-- positions only - never student data. Additive and idempotent.

CREATE TABLE IF NOT EXISTS "ImportMappingProfile" (
  "id"          TEXT         NOT NULL,
  "mode"        TEXT         NOT NULL,
  "fingerprint" TEXT         NOT NULL,
  "headers"     TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "mapping"     JSONB        NOT NULL,
  "uses"        INTEGER      NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportMappingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImportMappingProfile_mode_fingerprint_key"
  ON "ImportMappingProfile" ("mode", "fingerprint");
CREATE INDEX IF NOT EXISTS "ImportMappingProfile_updatedAt_idx" ON "ImportMappingProfile" ("updatedAt");
