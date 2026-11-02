# Production readiness changes

## Offline operation recovery

The mobile queue retains the original operation ID, scan timestamp, token and evidence across retries. Activation conflicts are acknowledged only when the authoritative session has the exact queued token; end conflicts require an authoritative `endedAt`. A conflicting token is not a successful replay. Permanent HTTP failures are retained for review and no longer block later operations. Network, authentication and temporary server failures preserve the queue.

New mobile clients submit to `POST /api/sync/attendance/batches`. Production returns HTTP 202 with an account-scoped `receiptId`. `GET /api/sync/attendance/batches/:receiptId` returns pending, failed, or completed with per-record results. A receipt alone never deletes SQLite evidence. The same account and payload produce the same receipt; PostgreSQL attempt deduplication remains authoritative after Redis job retention expires. The legacy endpoint is retained for older clients with a bounded five-second worker wait.

Students see **Saved on device** before acknowledgment. The dashboard shows outstanding and failed operations, provides a sync button, and lets the student inspect a failed operation and retry the original evidence. History shows confirmation separately from the attendance outcome and excludes unconfirmed records from confirmed totals. A successful sync may still produce **Disputed**.

An on-time scan uploaded after the attendance window or session end requires instructor review. This is intentional: a teacher-signed QR does not authenticate a student's claimed capture time. Teachers should review delayed uploads in Disputes, use the retained timestamps/location evidence and classroom knowledge, and resolve the record. Do not automatically convert all delayed uploads to Present.

Deploy the backend before distributing the updated mobile application.

## Database access upgrade

Set unique random values (at least 24 characters) for `POSTGRES_PASSWORD`, `RUNTIME_DATABASE_PASSWORD`, `MIGRATOR_DATABASE_PASSWORD`, and `BACKUP_DATABASE_PASSWORD`. Update both database URLs using URL-encoded role passwords as shown in `.env.production.example`.

The `provision-roles` service runs before PgBouncer, migrations and backups. It creates or updates non-superuser runtime, migrator and backup roles. On existing installations it transfers only application tables, sequences and enum types in `public` from the bootstrap administrator to the migrator. Runtime receives DML permissions; backup receives read and replication permissions. New tables created by the migrator inherit the required grants. The bootstrap administrator is retained for provisioning and isolated restore drills.

Take and verify a backup before deploying this ownership change. Rehearse on a staging restore first. Do not revert just the connection URLs after rollout; ownership and grants are database state. The CI recovery job tests runtime writes, future-object grants, denial of runtime DDL, and denial of backup writes before the backup/PITR drills.

## Off-host recovery

Production launch commands include `deployment/docker-compose.offsite.yml`. Configure the `RESTIC_*` and `OFFSITE_*` settings in `.env.production.example` with an HTTPS repository in a different host/account failure domain. Keep the encryption password in an independently recoverable secret store. A different directory or bucket name alone does not prove failure-domain separation.

Initialize once, then start production:

```sh
pnpm docker:prod:offsite:init
pnpm docker:prod:up
pnpm docker:prod:offsite:check
```

Restic encrypts and uploads completed base backups, logical dumps and WAL archives. Incomplete files are excluded. Failed transfers do not update the successful-upload marker; the service becomes unhealthy when it is stale. Monitor this health externally and alert an operator. The initial base backup/upload can exceed the health start period on large installations; measure it during commissioning.

Offsite snapshots run every 300 seconds by default. The **offsite** recovery lag includes PostgreSQL's archive timeout, upload scheduling and transfer duration; the existing five-minute local WAL objective is not an offsite guarantee. Measure the achieved offsite RPO independently. The freshness threshold is 900 seconds by default.

No remote snapshots are automatically deleted. Configure versioning/retention on the remote store and apply a reviewed Restic retention policy after a successful restore drill. Do not apply raw object expiration to Restic pack files. Back up proof objects independently with bucket versioning and a separate recovery copy.

On a replacement host, create an empty directory owned by UID/GID 70. Select a full snapshot ID using `restic snapshots` with the same repository/password, then restore into that isolated directory:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f deployment/docker-compose.offsite.yml run --rm \
  -e RUN_OFFSITE_RESTORE=1 -e RESTIC_SNAPSHOT_ID=<64_HEX_SNAPSHOT_ID> \
  -v /srv/polycheck/recovery-download:/restore offsite-backup restore
