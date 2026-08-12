# Polycheck Production Deployment

## Reference topology

The production Compose stack is a secure single-host reference deployment:

```text
TLS edge -> nginx :8080 -> frontend :3000
                    -> backend replicas :4000 -> PgBouncer :5432 -> PostgreSQL :5432
                                              -> Redis :6379
Prometheus :9090 (loopback only) -> backend replicas :4000/api/metrics
```

nginx is the only public application entry point. Prometheus has a separate loopback-only host port for local operations. nginx serves the web application and routes same-origin `/api`, `/attendance`, and Socket.IO `/socket.io` traffic. Backend replicas share Socket.IO events, queues, attendance/auth rate limits, and active-session state through Redis. Web and mobile clients force WebSocket transport, so nginx round-robins new HTTP requests and WebSocket upgrades without sticky sessions. Each upgraded WebSocket naturally remains on the replica that accepted its connection.

PostgreSQL and Redis are isolated on an internal Compose network. Prometheus and backend replicas share a separate monitoring network, so Prometheus cannot directly reach the data services. Runtime Prisma connections use PgBouncer transaction pooling. The one-shot `migrate` service bypasses PgBouncer and connects directly to PostgreSQL. Backend startup never runs migrations. The scheduled `backup` service writes verified logical dumps and physical base backups to a required protected host mount; PostgreSQL continuously archives completed WAL segments to a separate required mount.

This topology improves process-level availability and throughput on one machine; it is not host-level high availability. Docker Compose cannot provide multi-host scheduling, automatic rolling updates, PodDisruptionBudgets, or an HA PostgreSQL control plane. Use an orchestrator and externally managed/replicated data services when those guarantees are required.

## Release gate

CI validates application tests/builds, both container images, immutable production image policy, backup/recovery scripts, the rendered base/scaled/recovery Compose configurations, nginx and monitoring syntax, k6 script syntax, production dependency audit, and HIGH/CRITICAL image vulnerability scans. A successful trusted repository `push` CI run on `main` triggers `.github/workflows/release-images.yml`, which publishes SHA-only GHCR images with SBOMs and GitHub provenance attestations. A manual release accepts only a full commit SHA contained in `main` with a successful trusted `push` CI run. The publishing job uses the protected `production-release` GitHub Environment; configure required reviewers and prevent self-review in repository settings. No mutable `latest` tag is produced. The release workflow also uploads a checksummed `deployment-images-<SHA>` artifact containing digest-pinned `BACKEND_IMAGE` and `FRONTEND_IMAGE` values.

The supported web browser matrix is the latest stable Chromium/Chrome/Edge, Firefox, and Safari/WebKit. Playwright runs the functional suite against all three engines; visual evidence is captured once in Chromium. Browser support follows the latest stable release rather than long-term support for obsolete browser versions.

Validate deployment assets locally:

```sh
sh deployment/scripts/validate-production-images.sh .env.production
sh deployment/scripts/validate-production-recovery.sh .env.production
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production -f docker-compose.yml -f deployment/docker-compose.scale.yml config --quiet
docker compose --env-file .env.production --profile recovery config --quiet
docker run --rm -v "$PWD/deployment/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" nginxinc/nginx-unprivileged:1.28-alpine nginx -t
docker run --rm -v "$PWD/performance:/work:ro" grafana/k6:0.55.0 inspect /work/attendance-load.js
mkdir -p /tmp/polycheck-prometheus-secrets
printf '%s' '<METRICS_TOKEN>' > /tmp/polycheck-prometheus-secrets/metrics_token
docker run --rm --entrypoint promtool -v "$PWD/deployment/monitoring:/etc/prometheus:ro" -v /tmp/polycheck-prometheus-secrets:/run/secrets:ro prom/prometheus:v3.5.0 check config /etc/prometheus/prometheus.yml
docker run --rm --entrypoint promtool -v "$PWD/deployment/monitoring:/etc/prometheus:ro" prom/prometheus:v3.5.0 check rules /etc/prometheus/alerts.yml
rm -rf /tmp/polycheck-prometheus-secrets
```

