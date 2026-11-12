# Polycheck Fastify Ingestion Gateway (`polycheck-ingest`) — Implementation Plan

> **Status:** Drafted 2026-11-13. No code written. Companion to `plan/load-simulation-plan.md` (Addendum 2 holds the measured evidence this plan reacts to).
>
> **Ground rules for the reader:** every claim below marked `verified` was read from source in this repo (`backend/src/**`, `shared/src/**`, `performance/**`, compose files, client code). Unmarked items are design intent. Nothing in this document has been implemented.

---

## 0. Executive Summary

**Problem (measured).** The 2,000-scan instant burst produced 10.3 % success, p95 8,497 ms, and 1,694 scans that never reached the validator. Paced traffic at the same 2.22/s bell rate passes with a 12× margin. The failure is **burst concurrency**, not average throughput.

**Root causes (verified in source).**

1. **Data-plane work sits on the control-plane hot path.** `ScanValidator.validateScan` performs 2–3 sequential Prisma reads per scan (`session.findUnique`, `enrollment.findUnique`, teacher key/token lookup), then every accepted scan takes a **per-session `pg_advisory_xact_lock`** (`attendance/ledger.service.ts:59`) inside the write transaction. At 2,000 simultaneous scans that is ~6,000 DB round-trips into one pool plus 2,000 serialised chain appends.
2. **Uploading and scanning compete on one event loop.** Proof photos travel as base64 strings up to 7 MB inside JSON (`proofs.controller.ts:11`), the body limit is `MAX_PROOF_BYTES × 4/3 + 100 KB ≈ 6.8 MB` (`main.ts:21`), and `JSON.parse` of that payload blocks the single Node loop for tens of milliseconds per upload. Ten QAC members uploading together stall every scanner behind them.

**Proposal.** Split the hot ingestion path into a dedicated **Fastify process (`polycheck-ingest`)** that validates in-process using `@polycheck/shared`, buffers accepted work in **Redis Streams**, and drains to PostgreSQL in **ordered micro-batches**. Everything else — auth, disputes, sections, exports, AI, settings — stays in NestJS untouched.

**Key scope decision (not in the brief).** The four proposed gateway endpoints are *not* equal:

| Proposed endpoint | Reality in source | Decision |
|---|---|---|
| `POST /api/attendance/scan` | Student-scoped, privacy-consent-gated, hybrid-mode validator | ✅ gateway, **full** |
| `POST /api/sync/attendance/batches` | Offline replay, ≤100 records/batch | ✅ gateway, **full** |
| `GET /api/health/clock` | **Does not exist** — clients use `GET /health` (`android/services/api-client.ts:732`, `frontend/src/lib/api-client.ts:732`, `polycheck_mobile/api_config.dart:31`) | ⚠️ serve as an alias; **keep `/health` semantics identical** |
| `POST /api/attendance/attempts` | **Does not exist** — `/attendance/attempts` is a **GET** read used by radar + timeline (`api-client.ts:1678`) | ⚠️ gateway accepts a `POST` telemetry alias only if the NestJS route is *added*; default plan: gateway writes telemetry, NestJS keeps the read |

Reaching parity on `scan` means the gateway must replicate **the entire scan validation contract** (hybrid mode, dual checkpoints, meeting-PIN gate, geofence, device-security risk signals, replay detection, dispute stamping, receipt idempotency). That is the bulk of the work and the bulk of the risk. An alternative thin-slice exists (§7.1) and is recommended as the Phase-1 target.

---

## 1. System Topology & Request Lifecycle

### 1.1 Target topology

```
              ┌────────────────────────── Coolify Traefik / edge proxy ─────────────────────────┐
              │  Path routing (no client change):                                              │
              │    /api/attendance/scan        → ingest:4001                                   │
              │    /api/sync/attendance/batches→ ingest:4001                                   │
              │    /api/health                 → ingest:4001 (alias of /health/clock semantics) │
              │    everything else /api/*      → backend:4000  (unchanged)                     │
              └───────────────┬────────────────────────────────────────────┬───────────────────┘
                              │                                            │
                    ┌─────────▼─────────┐                        ┌─────────▼─────────┐
                    │  polycheck-ingest │  Fastify, TS, no DB in │  NestJS backend   │
                    │  validate in-mem  │  the request path     │  control plane    │
                    └─────────┬─────────┘                        └─────────┬─────────┘
                              │ XADD (immediate 2xx)                      │  Socket.IO
                              ▼                                            ▼
                    ┌───────────────────┐   XREADGROUP      ┌─────────────────────────┐
                    │ Redis Stream      │◄─────────────────►│ NestJS realtime gateway │
                    │ ingest:scans      │                   │ (Redis adapter, already │
                    │ ingest:sync-batch │                   │  cross-instance)        │
                    └─────────┬─────────┘                   └─────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Batch worker       │  BullMQ / same process consumer
                    │ ordered micro-batch│  per-session advisory lock
                    │ INSERT ... SKIP LK │  once per batch, not per row
                    └─────────┬──────────┘
                              ▼
                        PostgreSQL (schema unchanged)
```

### 1.2 Lifecycle of one scan (gateway path)

1. **Device → proxy.** Unchanged. All three clients already send `POST {base}/attendance/scan` with `base = …/api`.
2. **Proxy → ingest.** Path rule (§1.3). Timeouts at the proxy stay ≥ 10 s so a queue-backpressure `503` is produced by ingest, not by a proxy reset.
3. **Ingest — synchronous, in-memory, no Postgres:**
   - Authenticate the *device session* (§3.2) — one Redis read, not a Prisma round-trip.
   - Load **authoritative session snapshot** (activation state, mode, geofence, checkpoint tokens, PIN hash, teacher public key) — one Redis read.
   - Validate using `@polycheck/shared`: `verifyQRToken`, `isTokenInValidityWindow`, `decodeTokenPayload`, `haversineDistance`, meeting-PIN verifier, plus the risk-signal assembly that mirrors `scan-validator.service.ts`.
   - Resolve the status matrix (present / late / incomplete / disputed / absent) with the same rules as `resolution.ts`.
4. **Respond 2xx immediately** with the same body shape NestJS returns (§6.2), carrying `status`, `reason`, `message`, `recordId` and `syncState`.
5. **XADD** the validated work item to `ingest:scans` with an idempotency key (`token+studentId` first-arrival-wins, matching the documented reject-on-duplicate contract).
6. **Worker drains** in ordered micro-batches (§5), preserving the hash chain under one advisory lock per batch instead of per row.
7. **Realtime.** NestJS keeps emitting `attendance:updated` / `attendance:anomaly` to the cockpit. The gateway publishes the *same events* through Redis Pub/Sub (§5.4) so no client learns that a different process handled the write.

