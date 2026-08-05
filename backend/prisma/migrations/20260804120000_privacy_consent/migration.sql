ALTER TABLE "User"
ADD COLUMN "privacyConsentVersion" TEXT,
ADD COLUMN "privacyConsentedAt" TIMESTAMP(3);

CREATE INDEX "User_privacyConsentVersion_idx" ON "User"("privacyConsentVersion");