## Configuration

Copy `.env.production.example` to `.env.production`, replace every placeholder, and keep the resulting file out of version control. Prefer a secrets manager that injects these values at deployment time.

- Generate independent random values for PostgreSQL, Redis, Better Auth, and object-storage credentials. No reference credential is provided.
- URL-encode database and Redis passwords embedded in connection URLs. The raw service password and URL-encoded URL component may differ.
- `DATABASE_URL` must target `pgbouncer:5432` and include `pgbouncer=true`, `connection_limit`, and `pool_timeout`.
- `DIRECT_DATABASE_URL` must target `postgres:5432` and include a small `connection_limit` and bounded `pool_timeout`. It is used only by migrations.
- Keep `NEXT_PUBLIC_API_URL=/api`, `BETTER_AUTH_URL`, `FRONTEND_URL`, and `CORS_ORIGINS` on the public web origin for same-origin cookies and API requests.
- `BETTER_AUTH_SECRET` must contain at least 32 random characters and remain stable across replicas and releases.
- `METRICS_TOKEN` must be an independent random value of at least 32 characters. It is injected into the backend and mounted into Prometheus as a Docker secret.
- `STORAGE_DRIVER=s3` is mandatory in production. Use workload identity where available; otherwise inject bucket credentials securely.
- `BACKEND_IMAGE` and `FRONTEND_IMAGE` are mandatory. The deployment validator accepts only immutable registry digest references (`@sha256:<64 hex>`); tags — including `:sha-<commit>` tags — are retargetable and rejected. Copy the digest values from the `deployment-images` release artifact. Production Compose has no application build contexts.
- `POSTGRES_BACKUP_PATH` and `POSTGRES_WAL_ARCHIVE_PATH` must be different, existing absolute host paths on durable protected storage. Compose will not auto-create them. The directories must be writable by the PostgreSQL image uid/gid `70:70` and have mode `0700`.
- `PITR_RPO_MINUTES` and `PITR_RTO_MINUTES` are required operator-approved objectives. Validation rejects an archive timeout longer than the declared RPO.
- `TRUST_PROXY=true` and `TRUST_PROXY_HOPS=2` are required for the host TLS proxy -> nginx -> backend path. The host proxy must replace client-supplied `X-Forwarded-For` values before appending the real client address.
- Attendance sync batches use deterministic queue IDs and nginx allows a 15-second margin beyond the worker's 60-second result wait, so ambiguous client retries reuse the durable BullMQ job.

Android release builds still require `EXPO_PUBLIC_API_URL` set to the public HTTPS `/api` URL during the Expo/EAS build.

`NEXT_PUBLIC_ALLOW_QR_FALLBACKS` must remain `false` in production. Manual token and image-import paths are recovery/testing surfaces and are intentionally opt-in. Configure Sentry DSNs only after the institution approves the vendor and data-processing terms. The SDK strips request bodies, query strings, cookies, headers, email, and IP identity before transmission; it is disabled when the DSN is empty.

## TLS edge

The stack binds nginx to `127.0.0.1:8080` by default. Place a host-level TLS terminator such as Caddy, HAProxy, or a separately managed nginx instance in front of it, forward the original `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto=https`, and expose only ports 80/443 publicly. Configure certificate renewal, HTTP-to-HTTPS redirects, TLS 1.2+, and HSTS at that edge.

Do not set `HTTP_BIND_ADDRESS=0.0.0.0` unless a firewall restricts access and TLS terminates before requests reach the application.

`deployment/caddy/Caddyfile.example` is a deployable host-edge starting point. Install Caddy on the host, set `POLYCHECK_DOMAIN` and `ACME_EMAIL`, validate with `caddy validate`, and proxy only to the loopback-bound Compose nginx port. Verify certificate renewal and the HSTS header before opening enrollment. Do not enable HSTS preload until every subdomain is HTTPS-capable.

