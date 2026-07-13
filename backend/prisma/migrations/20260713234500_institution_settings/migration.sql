CREATE TABLE "InstitutionSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionSetting_pkey" PRIMARY KEY ("key")
);