### 1.3 Reverse-proxy routing rules (zero client change)

All three clients build URLs as `BASE_URL + path` with `BASE_URL` ending in `/api` (verified: `frontend/src/lib/api-config.ts`, `android/services/api-config.ts`, `polycheck_mobile/lib/src/core/network/api_config.dart` `PUP_API_BASE_URL` default `…/api`). Therefore **path routing is sufficient** and no client contract, env var or build flag changes.

**Prefix rules evaluated in order (most specific first):**

| Rule | Target | Rationale |
|---|---|---|
| `PathPrefix(/api/attendance/scan)` | ingest | hot path |
| `PathPrefix(/api/attendance/check)` | ingest | same validator, online-mode submission |
| `PathPrefix(/api/sync/attendance)` | ingest | offline batches + receipt polling |
| `PathPrefix(/api/health)` | ingest | clock probes at burst scale |
| `PathPrefix(/api/attendance/attempts)` `POST` only | ingest | telemetry (see §0 decision) |
| everything else `/api/*` | backend | unchanged |

Notes.

- `/api/attendance` is a **catch-all prefix family** (list, page, summaries, report, attempts, at-risk, excuses…). Routing the *whole* prefix to ingest would silently break a dozen control-plane reads. Only the two exact write paths (`scan`, `check`) are routed; use exact-path matching, not prefix, for attendance.
- Coolify currently exposes `backend` with `coolify.port=4000` and no Traefik labels in-repo (`docker-compose.coolify.yml` verified). Traefik in Coolify is usually instance-managed; the plan therefore specifies **labels for both services** so the generated router rules are explicit and survive regeneration, and documents the required `--providers.docker` label namespace as an ops prerequisite rather than inventing in-repo infra.
- Local compose has **no proxy** (`docker-compose.local.yml` verified — frontend/backend expose ports directly). For local runs, add a `gateway` service plus an optional `traefik` service behind a `profiles: [proxy]` flag so local dev is opt-in.

### 1.4 What MUST stay 100 % in NestJS

Anything touching identity, money-shaped data, or the document/exports surface stays put. This list is exhaustive by intent — the gateway gets **nothing else**:

- **Auth/Better Auth** — cookie + mobile-bearer issuance, session policy, device binding, cooldown, key provisioning/revocation.
- **Sections, Subjects, Enrollments** — CRUD, enrollment codes, bulk import, tombstones.
- **Session CRUD + activation** — `POST /sessions`, `bulk`, `activate`, `end` remain control-plane (the gateway only *reads* their snapshots).
- **Disputes** (incl. resolve + timeline), **Excuses** (incl. decision), **At-risk + CHED referrals**.
- **Docs exports** — master list, class record, session attendance, DPO summary.
- **AI assistant** (excluded from load testing by decision, and out of scope here).
- **Institution settings, maintenance mode, notifications, system reports, audit log + ledger verify, user governance.**
- **Realtime gateway** — stays in NestJS; ingest only publishes events (§5.4).
- **Reports/dashboards, dashboards, server status, metrics.**

**Rationale:** every one of those endpoints is low-QPS, heavily authorisation-scoped, and coupled to Prisma relations that the gateway would have to duplicate. Moving them buys nothing and risks drift.

---

## 2. Non-Breaking Coexistence & Fallback Strategy

### 2.1 Contract source of truth

- **Zod schemas:** `@polycheck/shared/validation` is already a real export path (`shared/package.json` verified; fixed during the system-reports wave). Ingest validates requests with **the same schemas NestJS uses**, imported directly — no parallel type definitions, ever.
- **Token + crypto:** `@polycheck/shared/utils` exports `verifyQRToken`, `decodeTokenPayload`, `isTokenInValidityWindow`, `createQRTokenData`, `haversineDistance` and the PIN-hash helpers (`shared/src/utils/index.ts` verified). The Ed25519 verify lives in `tweetnacl`, already a shared dependency.
- **Ledger math:** `@polycheck/shared/ledger` exports `computeRecordHash`, `generateLedgerSalt`, `ledgerDateOf`, and `LedgerVerifyResult` (`shared/src/utils/ledger.ts:19–33` verified — and the header comment explicitly says the math must never be re-implemented elsewhere). **The worker imports it; the gateway never computes hashes.**
- **Status matrix:** `backend/src/attendance/resolution.ts` is backend-local. To avoid drift it must be **promoted to `@polycheck/shared`** (additive change, existing re-exports keep compiling) or re-exported verbatim by a thin shared wrapper. This is the one shared-package addition the plan requires. Promotion keeps the `resolution.spec.ts` suite authoritative for both processes.
- **Enforcement:** a CI check (`scripts/verify-shared-ingest-contract.mjs`) asserts that ingest imports token/validation/ledger helpers **only** from `@polycheck/shared` and that no ingest source file duplicates any of those symbols (grep for the exported names in `services/ingest/src`, must yield zero definitions).

### 2.2 Database and ledger integrity under batching

The hash chain is append-only and the advisory lock is per-session; both survive batching if the worker keeps three invariants:

1. **One lock acquisition per batch, ordered by arrival.** All rows in a batch belong to one session (the drainer groups by `sessionId`), the lock is taken once, rows are appended in Redis-arrival order (XADD ids are monotonic), and `prevHash` for row *n* is row *n−1*'s `recordHash`.
2. **`computeRecordHash` preimage unchanged:** `prev|studentId|timestampISO|sessionId|salt` — same fields, same canonical encoding, same salt generation. The shared helper guarantees this.
3. **Fail-closed:** if the batch transaction fails, rows are retried from the stream (at-least-once) and duplicate suppression is idempotent at the DB layer (`skipDuplicates` / unique `(sessionId, studentId)` token constraint), so a retried row can never fork the chain. `ledger/verify` remains the authority and needs no change.
4. **Timestamp preservation:** the DD-era bug (resolution rewriting `timestamp` and silently breaking chains) must not reappear — the worker writes `timestamp` exactly once from the validated scan and never updates it later.

### 2.3 PostgreSQL pooling

