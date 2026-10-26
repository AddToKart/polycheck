# 5,000-User Scale Simulation — Plan

> **Status:** Approved plan, not yet implemented. Companion to
> [`bulk-import-plan.md`](./bulk-import-plan.md) (provisioning reuses the import pipelines)
> and [`super-admin-console-plan.md`](./super-admin-console-plan.md) (SA7 Server Status is a
> live observation surface during the run). Extends the existing k6 harness documented in
> `documentation/LOAD_TESTING.md`.

---

## 1. Goal

Prove (or disprove) that the system handles **5,000 students and ~10–20 professors** doing
realistic work simultaneously: logging in, checking in during a bell rush, replaying offline
evidence, browsing dashboards, and running the super-admin console — with the repo's existing
SLOs met and no silent failures.

**Definition of "handled"** (from `documentation/LOAD_TESTING.md` thresholds, extended):
- Scan/enqueue p95 < 1 s, p99 < 2 s; offline sync confirmation p95 < 30 s, p99 < 60 s
- < 1% failed requests; 100% of configured students accepted (present/late, no disputes)
- Login burst completes within its window at production rate limits (or documented env relaxations)
- No sustained Postgres pool saturation/lock queues, Redis write failures, or BullMQ backlog growth
- Zero backend 5xx besides intentional rejects

## 2. Non-Goals

- No new backend features or schema changes — this is a test harness + execution plan.
- No production traffic; disposable environments/accounts only.
- No OS-level attestation/GPS-spoofing simulation (out of scope; evidence shape stays valid).
- No frontend browser-scale testing (k6 drives the API; UI load is a follow-up if needed).

## 3. Verified Current State (facts)

| Fact | Evidence |
|---|---|
| k6 harness exists: online scan + offline replay modes, smoke (2 VU) and full (1,000 VU) profiles, thresholds, dashboard-reads scenario | `performance/attendance-load.js` |
| Login burst script exists, measured separately from scans, uses production rate limits | `performance/login-load.js` |
| Prepare script provisions dedicated accounts end-to-end (mobile login → consent → enroll → teacher key → session activation) but is **sequential** | `performance/prepare-staging.mjs` |
| Staging workflow runs online/offline/login against `STAGING_BASE_URL` with the `load-testing` environment and 30-day artifact retention | `.github/workflows/staging-load.yml` |
| Full profile hardcodes 1,000 VUs and requires ≥1,000 dedicated student credentials in `LOAD_FIXTURE_JSON` | `attendance-load.js`, `prepare-staging.mjs` |
| Bulk import can create 5,000 students (5,000-row cap, 250-row chunks, BullMQ `users-import`, generated temp passwords, `ImportBatch` + audit) | `plan/bulk-import-plan.md` addendum; `backend/src/users/student-import*` |
| Section enrollment import exists (advisory lock, `studentCount` reconciliation) | `backend/src/sections/enrollment-import.service.ts` |
| Rate limits are env-tunable (login/identity/IP, API, key-provision) | `backend/src/auth/auth.service.ts`, compose env |
| Local compose has Postgres/Redis but **no PgBouncer**; staging doc measures PgBouncer separately | `docker-compose.local.yml`, `documentation/PRODUCTION_READINESS.md` |
| SA7 Server Status page streams event-loop lag, RSS, DB/Redis readiness, BullMQ depth, sockets — a live in-console observation surface | `plan/super-admin-console-plan.md` SA7 |
| Mobile bearer auth (`/auth/mobile/login/*`) is what k6 uses — 5,000 tokens must be prepared before the measured run | `prepare-staging.mjs` |

## 4. Locked Decisions

