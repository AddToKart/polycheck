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

PostgreSQL and Redis are isolated on an internal Compose network. Prometheus and backend replicas share a separate monitoring network, so Prometheus cannot directly reach the data services. Runtime Prisma connections use PgBouncer transaction pooling. The one-shot `migrate` service bypasses PgBouncer and connects directly to PostgreSQL. Backend startup never runs migrations.

This topology improves process-level availability and throughput on one machine; it is not host-level high availability. Docker Compose cannot provide multi-host scheduling, automatic rolling updates, PodDisruptionBudgets, or an HA PostgreSQL control plane. Use an orchestrator and externally managed/replicated data services when those guarantees are required.

## Release gate

CI validates application tests/builds, both container images, the rendered base and scaled Compose configurations, nginx and monitoring syntax, k6 script syntax, production dependency audit, and HIGH/CRITICAL image vulnerability scans. A successful `main` CI run triggers `.github/workflows/release-images.yml`, which publishes SHA-only GHCR images with SBOMs and GitHub provenance attestations. No mutable `latest` tag is produced.

The supported web browser matrix is the latest stable Chromium/Chrome/Edge, Firefox, and Safari/WebKit. Playwright runs the functional suite against all three engines; visual evidence is captured once in Chromium. Browser support follows the latest stable release rather than long-term support for obsolete browser versions.

Validate deployment assets locally:

```sh
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production -f docker-compose.yml -f deployment/docker-compose.scale.yml config --quiet
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

## Deploy and migrate

The `20260718213000_scan_evidence_hardening` migration creates indexes transactionally because Prisma 5 wraps migration SQL in a transaction and cannot run PostgreSQL `CREATE INDEX CONCURRENTLY`. Schedule a maintenance window and rehearse it against a production-sized database before deployment.

Build and run the one-shot migration first:

```sh
docker compose --env-file .env.production up --build migrate
```

Proceed only after it exits with code 0. Then start the base topology:

```sh
docker compose --env-file .env.production up -d --build
```

The `migrate` container remains exited and successful. Backend replicas depend on that successful completion but execute only `node dist/main.js`. Running migration deployment again is safe and applies only unapplied Prisma migrations.

For three replicas, or another `BACKEND_REPLICAS` value:

```sh
docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f deployment/docker-compose.scale.yml \
  up -d --build
```

Modern Docker Compose honors `deploy.replicas` in this override. If the installed Compose implementation ignores it, omit the override and use `docker compose ... up -d --scale backend=3`. Never add `container_name` or publish a backend host port, as either prevents safe scaling. nginx resolves the Compose service through Docker DNS and round-robins new API requests and WebSocket upgrades across replicas. Sticky sessions are unnecessary while all supported clients force WebSocket transport.

Use immutable registry image tags or digests for repeatable releases. On a deployment host, pre-pull tested images rather than building from a mutable worktree.

For a release created from commit `<SHA>`, configure:

```sh
BACKEND_IMAGE=ghcr.io/<owner>/<repo>/backend:sha-<SHA>
FRONTEND_IMAGE=ghcr.io/<owner>/<repo>/frontend:sha-<SHA>
docker compose --env-file .env.production pull backend frontend migrate
docker compose --env-file .env.production up migrate
docker compose --env-file .env.production up -d --no-build
```

Record both image digests in the change ticket. Deploy by digest for the strongest rollback guarantee.

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

## Data protection

- Run `deployment/scripts/backup-postgres.sh` from a protected host account on a schedule. Set `BACKUP_DIR` to encrypted storage outside the application checkout. The script creates a restricted custom-format dump, SHA-256 checksum, and validates the archive catalog before reporting success.
- Copy backups to a separate account/region and apply an operator-approved lifecycle policy. A backup on the same host is not disaster recovery.
- Run `deployment/scripts/restore-drill.sh <dump>` against an isolated rehearsal stack whenever possible. It restores into a uniquely named temporary database, performs a core-table query, and removes only that drill database.
- PostgreSQL dumps are recovery checkpoints, not full point-in-time recovery. For institution-wide use, enable WAL archiving or use managed PostgreSQL with tested PITR and documented recovery-point/recovery-time objectives.
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