The backend currently trusts one proxy hop, while this reference path contains the host TLS edge and the Compose nginx proxy. The outer edge must overwrite untrusted forwarding headers, and production must verify that the backend observes the real client address before relying on per-IP audit or throttling. A complete fix requires either trusted real-IP normalization at nginx for the deployment-specific edge address or configurable trusted proxy hops in the backend; do not trust arbitrary private-network forwarding headers as a shortcut.

## Database pooling

The reference values allow each backend replica up to 10 Prisma connections while PgBouncer multiplexes clients over a default pool of 50 PostgreSQL server connections. Capacity-plan rather than blindly increasing these values:

```text
maximum Prisma clients = BACKEND_REPLICAS * connection_limit
PostgreSQL budget >= PgBouncer pools + migration/admin/reserved connections
```

PgBouncer pool size applies per database/user pair. Leave PostgreSQL connections for migrations, monitoring, maintenance, and superuser recovery. Alert on PgBouncer waiting clients, pool saturation, authentication failures, and PostgreSQL connection exhaustion.

Prisma migrations require session-level behavior and must never run through transaction pooling. The migration service deliberately replaces `DATABASE_URL` with `DIRECT_DATABASE_URL` before invoking `prisma migrate deploy`.

## Prepare protected recovery storage

The self-hosted baseline refuses to render without explicit backup and WAL destinations. On the Linux deployment host, mount the institution-approved durable filesystems first, then prepare separate paths:

```sh
sudo install -d -o 70 -g 70 -m 0700 /srv/polycheck/backups
sudo install -d -o 70 -g 70 -m 0700 /srv/polycheck/wal-archive
```

These may be paths on separately managed encrypted network/block storage. Merely using paths on the application host does **not** make them off-host disaster recovery. Confirm mount persistence, free-space monitoring, encryption, access controls, and the storage provider's failure domain before launch. Never point either variable at the PostgreSQL data volume, and never use the same directory for both controls.

## Deploy and migrate

The `20260718213000_scan_evidence_hardening` migration creates indexes transactionally because Prisma 5 wraps migration SQL in a transaction and cannot run PostgreSQL `CREATE INDEX CONCURRENTLY`. Schedule a maintenance window and rehearse it against a production-sized database before deployment.

Download the `deployment-images-<SHA>` artifact from the successful release workflow, verify `deployment-images.env.sha256`, and copy its two digest-pinned image values into `.env.production`. Validate before pulling anything:

```sh
sha256sum -c deployment-images.env.sha256
sh deployment/scripts/validate-production-images.sh .env.production
sh deployment/scripts/validate-production-recovery.sh .env.production
docker compose --env-file .env.production pull backend frontend migrate
docker compose --env-file .env.production up --no-build migrate
```

Proceed only after it exits with code 0. Then start the base topology:

```sh
docker compose --env-file .env.production up -d --no-build
```

The `migrate` container remains exited and successful. Backend replicas depend on that successful completion but execute only `node dist/main.js`. Running migration deployment again is safe and applies only unapplied Prisma migrations.

For three replicas, or another `BACKEND_REPLICAS` value:

```sh
docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f deployment/docker-compose.scale.yml \
  up -d --no-build
```

Modern Docker Compose honors `deploy.replicas` in this override. If the installed Compose implementation ignores it, omit the override and use `docker compose ... up -d --scale backend=3`. Never add `container_name` or publish a backend host port, as either prevents safe scaling. nginx resolves the Compose service through Docker DNS and round-robins new API requests and WebSocket upgrades across replicas. Sticky sessions are unnecessary while all supported clients force WebSocket transport.

Production Compose cannot build the backend, frontend, or migration image. A missing/invalid image reference fails validation instead of silently building from a mutable worktree. `docker-compose.local.yml` remains the build-capable local developer path.

For a release created from commit `<SHA>`, configure:

```sh
BACKEND_IMAGE=ghcr.io/<owner>/<repo>/backend@sha256:<BACKEND_DIGEST>
FRONTEND_IMAGE=ghcr.io/<owner>/<repo>/frontend@sha256:<FRONTEND_DIGEST>
docker compose --env-file .env.production pull backend frontend migrate
docker compose --env-file .env.production up --no-build migrate
docker compose --env-file .env.production up -d --no-build
```

Record both image digests and the release commit in the change ticket. The release artifact is the authoritative handoff from build to deployment.

## Health and operations

- Edge/backend readiness: `GET /healthz`
- Frontend container: `GET /login`
- Backend liveness: `GET /api/health`
- Backend readiness: `GET /api/health/ready`
- Backend metrics: `GET /api/metrics` with `Authorization: Bearer <METRICS_TOKEN>` in production

Configure the GitHub `staging` environment variable `STAGING_BASE_URL` with the public HTTPS staging origin. `.github/workflows/staging-smoke.yml` runs automatically after a successful GitHub deployment to the `staging` environment and can also be started manually. Its checks are read-only: dependency readiness, backend liveness, the published privacy notice, frontend rendering, same-origin redirects, and required security headers. A staging deployment is not eligible for promotion until this workflow passes.

Backend readiness fails when PostgreSQL, Redis, or any configured BullMQ producer/events/worker component is unavailable. nginx `/healthz` proxies this readiness check and passively retries failed upstreams. Docker Compose health status gates startup but does not actively withdraw or restart an unhealthy running replica; use an external supervisor or active-health-capable orchestrator when automatic runtime withdrawal is required. Prometheus discovers every backend replica through Docker DNS and scrapes process, HTTP, dependency, and queue metrics every 15 seconds. HTTP metrics use only method, registered route templates, and status code; queue metrics never contain user, student, session, job, token, coordinate, or raw URL identifiers.

Prometheus binds to host loopback on `${PROMETHEUS_PORT:-9090}` and is not remotely reachable unless the operator deliberately places an authenticated monitoring proxy or VPN in front of it. Its bearer credential is read from `/run/secrets/metrics_token`; rotate it by replacing `METRICS_TOKEN` and recreating both backend and Prometheus containers. Rules in `deployment/monitoring/alerts.yml` cover no-ready instances, HTTP 5xx and latency, resident memory, event-loop lag, Redis/BullMQ readiness, failed jobs, and queue backlog. Connect Prometheus to an Alertmanager appropriate for the deployment to deliver these alerts.

To enable the included Alertmanager route, copy `deployment/monitoring/alertmanager.yml.example` outside the repository, replace the webhook with the private on-call receiver, set `ALERTMANAGER_CONFIG_PATH` to that file, and start Compose with `--profile alerting`. Send and resolve a test alert before launch; an alert definition without verified delivery is not an operational control.

Application logs and nginx access logs are emitted to stdout/stderr for collection by the host logging agent. Also monitor container restarts, Redis memory/latency, PostgreSQL replication/backups, disk capacity, PgBouncer wait time, Prometheus target health, and alert-delivery health.

Compose applies memory, CPU, PID, read-only-root-filesystem, dropped-capability, and `no-new-privileges` controls where compatible with each image. Resource defaults are starting points. Validate them under the documented load test before launch.

## Data protection and recovery

The `backup` service starts with the normal production stack, immediately takes a backup, and then repeats every `BACKUP_INTERVAL_SECONDS` (24 hours by default). Every scheduled or manually started backup holds a PostgreSQL advisory lock for the entire backup/retention operation, so independently started containers cannot overlap and no filesystem PID lock can become stale. Each run:

1. Creates a custom-format logical dump with mode `0600`.
2. validates its catalog, writes a SHA-256 file, and verifies that checksum;
3. periodically creates a physical `pg_basebackup` (`BASE_BACKUP_INTERVAL_DAYS`, seven by default), validates it with `pg_verifybackup`, archives it, and verifies its checksum;
4. prunes old logical dumps and base backups while never deleting the base backup `latest-base.tar.gz` still points at (a failing-base streak cannot orphan the last recoverable PITR base);
5. prunes archived WAL segments older than the oldest retained base backup's start point, preserving an unbroken chain for every retained recovery target; and
6. updates `.last-success` only after every due operation succeeds, then applies retention.