| # | Decision |
|---|---|
| 1 | **Provision through the real import pipeline** (Flow A + Flow B) — dogfoods import at scale instead of seeding via SQL. Users are created active with server-generated passwords; the credential CSV is retained as a restricted artifact for the token-prep step, never logged. |
| 2 | **Population shape:** 5,000 students · 20 sections (250 students each) · 12 professors (one per section + 2 spares, one extra super admin for console observation). |
| 3 | **Scenario set:** login burst · online bell rush · offline replay storm · concurrent teacher reads · super-admin console reads (admin-overview, filtered `GET /users` pages, Server Status sockets). |
| 4 | **Bell-rush shape:** one activated session per section during the rush; each student scans **once** with a unique `clientAttemptId` (`K6_RUN_ID`-scoped) — matches the real one-QR-many-students model and the per-student scan limiter. |
| 5 | **5,000 VUs are not launched from one k6 process.** Full runs use either 5 × 1,000-VU waves (simple, runner-safe) or a `ramping-vus` profile to 5,000 over 5–10 min (more realistic against a 15-minute QR window). Profile choice is an open decision (§11). |
| 6 | **Staging is the source of truth for capacity numbers.** Local Docker runs are harness-validation smoke only (machine-bound, no PgBouncer, single instance). |
| 7 | **Rate limits during prep:** the token-prep phase uses relaxed `LOGIN_RATE_LIMIT` env on the target env (documented values), while the measured login burst runs at production limits to observe throttling honestly. 429 backoff handling already exists in the prep script and is retained. |
| 8 | **Hygiene:** every run uses a fresh `K6_RUN_ID`; disposable subject/section/session names (`Load <runId>`); tokens only in restricted ephemeral files; artifacts contain summaries, never tokens; dedicated fixture accounts only. |

## 5. Milestones (LT1–LT6)

| ID | Scope | Key files | Acceptance criteria |
|---|---|---|---|
| **LT1 — Harness parameterization** | Add `K6_USER_COUNT` (default keeps smoke=2/full=1,000) to both k6 scripts + prepare script; thresholds derive from it; `ramping-vus` profile option (`K6_RAMP_MINUTES`); fixture generator script producing N distinct student CSV rows in the shared parser's exact column format | `performance/attendance-load.js`, `performance/login-load.js`, `performance/prepare-staging.mjs`, new `performance/generate-fixture.mjs`, `documentation/LOAD_TESTING.md` | `k6 inspect` passes for all profiles; generated CSV round-trips through the shared parser with 0 issues; no behavior change at existing counts |
| **LT2 — Parallelized provisioning** | Speed up `prepare-staging.mjs` with bounded concurrency (≈16 workers) for login/consent/enroll loops; or (preferred) enroll via Flow B import using the LT1 CSV so prepare only handles logins/consent | `performance/prepare-staging.mjs` | Preparing 1,000 students completes < 3× the current wall time; 5,000 feasible in < 30 min; no rate-limit deadlock; credentials never logged |
| **LT3 — Local smoke run (harness validation)** | Local Docker stack; dedicated local fixture accounts; `K6_USER_COUNT=200` online + offline; one disposable session; verify thresholds pass and dashboards/Server Status observe traffic | local compose + `performance/*` | 200-VU run passes thresholds locally; Server Status page shows the live ticks; ImportBatch/audit rows written; cleanup documented |
| **LT4 — Staging population build** | Run the staging workflow's prep path (or a one-off `prepare-staging.mjs` invocation) against staging: bulk-import 5,000 students, create 12 professors + 20 sections, Flow B enrollment import | staging env vars/secrets, bulk import background job | ImportBatch reports 5,000 created; 20 sections with studentCount=250; audit entries present; job path used (`users-import`) |
| **LT5 — Staging measured runs** | Execute the matrix: login burst (5,000 creds, production limits), online bell rush (waves or ramp to 5,000), offline replay storm (5,000 enqueued in 100-record batches), concurrent teacher reads during both | `staging-load.yml` (profile inputs) | All k6 thresholds pass; artifacts retained; run log records p50/p95/p99, BullMQ depths, DB/Redis signals; incidents documented |
| **LT6 — Results + follow-ups** | Write results into this plan's addendum; file capacity follow-ups (index tuning, pool sizing, PgBouncer config, BullMQ concurrency, horizontal scaling notes); optional repeat with `ramping-vus` if waves were used | this file, `documentation/LOAD_TESTING.md` | Documented verdict against §1 thresholds with numbers; follow-up tickets listed |

## 6. Scenario Design (details)

### S1 — Login burst (login capacity)
- 5,000 distinct dedicated student credentials, `per-vu-iterations` in waves (or ramp), production rate limits.
- Observe: 429 rates per identity/IP, p95/p99, bcrypt cost on event loop (login p95 < 3 s, p99 < 5 s thresholds exist).
- Professors log in too (12 accounts, trivial volume — but validates faculty login path under load).