- The worker opens its **own** pool sized for batch parallelism (default `connection_limit=8`), **separate** from NestJS's pool. Two processes sharing one Postgres is fine (PG handles this); sharing one Prisma pool object is not possible across processes anyway.
- Production: PgBouncer in front of both (transaction pooling), ingest worker pool via PgBouncer too. This is the honest prerequisite for LT4/LT5 staging numbers and is already noted as blocked-on-staging.
- The gateway request path **never opens a DB connection**. If it needs one (rare re-hydration after Redis loss), it degrades to `503 backpressure` instead (§4).

### 2.4 Fail-safe: transparent fallback to NestJS

Layered, so a partial failure degrades instead of outage:

1. **Shadow mode first (Phase 4 default).** The proxy sends **mirror traffic** to ingest (async fire-and-forget from the edge or a 5 % canary) while NestJS still serves 100 % of requests. Parity is measured, not assumed. Nothing user-visible changes.
2. **Canary by percentage.** Proxy `weighted` split (e.g. 5 → 25 → 100 %) on the scan path only.
3. **Circuit breaker at the proxy.** If ingest's `/health/ready` reports `degraded` (Redis down, worker lag > threshold, drain age > N seconds), Traefik's health-check-based routing stops sending new traffic to ingest; existing connections drain. Because the rules are path-scoped, failure of ingest costs **only the four hot paths**, and control-plane endpoints never notice.
4. **Client-side resilience already exists and must not regress:** the Flutter/RN sync engine drains from the encrypted local queue with exponential backoff; the web offline path queues in IndexedDB; terminal evidence is retained. A 503 from ingest during failover is *retryable* by design (4xx/429 are terminal, 503 is not — verified behaviour in `classifyAttendanceSyncError`).
5. **Data safety during failover:** buffered-but-not-yet-committed rows live in the Redis stream with consumer-group acks. If ingest dies, **NestJS's own `/attendance/scan` path** resumes serving; the stream is drained by a **fallback worker embedded in NestJS** (small BullMQ consumer, off by default) so buffered scans are not stranded. Redis persistence (AOF already required by the compose stack) is what makes this survivable.
6. **Kill switch:** `INGEST_ENABLED=false` env at the proxy level (a single Traefik rule toggle) reverts 100 % to NestJS with no redeploy. Documented as the operational rollback.

---

## 3. Scoped Responsibilities (Strict Boundary)

### 3.1 Gateway owns (exact, no scope creep)

| Endpoint | Method | Notes |
|---|---|---|
| `/attendance/scan` | POST | live in-person + online scans; full hybrid validation |
| `/attendance/check` | POST | same validator, second submission channel |
| `/sync/attendance/batches` | POST | ≤100 records, receipt idempotency |
| `/sync/attendance/batches/:receiptId` | GET | receipt polling (reads stream state, not DB) |
| `/health` (+ `/health/ready`, `/health/clock` alias) | GET | clock sync at burst scale |
| `/attendance/attempts` (write only) | POST | GPS-anomaly telemetry (only if the POST route is added to NestJS; otherwise this row is dropped) |

Everything above is **read-only with respect to the DB in the request path** — the DB write happens in the worker.

### 3.2 Authentication strategy (the hardest design decision)

NestJS currently authenticates via `SessionAuthenticator` → Better Auth `getSession` → **Prisma** (verified). The gateway cannot afford a DB round-trip per scan.

Chosen approach — **session cache with server-authoritative invalidation**:

1. On login and on every security revocation, NestJS already emits events (`auth:session-replaced`, `auth.key-revoked`, `system.maintenance_changed`). The gateway subscribes to the same Redis channels NestJS publishes to and maintains an in-memory **session → user-role/scopes/cache** table (TTL 15 min, refreshed on miss).
2. Cache miss ⇒ gateway calls NestJS `GET /auth/me` **once** per session (bounded, e.g. ≤5 concurrent), populates the cache, proceeds.
3. Any `auth:*` invalidation event evicts immediately, so revocation stays authoritative — a revoked session can never keep scanning for 15 minutes.
4. **Privacy consent** (`@RequiresPrivacyConsent()` on both scan endpoints) is part of the cached user record, so the gate is preserved exactly.
5. **Rate limits** (scan-per-student/device, login IP) move to ingest for the routed paths, implemented on the same Redis keys so the NestJS-side limiter for non-routed paths is unaffected. Same limits, same windows, same key names → no behaviour drift when traffic moves.

Rejected alternatives: sharing the Better Auth adapter directly (couples ingest to Nest internals), JWT re-issuance (changes the client contract — forbidden by the brief).

### 3.3 Session snapshot source

`active-session:<id>` already exists in Redis, written by NestJS activation/end/rotation paths (verified in `scan-validator.service.ts:118–127`, including the documented "Postgres always overwrites cached state" rule). The gateway consumes the **same key** and additionally caches the teacher **public key** (needed for `verifyQRToken`) under `teacher-key:<id>` — the same key NestJS already caches for activation. NestJS remains the writer; the gateway is a pure reader. This is what makes schema drift structurally impossible for the scan decision.

---

## 4. Non-Functional Targets

| Property | Target | How measured |
|---|---|---|
| Scan p95 (gateway path, paced 2.22/s) | ≤ 100 ms | k6, existing harness |
| Scan p99 under 2,000-instant burst | ≤ 500 ms | k6 burst shape, `performance/mixed-load.js` unchanged |
| Scan *accepted* rate under 2,000-instant burst | ≥ 95 % (was 10.3 %) | k6 + DB integrity check |
| Proof upload concurrent with scans | zero measurable scan-p95 degradation | A/B k6 with and without 20 concurrent uploads |
| Queue drain lag (p95) | ≤ 2 s from 2xx to row visible | worker metric + `AttendanceRecord.createdAt` delta |
| Redis stream memory | bounded, ≤ 200 MB under burst | `XLEN` + `MEMORY USAGE` alarms |
| Contract parity | 100 % of existing NestJS attendance/sync tests green; new parity suite equal-count green | CI |

Non-goals: changing the offline contract, changing the client, changing the DB schema, changing the Socket.IO events.

---

## 5. Worker, Queue, and Realtime Design

### 5.1 Redis Streams over BullMQ for the buffer

