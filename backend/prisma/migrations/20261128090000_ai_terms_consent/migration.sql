-- Records which version of the AI assistant terms each account accepted.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiTermsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiTermsAcceptedAt" TIMESTAMP(3);