```

Point `POSTGRES_BACKUP_PATH` and `POSTGRES_WAL_ARCHIVE_PATH` in a separate recovery environment file to the downloaded `backups` and `wal-archive` directories. Run the existing chain verification, logical restore and physical PITR restore drills. Validate attendance totals, representative records and proof-object references before switching application traffic. Record elapsed restore time and the newest recovered transaction timestamp. Do not restore over a live database.

## Measured staging load

The `Staging attendance load` workflow executes k6, not just `k6 inspect`. Configure a dedicated `load-testing` environment with:

- `STAGING_BASE_URL`: isolated HTTPS staging origin with representative deployment sizes.
- `LOAD_TEST_AUTHORIZATION=DISPOSABLE_STAGING_ONLY`.
- Secret `LOAD_FIXTURE_JSON`: `{"teacher":{"email":"loadtest-faculty@example.test","password":"..."},"students":[{"studentId":"2026-00001-MN-0","password":"..."}]}`. Use two students for smoke or 1,000 distinct students for full. For a compact full-run secret, use `"studentPassword":"...","students":["2026-00001-MN-0","2026-00002-MN-0",...]` with a shared password only for these disposable test accounts. Provision dedicated accounts in advance; no real student credentials.

The preparation script logs in, accepts the test privacy notice, creates a fresh subject/section, enrolls the fixture students and signs a fresh QR. It rotates only the dedicated teacher's key. Credentials are written to a restricted temporary file and removed after execution. The workload runs online submissions and queued offline submissions separately, with concurrent teacher session reads. A third workload measures a login burst with distinct dedicated accounts. It retains production rate limits; a throttled run fails visibly rather than weakening authentication controls. The login workload should be assessed against the actual campus NAT/network topology. Offline traffic replays the exact payload to test lost-response recovery, checks receipt stability and waits for authoritative completion. Results are retained as workflow artifacts named with the commit SHA. Fixture provisioning is outside the measured interval and respects login rate limits.

Retain the passing full-run artifact before institution-wide launch. Inspect p95/p99 response times, sync confirmation latency, rejection rates, worker queue age and database saturation. A passing smoke run proves connectivity, not capacity. Use a disposable staging clone for worker pause/restart, Redis interruption, multiple backend instances and recovery under backlog; never interrupt shared production infrastructure for these tests. Keep the original evidence, expected failures and recovered results with the release record. Remove the dedicated test subjects through the teacher account after retaining results.

## Physical-device acceptance

CI tests process death with queued SQLite evidence and builds the release APK with `EXPO_PUBLIC_E2E_MODE=false` and `EXPO_PUBLIC_ALLOW_QR_FALLBACKS=false`. Unit regressions cover receipt ownership, response loss, delayed uploads and revoked enrollment/key validation. These do not substitute for camera/GPS testing on hardware.

Before release, record the APK SHA-256, backend release SHA, device model, OS version, date and tester for each result below. Use at least two supported Android devices, including a lower-spec device, and the release APK connected to isolated staging.

| Journey | Required result |
|---|---|
| Physical camera scans a teacher QR inside the geofence | Confirmed Present/Late appears once in teacher roster |
| Camera/location denied, then permission granted | Clear recovery action; no false success |
| Airplane-mode scan, force-stop, reopen offline | Saved evidence survives; UI does not claim confirmation |
| Reconnect before expiry | One authoritative attendance record; queue clears only after acknowledgment |
| Reconnect after expiry/session end | Needs review is visible; instructor resolves through Disputes |
| Enrollment removed or teacher key revoked before reconnect | Evidence is retained/rejected visibly; later operations still sync |
| Response lost after activation/end committed | Retry recognizes the matching server state |
| Borderline indoor GPS, poor accuracy and outside-geofence scans | Clear uncertainty/rejection; no incorrect confirmed presence |
| Repeat reconnects, logout/account switch, slow connection | No cross-account queue access or duplicate attendance |

External evidence still required: successful staging workload artifacts, a replacement-host offsite restore report, proof-object restore verification, and physical-device results. Repository checks alone cannot certify these outcomes.

## Validation recorded during implementation

- Full backend suite: 385 tests passed before the final receipt snapshot-race fix; all six sync unit tests passed after that fix, including its regression.
- Full Android suite: 129 tests passed; the expanded offline-store suite then passed all 35 tests, including failed-item visibility, same-evidence retries and account isolation.
- Real Redis integration passed: paused worker, duplicate submission, restart, owner-restricted receipt access, committed result polling, and prompt producer failure/reconnection. It exposed and helped fix a race between loading job metadata and reading completion state.
- All existing PostgreSQL migration SQL files ran under the new migrator role in an isolated PostgreSQL 16 container. Runtime reads/writes and backup reads succeeded; runtime DDL and backup mutation were denied. Logical dump creation and physical base backup verification succeeded.
- TypeScript checks passed for backend and Android. Backend formatting/lint, workflow actionlint, production Compose rendering, shellcheck, deployment script tests, offsite transfer/restore control tests and production-access validation passed. k6 inspected the online, offline and login workloads successfully.
- No live production deployment, external load test, remote bucket initialization or physical-device acceptance was performed. Test containers used disposable data.
