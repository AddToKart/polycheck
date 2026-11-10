-- LI1 device-integrity login gate: sessions learn which device holds them and
-- the user remembers which device is exempt from the logout-armed cooldown.
-- Both columns are additive and nullable: legacy sessions keep deviceId NULL
-- (they never block another device) and legacy users keep today's cooldown
-- semantics until the next logout/unregister stamps an exempt device.
-- IF NOT EXISTS keeps replayed/partially patched databases from crashing.

ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
CREATE INDEX IF NOT EXISTS "AuthSession_userId_deviceId_idx" ON "AuthSession"("userId", "deviceId");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cooldownDeviceId" TEXT;