Container health fails when `.last-success` exceeds `BACKUP_MAX_AGE_SECONDS`. Alert on an unhealthy `backup` container, PostgreSQL `pg_stat_archiver` failures, mount capacity, and stale `.last-success-utc`. Run an extra backup without interrupting the schedule with:

```sh
docker compose --env-file .env.production run --rm backup once
```

The PostgreSQL password is mounted into PostgreSQL and backup/recovery containers as a Compose secret and read without placing it in command arguments or logs. PgBouncer's image still receives the password through its required service environment, so restrict the deployment environment file, container-inspection access, and Docker access accordingly.

### PITR path

The included self-hosted PITR path is physical base backups plus PostgreSQL `archive_mode=on`. `archive-wal.sh` atomically accepts only uppercase PostgreSQL 16 MiB WAL segment, `.backup`, and `.history` filenames, requires the source basename to match, rejects symlinks/path traversal, verifies every copy before acknowledging PostgreSQL, and refuses to archive when the destination has less than `WAL_MIN_FREE_KB` free. `WAL_MIN_FREE_KB` is passed to the PostgreSQL archiver process. `archive_timeout` defaults to 300 seconds and production validation requires it not to exceed the declared RPO. PostgreSQL startup health permits a fresh cluster with zero archive attempts, avoiding a first-start dependency deadlock; after an attempt, health requires the latest archive event to be successful. Alert independently on `pg_stat_archiver.failed_count` changes and stale/no archived WAL.

```sh
docker compose --env-file .env.production --profile recovery run --rm pitr-verify
```

`pitr-verify` always walks the archived segment sequence from the base backup's `START WAL LOCATION` to the newest reachable segment and fails on any interior gap. The verifier uses PostgreSQL's real 16 MiB arithmetic (`...FF` -> next XLogId `...00`), requires uppercase names, validates `.backup` offsets, parses `.history` ancestry/switch LSNs, follows timeline transitions, and has a bounded `PITR_MAX_CHAIN_SEGMENTS` workload. Metadata checks do not by themselves prove WAL records are replayable, so CI also restores the physical base into an isolated temporary cluster, replays archived WAL to a named restore point created after the base backup, and verifies a post-base marker row.

The baseline objectives in the example are **RPO 5 minutes** and **RTO 4 hours**. They are operational targets, not guaranteed HA. The RPO depends on durable WAL writes and alert response; the RTO includes provisioning an isolated PostgreSQL instance, restoring the latest physical base backup, replaying archived WAL to the chosen target, validating data, and switching application connectivity. Rehearse that complete procedure before launch and at least quarterly.

Do not delete archived WAL solely by age: every retained recovery target needs an unbroken WAL chain from a retained base backup. The included automation prunes only segments older than the oldest retained base backup's start point, so retention cannot break a chain; it never touches `.history`, `.partial`, or checksum files. Size and monitor the archive, apply a reviewed lifecycle only after a restore drill identifies the oldest still-required WAL segment, and watch `pg_stat_archiver` plus mount capacity. The included automation intentionally does not claim object-store replication, off-host storage, or automatic cross-host WAL replication.

### Restore drills

Run the non-destructive logical restore drill monthly. It verifies the dump checksum/catalog, restores into a uniquely named temporary database on the running server, checks for a core table, and always drops only that temporary database. Cleanup failure is emitted and makes an otherwise successful drill fail, while an earlier restore failure keeps its original nonzero status. Because the drill runs against the live cluster, it requires explicit confirmation:

```sh
docker compose --env-file .env.production --profile recovery run --rm -e RUN_RESTORE_DRILL=1 restore-drill
# Or select a retained dump mounted under /backups:
docker compose --env-file .env.production --profile recovery run --rm -e RUN_RESTORE_DRILL=1 restore-drill /backups/polycheck-<timestamp>.dump
```