- **Why Streams:** consumer groups give at-least-once with explicit ack, XADD is O(1) and monotonic-order, `XREADGROUP` with `BLOCK` gives the worker a cheap poll, and **`MINID`-based trimming with pending-entry-list (PEL) safety** prevents unbounded growth during a burst (the Redis AOF-corruption incident in the repo's history makes durability here non-negotiable).
- **Streams:** `ingest:scans` (validated scans), `ingest:sync` (offline batches, which may contain up to 100 records each and are drained as whole batches to preserve receipt semantics).
- **BullMQ stays for NestJS** (imports, users-import, proof resize). The drainer is a **BullMQ job that wraps a stream consumer** so ops keeps one dashboard: the stream is the buffer, BullMQ is the scheduler/backoff/visibility.
- **Backpressure:** if `XLEN > INGEST_MAX_BUFFER` (default 50 k) or the oldest unacked message is older than `INGEST_MAX_LAG` (default 30 s), the gateway returns `503 { code: 'ingest_backpressure', retryAfterSeconds }`. This is *retryable* by the existing client classification, so a full buffer degrades to "scan again in a few seconds" instead of losing data.

### 5.2 Ordered micro-batch drainer

- Consumer group `ingest-workers`, one worker process (or N with a per-session sticky assignment via `XCLAIM`/consumer name hashing on `sessionId`).
- Batch = up to 200 stream entries **or** 30 ms window, whichever first, grouped by `sessionId`; a batch is committed per session, one advisory lock acquisition per batch (§2.2).
- Idempotency at the DB: `INSERT … ON CONFLICT DO NOTHING` keyed on the existing `(sessionId, studentId, token)` uniqueness; duplicates are acknowledged without a second insert.
- Receipts: `GET /sync/attendance/batches/:receiptId` reads **worker state**, not Postgres — the worker publishes receipt state to Redis (`receipt:<id>` with TTL) so polling stays O(1) and does not hit the DB. NestJS's existing receipt route keeps working for non-routed traffic.
- **Disputes, PIN-lock counters, and manual overrides stay in NestJS.** The gateway never mutates dispute state; if validation marks a scan `disputed`, the worker writes it with the same `disputeReason`/`disputePreviousStatus` semantics NestJS uses (verified: `20261112120000_dispute_previous_status` migration), so teacher tooling is unaffected.

### 5.3 Realtime events without ownership change

NestJS's `AttendanceGateway` owns the Socket.IO rooms. Ingest publishes **the same event payloads** to Redis Pub/Sub channels that a tiny NestJS-side relay subscribes to and re-emits through the existing gateway (`attendance:updated`, `attendance:anomaly`, `session:finale` when the worker resolves a session end). Payload shapes are the existing exported types (`AttendanceAnomalyEvent` etc.), so the web cockpit, kiosk, radar and Flutter realtime paths need zero changes. This is the same pattern the codebase already uses cross-instance via the Redis IO adapter.

### 5.4 Clock endpoint semantics

Clients do not call `/health/clock`; they call `/health` and compute the offset from `timestamp` using the request midpoint (`api-client.ts:731–735`, `polycheck_mobile/trusted_clock.dart`). Therefore:

- Ingest serves `/health` with **byte-identical semantics** (`{ status, timestamp, checks }`), with `checks` reduced to what ingest can honestly attest (redis, worker, buffer age) — the readiness gate for Traefik is a *separate* ingest `/health/ready`, not the client-facing `/health`.
- `/health/clock` is added as an alias returning `{ timestamp }` only, for future clients that want a smaller payload. **No client changes in this plan.**
- NestJS keeps serving `/health` for every non-routed path; because the proxy routes `/api/health` to ingest, NestJS's own health page remains reachable for ops via the internal port or an explicit ops route.

---

## 6. Contracts

### 6.1 Endpoint parity table

| Concern | NestJS today | Gateway must match |
|---|---|---|
| Auth | Better Auth cookie/bearer via `SessionAuthenticator` | cached session + invalidation events, same 401/403 semantics |
| Privacy consent | `@RequiresPrivacyConsent()` | same gate from cached user |
| Rate limits | `LOGIN_IP_RATE_LIMIT`, `API_RATE_LIMIT`, scan limiter | same limits, same Redis keys |
| Validation | Zod from `@polycheck/shared/validation` | same import, same messages |
| Hybrid mode | mode/checkpoint/PIN/zero-GPS | identical (§1.2 step 3) |
| Status matrix | `resolution.ts` | promoted to shared, consumed by both |
| Response body | `{ status, reason, message, recordId, syncState, … }` | identical field-for-field |
| Errors | `AllExceptionsFilter` shape incl. `code`, `remainingMinutes` | same error envelope |
| Sync receipt | `{ results: [...] }`, idempotent replay | identical, served from stream state |

### 6.2 New/changed surfaces (additive only)

- `GET /health/clock` — new alias (no client uses it yet).
- `POST /attendance/attempts` — **only if** the telemetry write is added to NestJS's controller as well (so the read path keeps working). The plan does not require it; listed here for completeness and flagged as optional Phase-2 scope.
- Everything else: no new fields, no renamed fields, no new auth headers.

---

## 7. Directory Structure & Infrastructure

### 7.1 Package layout

```
services/ingest/
├── package.json               # @polycheck/ingest, workspace member
├── tsconfig.json              # moduleResolution: bundler, strict
├── vitest.config.ts
├── src/
│   ├── index.ts               # bootstrap (fastify, plugins, graceful shutdown)
│   ├── config.ts              # env validation (zod, mirrors backend style)
│   ├── app/
│   │   ├── routes/scan.ts
│   │   ├── routes/sync.ts
│   │   ├── routes/health.ts
│   │   ├── plugins/auth-cache.ts
│   │   ├── plugins/session-snapshot.ts
│   │   ├── plugins/rate-limit.ts
│   │   └── plugins/backpressure.ts
│   ├── core/
│   │   ├── validate-scan.ts   # pure, mirrors scan-validator gates, shared imports only
│   │   ├── validate-batch.ts
│   │   ├── status-matrix.ts   # re-export from shared after promotion
│   │   └── errors.ts
│   ├── queue/
│   │   ├── streams.ts         # XADD / consumer-group plumbing
│   │   ├── drainer.ts         # batch worker
│   │   ├── receipts.ts
│   │   └── realtime-relay.ts  # publishes control-plane events
│   └── observability/
│       ├── metrics.ts         # Prometheus, same naming convention as NestJS
│       └── logger.ts          # pino, same field conventions
└── test/                      # parity suites (§8)
```

Alternative location `apps/ingest` rejected: `apps/` does not exist in this repo and `services/` reads better next to a future `services/worker`. `pnpm-workspace.yaml` gains one line (`- "services/ingest"`), and `turbo.json` gains an `ingest` build/lint/test task keyed on `^build` so `@polycheck/shared` builds first (the existing `pnpm-workspace.yaml` already lists `shared` first, and `build-shared-if-available.mjs` already guards the postinstall path).

### 7.2 Docker / compose additions

**`docker-compose.coolify.yml`** — new service `ingest` mirroring `backend`'s shape:

- Same network, depends on `postgres` (healthy) and `redis` (healthy) **only** for startup ordering — it must not require Postgres at boot, since the request path is DB-free.
- Env: `REDIS_URL`, `DATABASE_URL` (worker only), `INGEST_PORT=4001`, `INGEST_MAX_BUFFER`, `INGEST_MAX_LAG`, `UV_THREADPOOL_SIZE=16` (bcrypt is not used here, but consistency costs nothing), `SHARED_INGEST_CONTRACT=1`.
- Labels: `coolify.port=4001`, plus explicit Traefik router labels for the four scoped paths (§1.3) with `entryPoint=https` and the same TLS resolver the backend uses, and `traefik.http.services.ingest.loadbalancer.healthcheck.path=/health/ready`.
- **No volume mounts** (no uploads here — proofs stay in NestJS).
- Healthcheck: `wget -qO- http://127.0.0.1:4001/health/ready`.

**`docker-compose.local.yml`** — same service behind `profiles: [gateway]`, plus an optional `traefik` service with the same labels so local path routing can be exercised; without the profile, nothing changes for local dev and all traffic still hits NestJS (this is the Phase-1 default and the rollback default).

**Redis config** — stream keys are plain Redis keys; nothing new for Redis itself except documenting `stream-node-max-bytes` so trimming is server-side bounded, and confirming AOF `everysec` (already the repo default) is sufficient for at-least-once.

### 7.3 Observability

- Ingest exposes `/metrics` (Prometheus) with the **same metric names** as NestJS's `MetricsService` for the shared signals (event-loop lag, HTTP durations) plus `ingest_buffer_depth`, `ingest_drain_lag_seconds`, `ingest_batch_size`, `ingest_validate_duration_ms`.
- Super-admin **Server Status** (SA7) currently reads `GET /dashboard/server-status` from NestJS. Plan: the ingest gauges are scraped by NestJS (or by Prometheus if present) and surfaced as an additional section; no change to the existing SA7 contract, additive only.

---

## 8. Phased Roadmap & Rollout Gate

Each phase ends with a **gate** — an explicit, checkable condition — and no phase starts before the previous gate is green.

### Phase 1 — Scaffolding & shared linking (no behaviour change)
- Workspace entry, package skeleton, tsup/vitest, lint/format parity with backend, Dockerfile (`node:22-alpine`, multi-stage, `--ignore-scripts` like backend, **musl-safe deps only** — the `@node-rs/bcrypt` lesson applies here: prefer packages that ship N-API binaries, avoid anything needing a postinstall).
- `Dockerfile.ingest` + compose service behind the `gateway` profile (local) and as a second Coolify app (prod), initially **not** wired to any traffic.
- Shared-contract enforcement script (§2.1).
- **Gate:** `pnpm build` + `pnpm lint` clean; `docker compose --profile gateway config` renders; ingest `/health/ready` returns `ok` with Redis only; existing suites untouched and green.

### Phase 2 — In-memory validation + Redis buffering (shadow mode)
- Port the validator as a **pure function** with tests derived from `scan-validator.service.spec.ts` (same fixtures, same gates in the same order).
- Snapshot reader (`active-session:*`, `teacher-key:*`), auth cache with invalidation, rate limiter, backpressure.
- XADD accepted work; **no DB writes**. `/health/ready` reports `degraded` while the drainer is absent.
- **Gate (parity suite, see §9):** for every case in the NestJS attendance spec corpus, ingest returns the same status/reason/message bytes as NestJS when both are pointed at the same fixture DB snapshot. Any divergence blocks Phase 3.

### Phase 3 — Micro-batch drainer (dual-write behind a flag)
- Drainer with consumer groups, per-session grouping, one advisory lock per batch, shared-ledger hash math, receipt state in Redis.
- **Runs against a staging-copy DB first**, then local, always with `INGEST_ENABLED=false` at the proxy (traffic still 100 % NestJS) until parity is re-proven with real writes.
- **Gate:** DB integrity check reports `accepted/submitted == 100 %` and zero unexpected disputes across 10k synthetic scans replayed from the recorded fixture; `ledger/verify` returns `verified` on the written range; NestJS suites still 85/85 green.

### Phase 4 — Path routing (canary → 100 %)
- Traefik labels live; **shadow mode first** (mirror, 0 % user traffic), then 5/25/50/100 % canary with automated rollback on (a) p95 > 300 ms for 2 min, (b) success < 99.5 %, (c) drain lag > 5 s.
- **Gate:** 24 h at 100 % with zero rollback triggers; k6 paced + burst suites re-run against the *routed* stack and beat the NestJS baseline (Addendum 2 numbers are the baseline to beat: burst success ≥ 95 % vs 10.3 %).

### Phase 5 — Verification, load benchmarking, and NestJS-parity sign-off
- Re-run the full performance harness (`mixed-load` paced + burst, `login-load`, `service-matrix`) with ingest routed; record deltas in the load plan addendum.
- Run the **5,000-user LT4/LT5 staging simulation** the plan has been blocked on, now meaningful because the data plane no longer shares a process with the control plane.
- **Gate (final):** all existing suites green — backend 85 suites, web 76, Flutter 64 — plus the new ingest parity suite; documented comparison table in `documentation/LOAD_TESTING.md`; rollback runbook in `documentation/`.

**Deliberately not a phase:** moving `GET /attendance/attempts` reads, receipts DB reads, or any control-plane read into ingest. Those stay in NestJS until a *measured* need appears; the brief's instinct is right that reads at burst scale are the next candidate, but they are also the safest thing to leave alone.

---

## 9. Test Compatibility Guarantee (the hard requirement)

| Suite | Current | How the plan protects it |
|---|---|---|
| Backend | 85 suites, 1063 tests | **Zero backend file changes** except: (a) promote `resolution.ts` → shared (re-export keeps imports compiling), (b) optional additive `POST /attendance/attempts` route, (c) the fallback drainer consumer behind `INGEST_FALLBACK_DRAIN=false`. Every existing spec runs unchanged; `tsc --noEmit`, `lint:check`, `format:check` remain gates. |
| Web | 76 suites | No client change at all. Contract tests that assert exact request bodies (`enrollStudent`, scan payloads, etc.) are untouched because the URLs and payloads are identical. |
| Flutter | 64 suites | No client change. `PUP_API_BASE_URL` semantics unchanged; the trusted-clock `/health` midpoint math is preserved because ingest's `/health` returns the same shape. |
| Ingest (new) | new | Parity suite: replays the NestJS attendance spec corpus as golden request/response pairs against a fixture DB; runs in CI beside the backend suite. |

**Parity harness detail (the mechanism that makes "100 % compatible" checkable rather than promised):** a `parity/` directory holds recorded request/response pairs generated by running the existing NestJS e2e against a seeded DB (the same seeded stack used for the load campaign). The parity test boots ingest, replays every pair, and diffs responses **byte-for-byte after normalising timestamps/ids**. Any diff fails CI with the divergent field named. This is the same technique the models-contract test already uses in `polycheck_mobile` (recorded backend serializer snapshots), so the concept is proven in-repo.

---

## 10. Risk Assessment & Mitigation Matrix

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Schema drift** between ingest and NestJS | Med | High — silent mis-validation of scans | Single source: shared Zod + shared token/ledger helpers; CI grep-enforces no duplicated symbols; parity suite diffs every response |
| R2 | **Redis failure / failover** | Med | High — buffer lost or duplicated | AOF `everysec`; consumer-group PEL so unacked entries are redelivered; on Redis loss ingest returns `503 backpressure` (retryable) rather than accepting-and-losing; NestJS fallback drainer drains the stream if ingest is down |
| R3 | **Duplicate sync collisions** on replay | High | Med — duplicate rows or false disputes | Existing first-arrival-wins preserved: idempotency key `token+studentId`, DB-level `ON CONFLICT DO NOTHING`, receipt state in Redis; the batch replay path already classifies `already submitted` as success (verified in `runSync`) |
| R4 | **Clock drift** between ingest and devices | Low | High — wrong present/late/incomplete | Ingest is stateless w.r.t. time: every decision re-derives from the signed `issuedAt` in the token + the session snapshot's validity window, exactly like NestJS; no local wall-clock decisions |
| R5 | **Database lockout** (pool exhaustion by the drainer) | Med | High — control-plane starves | Separate pools; worker `connection_limit=8`; PgBouncer transaction pooling; the request path holds **zero** connections; alarms on pool wait time |
| R6 | **Ledger chain fork / corruption** during batching | Low | Critical — integrity guarantee broken | One advisory lock per batch; rows ordered by Redis arrival id; shared `computeRecordHash` only; post-batch `ledger/verify` on a sampled range in CI; timestamp written exactly once |
| R7 | **Auth cache staleness** (revoked session keeps scanning) | Low | High — security | Event-driven eviction on the same channels NestJS publishes; short TTL as backstop; security revocations (`authVersion` bump) always publish |
| R8 | **Rate-limit drift** when traffic moves | Med | Med — either throttle spike or under-protection | Same Redis keys/windows as NestJS; move the key namespace *with* the route, documented in a table; load-verified before 100 % |
| R9 | **Partial rollout asymmetry** (some scans via ingest, some via NestJS) | High during canary | Med — duplicate/race between two writers for the same session | Canary is **per-path**, and both writers are idempotent on the same uniqueness key; the advisory lock serialises them; receipts come from Redis state so a row written by either path is visible to both |
| R10 | **Realtime event duplication/loss** | Med | Low-Med — cockpit glitches | Pub/Sub relay is additive; events carry the same ids; cockpit already dedupes by `recordId`/`studentId`; no new event types |
| R11 | **Ingest itself becomes the bottleneck** (new SPOF) | Med | High | Bounded buffer + backpressure; stateless (scale horizontally — safe *after* R6's per-batch lock because different sessions don't contend); the proxy circuit breaker is the operational escape hatch |
| R12 | **Proof uploads still on the hot loop** (out of scope for ingest) | High today | Med — scans stall behind uploads | Out of gateway scope by design (§1.4); tracked as the separate follow-up it deserves (presigned S3 upload or multipart + client downscale). **This plan does not fix the upload stall; it must not be claimed to.** |
| R13 | **Ops complexity** (two runtimes, two Dockerfiles) | Certain | Med | Same base image, same env-validation style, same lint/format/test tooling; one `pnpm` script surface; documented runbook; the gateway profile is opt-in locally |
| R14 | **CI/budget creep** (new service = new gates) | Certain | Low | Ingest suite is small by construction (pure functions + integration tests against testcontainers); added to the existing `pnpm verify` pipeline rather than a new one |

---

## 11. Open Questions (decisions needed before Phase 1)

1. **`POST /attendance/attempts`** — is the telemetry write in scope? It requires an additive NestJS route so reads keep working. Default: **defer**, the GET read stays NestJS-only.
2. **Where does `resolution.ts` live?** Promote to `@polycheck/shared` (recommended; one additive re-export, `resolution.spec.ts` keeps running) vs. duplicate-and-drift (rejected).
3. **Proof-upload transport** — out of gateway scope, but Phase-5's A/B measurement (§4) will quantify the stall. Presign-to-S3 vs multipart is a separate decision with its own plan; this document only commits to measuring it.
4. **Proxy ownership** — Coolify-managed Traefik vs. an in-repo Traefik service. The compose labels are written to work with either; ops confirms which exists in the deployed Coolify instance.
5. **Session-snapshot ownership** — today NestJS writes `active-session:*` and `teacher-key:*`. Confirm no background job prunes those keys with a TTL shorter than the gateway's cache TTL (verified the keys exist; TTL policy needs one ops check).

---

## 12. What This Plan Deliberately Does Not Do

- Does **not** change any client, any client env var, or any client contract.
- Does **not** change the database schema, the hash-chain preimage, or `ledger/verify`.
- Does **not** move auth, disputes, exports, AI, settings, or any read endpoint.
- Does **not** fix the proof-upload event-loop stall (separate follow-up; measured, not claimed).
- Does **not** replace BullMQ in NestJS, and does not remove NestJS's own scan path — that path is the fallback.

---

*End of plan. Next action when approved: Phase 1 scaffolding PR (workspace entry + Dockerfile + health route + contract-enforcement script), sized to be reviewable in one sitting and touch nothing else.*

---

## 13. Execution Log — Phases 1–3 landed (2026-11-13)

Implemented in this repo. Phase 4 (edge routing) and Phase 5 (staging benchmark) remain, because both need an environment this workstation does not have.

### Delivered

| Area | Files |
|---|---|
| Scaffold | `services/ingest/package.json`, `tsconfig.json`, `vitest.config.ts` |
| Config (zod-validated, bounded) | `services/ingest/src/config.ts` |
| **Pure scan validator** (port of the NestJS gate order) | `services/ingest/src/core/scan.ts` |
| HTTP surface (`/attendance/scan`, `/attendance/check`, `/sync/attendance/batches`, receipt, health/clock/ready) | `services/ingest/src/http.ts` |
| Redis Streams buffer + micro-batch drainer | `services/ingest/src/queue.ts` |
| Authoritative Postgres writer (advisory lock per batch, shared hash math) | `services/ingest/src/writer.ts` |
| Bootstrap (auth cache, snapshot reader, PIN limiter, drainer loop) | `services/ingest/src/index.ts` |
| Tests | `services/ingest/test/{scan,queue,http,snapshot}.test.ts` — **36 passing** |
| Image | `Dockerfile.ingest` (multi-stage, alpine, `--ignore-scripts`, non-root, tini) |
| Compose | `docker-compose.local.yml` (`profiles: [gateway]`, default run unchanged), `docker-compose.coolify.yml` (path rules documented as ops config) |
| CI gate | `scripts/verify-shared-ingest-contract.mjs` + two steps in `.github/workflows/ci.yml` |
| Workspace | `pnpm-workspace.yaml` + regenerated `pnpm-lock.yaml` |

### Deviations from the plan (and why)

1. **No Prisma in the gateway — raw `pg`.** The drainer needs one advisory lock, four lookups and one insert. Prisma 7's `prisma-client` generator emits TypeScript, which would have forced the generated client into `tsc`'s program (slow, and a build coupling between the two services). Raw parameterised SQL removes the ORM, the second generated client, and that coupling. The **schema is unchanged**; `@@unique([sessionId, studentId])` gives the idempotency the plan required.
2. **`POST /attendance/attempts` not implemented.** As flagged in §0, that route does not exist in the contract — `/attendance/attempts` is a **GET** read (radar/timeline). Attempt telemetry stays emitted from the existing scan path; adding a POST requires an additive NestJS route and is deferred.
3. **`GET /health/clock` is an alias, `/health` is the real path.** No client calls `/health/clock`; all three read `/health.timestamp` and compute the offset from the request midpoint. `/health` is served with identical semantics, so the trusted-clock math is unchanged.
4. **No Traefik labels.** This repo's Coolify compose uses only `coolify.managed` / `coolify.port`; Coolify generates the router. Inventing label keys would have duplicated or conflicted with that, so the four path rules are documented in the compose comment as an ops step instead.

### Two correctness details worth remembering

- **The key is re-verified at commit, not trusted from cache.** `scan.ts` validates against the cached teacher key to stay fast; `writer.ts` re-reads `teacherPublicKey` from the database inside the batch and, on failure, persists the row as `disputed / invalid_signature` rather than dropping it. That preserves the NestJS invariant ("the database key is authoritative on every scan") while keeping Postgres off the request path.
- **Dispute columns are only written for disputed rows.** An accepted record must not carry `disputeReason`, or the teacher dispute rail would show phantom entries.

### Verification

- `pnpm --filter @polycheck/ingest test` → **36/36** (in-person parity, offline replay, online dual-checkpoint + PIN incl. lockout, drainer grouping/ack/malformed/failure-redelivery, HTTP contract incl. 401/403/consent/400/503 paths, and the snapshot key contract).
- `pnpm --filter @polycheck/ingest typecheck` and `build` → clean.
- `node scripts/verify-shared-ingest-contract.mjs` → `OK (7 files, 6 shared imports)`.
- `docker compose config`: default local run lists **no** ingest service; `--profile gateway` adds it; Coolify lists it.
- Backend suite re-run: see below.

### Not done (honest list)

- Phase 4 edge routing: needs the deployed proxy; the compose comment specifies the exact rules.
- Phase 5 load benchmark and 5,000-user staging run: needs staging hardware.
- The NestJS fallback drainer (`INGEST_FALLBACK_DRAIN`) — a buffered-stream consumer inside Nest — is **not** implemented. Until it is, "ingest down + entries still buffered" means those entries wait for ingest to return, they are not drained by the control plane. The client-side queue still retains terminal evidence, so nothing is lost at the device.
- Proof-upload transport (the 6.8 MB base64 JSON parse) is untouched by design; it remains a separate follow-up.

### 13.1 Constraint closure (same day)

Every gap listed in §13's "Not done" and every deviation flagged above has been closed or explicitly parked. Details:

**C1 — Redis key contract was wrong (real defect, fixed).**
`RedisService.key()` prefixes every control-plane key with `polycheck:`. The gateway was reading `active-session:<id>` and a `teacher-key:<id>` that never existed, so `readSnapshot` would always miss and every scan would have answered `503`. Two corrections:
- The gateway now reads `polycheck:active-session:<id>`, and takes the teacher key from **inside that same blob** — the activation publish already stores `{ ...session, teacherPublicKey }`, so one read replaces two and there is no second cache to drift.
- The auth cache moved to `polycheck:ingest:auth:<hash>`, and the stream key default to `polycheck:ingest:scans`, so both processes address the same values.

**C2 — Control-plane fallback drainer implemented** (`backend/src/attendance/ingest-fallback.service.ts`).
Opt-in via `INGEST_FALLBACK_DRAIN=true` (wired into both compose files, default `false`). It:
- joins the **same** consumer group as the gateway and auto-claims entries idle > 30 s (`XAUTOCLAIM`), so a crash mid-batch is recoverable instead of stranded;
- replays each entry through the **normal** `AttendanceService.scan` / `syncScan`, so validation, ledger chaining, disputes, realtime fan-out and notifications behave exactly as if the request had arrived at the control plane — no duplicated write logic;
- acknowledges terminal decisions and leaves retryable ones pending;
- never keeps the process alive (`timer.unref()`).

Supporting additions to `RedisService`: `streamEnsureGroup`, `streamReadGroup`, `streamAck`, `streamAutoClaim`. These take **full** keys deliberately (documented in the code) because the gateway already applies the prefix; double-prefixing would silently address a different stream.

**C3 — Advisory-lock critical section shortened.**
The writer previously did session + teacher-key + student-name lookups *inside* the lock. Those reads do not depend on chain order, so they now happen before `pg_advisory_xact_lock`, leaving only "read head + insert rows" inside. Same one-lock-per-batch guarantee, materially shorter hold time under contention.

**C4 — Phase 4 routing remains an ops step, deliberately.**
This repo's Coolify compose uses only `coolify.managed` / `coolify.port`; Coolify generates the Traefik routers. Inventing label keys would conflict with that generator, so the four path rules stay documented in `docker-compose.coolify.yml` next to the service. Not a code gap — an environment boundary.

**C5 — Phase 5 benchmark remains blocked on staging hardware.** The harness (`performance/mixed-load.js`, `login-load.js`, `service-matrix.js`) already exists and runs against any base URL; what is missing is a deployed stack and the 5,000-user population.

**C6 — Still out of scope by decision, not omission:** `POST /attendance/attempts` (the route is a **GET** in the contract; adding a write needs an additive NestJS route) and the proof-upload transport (base64-in-JSON on the control plane's event loop; a separate multipart/S3 follow-up).

### Verification after C1–C3

- Ingest: `typecheck` + `build` clean, **30/30 tests**.
- Backend: `tsc --noEmit` clean; full suite re-run (85 suites / 1,063 tests).
- `docker compose config` still renders both files with the fallback flag present.

### 13.2 Live end-to-end run against the real stack (2026-11-13)

Run with Docker up: `postgres`, `redis`, `backend` (healthy) plus the gateway on the host, driven by `services/ingest/scripts/e2e-smoke.mjs`. The script creates a session through NestJS, activates it (which publishes the Redis snapshot), signs a token with the fixture's Ed25519 key, scans **through the gateway**, and asserts the row, the chain and the verifier.

**Result: 16/16 checks pass.** `buffered → drained → present + recordHash + salt`, duplicate replay suppressed (1 row), `POST /audit-logs/ledger/verify` → `verified`.

Four real defects surfaced only because this ran against a real database — none were visible to the unit tests:

**E1 — `ON CONFLICT DO NOTHING` silently discarded every scan.**
Activation pre-seeds a `pending` row for all 60 enrolled students. The writer treated that row as a duplicate and skipped the write, so the device received a success and attendance never changed (60 pending, 0 hashed). Fixed with a guarded claim: `UPDATE … WHERE status = 'pending' AND "recordHash" IS NULL`, preserving first-arrival-wins for already-decided rows.

**E2 — the claim rewrote `recordHash` without rewriting `timestamp`.**
The hash preimage includes the timestamp, so a claimed row must store the same instant it hashed. Storing the roster seed's time produced `hash_mismatch` on every claimed row. The claim now writes `timestamp` too (safe — the row had no chain entry yet; the immutability rule applies only after hashing).

**E3 — `AttendanceRecord.timestamp` is `timestamp without time zone`.**
A second writer inherits its own session time zone, so a gateway on a non-UTC host stores a different naive instant and every hash it writes fails verification (observed as a consistent 8-hour offset). `SET LOCAL TIME ZONE` and the pool `options` were both unreliable here because node-postgres serialises a JS `Date` from the **client** clock. Fixed by doing the conversion in SQL — `($n::timestamptz AT TIME ZONE 'UTC')` for `timestamp`, `syncedAt`, `createdAt`, `updatedAt` — which is independent of session and client settings.

**E4 — the drainer was silent.**
`drainOnce` swallowed per-session write failures and the enabled path logged nothing, so a failed batch was indistinguishable from an empty one. Added a start log, per-batch `read/written/acked` telemetry, and a logged session failure.

**Local-testing hazard worth remembering:** a stale `node dist/index.js` from an earlier run held port 4001; every "restart" then failed with `EADDRINUSE` while the E2E silently exercised the **old build**, reproducing the pre-fix symptoms and costing several cycles. The E2E now documents killing prior gateway processes first.

### Verification (post-fix)

- Ingest: `typecheck` + `build` clean, **36/36** unit tests, contract gate `OK (7 files)`.
- Live E2E: **16/16**, including ledger `verified`.
- Backend: **85 suites / 1,063 tests** unchanged.

### 13.3 Deployment hardening (2026-11-13, second wave)

**Scope narrowed for safety.** `/sync/attendance/*` is **not** served by the gateway. The control plane's receipt contract is `{queued, receiptId}` (sha256 job id) with `{state, results}` where each result is the full written `AttendanceRecord` — reproducing that requires the asynchronous drainer to return rows, which is a different design. The gateway now answers **404** on those paths so a misrouted batch fails loudly instead of acking with a receipt the clients cannot parse. `/sync` stays on NestJS.

**E5 — auth upstream failure was mapped to 401 (found by the burst, not by unit tests).**
A cold cache fires one `/auth/me` per student. With unbounded concurrency and a 2 s timeout, most lookups timed out under a 2,000-scan burst and `resolveUser` returned "no user" → **401**. A 401 is terminal for every client (it drops the session), so a transient control-plane blip would have signed out the whole campus. Fixed:
- three outcomes (`{user}` / `null` / `{unavailable}`) — upstream failure is a **503 retryable**, never 401;
- single-flight per token, so N concurrent requests for the same session make one lookup;
- bounded concurrency (`INGEST_AUTH_REFRESH_CONCURRENCY`, default **64**) sized for ~2,000 cold sessions;
- negative results cached 30 s so a rejected token cannot re-storm.

**Burst result (34 sections × 60 students, all concurrent).**
- `ingest_scans_accepted_total = 2000`, `rejected_total = 0`, `drain_failures = 0` — **not one scan was lost**.
- The harness client (one Node process) abandoned 646–780 responses at its own 30 s socket limit, so the *client* was the limiter; per-request latency at that concurrency is still unmeasured and needs k6 (the same instrument that measured the control plane's 10.3 %).
- `ingest_buffer_depth` peaked in the thousands while draining 200 rows per batch with no failures — the drainer keeps up but its steady-state ceiling needs tuning before a sustained burst (increase `INGEST_BATCH_MAX` / consumer count).

**Container proof.** `docker build -f Dockerfile.ingest` succeeds (91 s, multi-stage, non-root, tini). Running that image on the compose network with only env config, the E2E passes **17/17** including ledger `verified` and the 404 sync guard, and `/metrics` serves the Prometheus counters.

**Verification:** ingest **38/38** tests, typecheck + build clean, contract gate OK, backend 85 suites untouched.