### S2 — Online bell rush (the critical write path)
- One disposable section+session per run with a geofence (prep script's fixture coords), QR validity 15 min.
- Students split across the 20 sections: run 20 sessions × 250 students (1,000 VU × 5 waves covers all sections) or a single mega-session for worst-case contention.
- Each VU: one `/attendance/scan` with unique `clientAttemptId`, accuracy 5 m, `locationCapturedAt` fresh, camera channel, device ID, token + geofence coords valid.
- A teacher token runs `dashboard_reads` concurrently (overview/summaries/report + cockpit reads).

### S3 — Offline replay storm (BullMQ path)
- 5,000 queued records posted in 100-record batches (`/sync/attendance/batches`, 202 + receipt) → poll receipts → measure `sync_confirmation_ms` (p95 < 30 s).
- Worker concurrency 20 in staging; watch BullMQ wait/active/failed + queue depth gauges live.

### S4 — Super-admin console under load
- 2–5 super admin sockets subscribed to `server:metrics` during S2/S3 (SA7 publisher runs at ≥1 subscriber).
- Poll `GET /dashboard/admin-overview` + filtered `GET /users?status=inactive&q=...` pages (server-side filters at 5,000-row scale) + `GET /users/students/import/jobs/:id` during LT4.
- Expect admin-overview p95 to stay bounded (count queries are indexed; watch `users` q-scan latency at 5k rows — candidate index follow-up if slow).

### S5 — Realtime fan-out
- Teacher cockpits joined to session rooms during the rush; `attendance:updated` events fan out; cockpit polling paused while realtime connected (existing behavior) — verify no duplicate refresh storms under load.

## 7. Observation & Monitoring

| Signal | Source |
|---|---|
| Request rates, error rates, latency p50/p95 | k6 summaries + `polycheck_http_*` metrics |
| Event loop lag, RSS, CPU, DB/Redis readiness, sockets, BullMQ depth | SA7 Server Status page (live) + `/metrics` |
| Postgres | `pg_stat_activity` (pool waits), lock monitoring, `connection_limit` env; PgBouncer stats on staging |
| Redis | latency/memory, AOF status (clean volume before the run; local AOF corruption lesson) |
| Import pipeline | `users-import` job state, `polycheck_import_rows_total`, `ImportBatch` rows |
| Attendance integrity | accepted_attendance == 100%, no disputed-from-load rows, receipt reconciliation clean |

## 8. Safety Guardrails (retained from LOAD_TESTING.md)

- Disposable staging/local targets only; remote targets require HTTPS + explicit acknowledgement envs.
- 5,000-user run requires its own explicit confirmation env (`K6_CONFIRM_1000_USERS` semantics extended to the count).
- Tokens/credentials live only in restricted ephemeral files; summaries only in artifacts.
- Fresh `K6_RUN_ID` per dataset; reuse only for intentional replay of the same attempts.
- Clean Redis volume (or verify AOF healthy) before a long run — the local AOF-corruption incident is the cautionary tale.
- Post-run cleanup: delete disposable subject/sections; fixture accounts may remain (import retention 90 days); document what remains.

## 9. Sequencing

```
LT1 harness params + fixture generator
LT2 parallel prepare (validates at 1,000 scale)
LT3 local 200-VU smoke        ← cheap sanity gate; iterate here
LT4 staging population build  ← bulk import under BullMQ
LT5 staging measured runs     ← the actual capacity verdict
LT6 results addendum + follow-ups
```

LT3 can loop against the rebuilt local stack (current containers already run the console + import).

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| 5,000 VUs overwhelm the load generator before the backend | Waves or ramping profile (LD5); bigger runner if needed |
| Sequential prep blocks a fast start | LT2 parallelization; Flow B import for enrollment |
| Rate limits distort prep or scans | Prep-phase env relaxation (LD7); measured runs use production limits; 429 backoff retained |
| Test data pollutes dashboards/imports for real users | Disposable `Load <runId>` naming; staging-only; retention cleanup |
| Local machine results mislead | Local = smoke only (LD6); staging is authoritative |
| Redis instability mid-run corrupts results | Verify AOF health pre-run; snapshot metrics before/after |
| k6 runner browser/VM noise (GitHub shared runners) | Retained artifacts + repeat run for reproducibility; document runner size |

## 11. Open Decisions (resolve before LT4)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| A | VU strategy for 5,000 | 5×1,000 waves vs `ramping-vus` to 5,000 | **ramping-vus** (realistic bell curve) with waves as fallback if the runner can't sustain 5,000 |
| B | Runner for the full profile | GitHub-hosted (safe to ~1,000) vs self-hosted/bigger runner | self-hosted or the largest available runner for LT5; GitHub-hosted for LT1–LT3 |
| C | Prep enrollment path | 5,000 sequential `enroll-student` vs Flow B import | **Flow B import** (dogfood + fast) |
| D | Professors' activity | read-only dashboards vs also creating sessions/cockpits | read-only + cockpit joins during S2 (matches "some professors using the system") |
| E | Whether login burst uses dedicated staging relaxation or strict production limits | strict (shows real throttle) vs relaxed | **strict** for the burst; relaxed only for token prep |

## 12. References

- `performance/attendance-load.js`, `performance/login-load.js`, `performance/prepare-staging.mjs`, `performance/tokens.example.json`
- `.github/workflows/staging-load.yml` (+ `documentation/PRODUCTION_READINESS.md` measured-staging gate)
- `documentation/LOAD_TESTING.md` (thresholds, guardrails, monitoring list)
- `plan/bulk-import-plan.md` (Flow A/B endpoints + `ImportBatch`), `plan/super-admin-console-plan.md` (SA7 room contract)
- `backend/src/users/student-import-queue.service.ts`, `backend/src/sections/enrollment-import.service.ts`
- `docker-compose.local.yml` (local smoke environment)

---

## Addendum — LT1–LT3 executed, LT4–LT5 blocked on staging

**LT1 — complete.** `K6_USER_COUNT` (1–5,000) + `K6_USER_START` wave offsets in both k6 scripts; runs above 1,000 require `K6_CONFIRM_5000_USERS`; `performance/generate-fixture.mjs` emits PUP-format CSV. A 5,000-row fixture round-tripped through the shared parser with **0 issues**, and both scripts pass `k6 inspect`.

**LT2 — complete (local path).** Staging prep now uses bounded concurrency (`K6_PREP_CONCURRENCY`, default 16) and enrolls through the Flow B import instead of 5,000 sequential calls. New `performance/prepare-local.mjs` provisions local fixtures through the real pipelines: bulk-import students → forced temp-password rotation → privacy consent → Flow B enrollment → signing key → session activation. 200 students prepared successfully in one pass.

**LT3 — executed (local Docker, Windows).**
| Run | Result |
|---|---|
| Online, **50 VUs** instant burst | **Passed**: scan p95 **870 ms**, p99 < 2 s, 100% accepted, 0 failed checks |
| Online, **200 VUs** instant burst | **Failed SLO**: scan p95 **3.31 s** (server-side `responseTime` ~1.4 s); 100% accepted, 0 failed checks. Raising local Prisma `connection_limit` 10→50 did not change it |
| Online, **200 students paced as 4 × 50 waves** (`K6_USER_START` 0/50/100/150) | **Passed**: per-wave scan p95 **851 / 722 / 725 / 704 ms**; all 200 accepted, 0 failures |
| Offline, **200 VUs** | Enqueue p95 **2.82 s** (threshold crossed); sync confirmation p95 **5.31 s** (<30 s, passed); 100% accepted |

**Interpretation:** the harness and both API paths work end-to-end, but the burst rate is ~60 scans/s versus the realistic 5,000-students-in-15-minutes rate (~5.6/s). The local failure is a throughput/event-loop limit of one backend process (single Node thread), not a correctness or infrastructure-tuning failure. The 5,000 staging run should use **arrival pacing** (waves with offsets or an arrival-rate profile) rather than 5,000 instantaneous VUs; LD5's waves/ramp decision is therefore refined: waves are the safe default, pacing is required for a realistic 5,000 verdict.

**Local environment note:** `docker-compose.local.yml` sets `connection_limit=50` on the backend only for load-test headroom (production URLs unchanged).

**Blocked (LT4–LT5):** no `STAGING_BASE_URL`, `LOAD_FIXTURE_JSON`, or `load-testing` environment/runner is configured here, so the 5,000-account staging population and the authoritative measured matrix cannot run. Ready inputs: 5,000-row fixture generator, configurable k6 profiles, parallel prep, and the existing staging workflow. LT6 follows the staging run.