For the quarterly PITR drill, create a durable verification marker after a physical base backup, create a named restore point after committing that marker, force and confirm archival of the WAL segment containing the restore point, then run `pitr-restore-drill` with `RUN_PITR_RESTORE_DRILL=1`, `PITR_RECOVERY_TARGET_NAME`, and a read-only `PITR_VERIFY_SQL` that returns exactly `1`. It extracts and `pg_verifybackup`-validates the physical base into a dedicated Compose volume, starts an isolated no-network PostgreSQL 16 instance, replays from the read-only archive to the named marker, verifies the post-base record, and stops the instance. Record achieved RPO/RTO, then remove the drill volume with `docker volume rm polycheck_pitr-restore-data` after confirming no drill container is running. Never point `RESTORE_DATA_DIR` at live data.

Remaining limitation: this single-host reference does not replicate backups/WAL to another failure domain, continuously execute restore drills, or select a business recovery timestamp automatically. A timeline history archive can only be validated after a promotion creates that timeline. Quarterly drills must still validate an operator-chosen recovery point and representative institutional data/object references. PostgreSQL, migration, application, and PgBouncer still share the `polycheck` database role; splitting owner/migrator/runtime/backup roles remains a least-privilege follow-up requiring rehearsed grants and migration compatibility work.

- Replicate or mount backup/WAL storage into a separate failure domain if off-host disaster recovery is required. A local directory alone is not disaster recovery.
- Enable versioning, retention, encryption, and independent backups for the proof-object bucket.
- Restore the database and object references together in recovery exercises.
- Redis persistence reduces restart impact but does not replace PostgreSQL as the source of truth.
- Restrict `.env.production`, Docker socket access, backup credentials, and host administrator access.

Denied scan attempts without an accepted attendance record are pruned after `DENIED_SCAN_RETENTION_DAYS` (default 90). Audit records are pruned after `AUDIT_LOG_RETENTION_DAYS` (default seven years). Both jobs use a Redis ownership lock and bounded database batches. Set these values only after the PUP data protection office approves the records schedule. Object-store lifecycle and legal holds remain storage-provider policy and must align with the same schedule.

## Privacy activation

The current notice lives at `/privacy`. Every student must accept the exact `PRIVACY_NOTICE_VERSION` before attendance or offline sync endpoints accept location evidence. Changing the version forces renewed consent. Seeded test accounts are pre-consented only for deterministic CI; real accounts are not.

Before launch, replace the generic contact language in the notice with the responsible PUP office and contact channel, obtain institutional/legal approval, publish the final HTTPS URL, and preserve the approved notice text outside the deployable application. The application records version and acceptance time; it does not substitute for the institution's legal review.

## Mobile store release

`android/eas.json` defines development, preview APK, and production store profiles. Production uses remote version management, automatic build-number increments, Android App Bundle output, and the EAS `production` environment. The app config includes stable Android/iOS identifiers and initial native version numbers.

One-time external setup:

```sh
cd android
eas login
eas build:configure
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_API_URL --value https://polycheck.example.edu/api
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_ALLOW_QR_FALLBACKS --value false
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SENTRY_DSN --value <mobile-public-dsn>
eas env:create --environment production --visibility sensitive --name SENTRY_AUTH_TOKEN --value <source-map-token>
eas build --platform all --profile production
```

Set `SENTRY_ORG` and `SENTRY_PROJECT` in the EAS production environment when crash reporting is approved. Let EAS manage Android/iOS signing credentials or provide institution-controlled credentials through the EAS credential flow. Store submission, privacy declarations, data-safety forms, package ownership, and staged rollout still require the official institutional store accounts. Validate the generated AAB on Google Play's internal track and the iOS archive through TestFlight before production rollout.

## Rollback

Redeploy the prior immutable backend and frontend images. Migrations must remain backward-compatible with the immediately previous application release. Roll database changes forward with a new migration; never delete or rewrite applied migration history. Confirm backend readiness and WebSocket reconnection after rollback.
