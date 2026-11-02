-- F6 (WF-LD8): RA 10173 privacy center. Seeds only the geolocation retention
-- window; everything else the center displays is computed live (consent counts,
-- attestation counts) or kept outside the settings table by design (Redis
-- `privacy:shred:last` last-run marker for the nightly telemetry shredder).
-- The idempotent insert keeps dirty/replayed databases and hand-configured
-- rows exactly as their operators left them.
INSERT INTO "InstitutionSetting" ("key", "value", "updatedBy", "updatedAt")
VALUES ('geolocation_retention_days', '30', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
