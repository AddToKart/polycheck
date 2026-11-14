# Ingestion Gateway — Poison-Pill Quarantine (DLQ), Request-Path Deduplication, Redis Durability, 2-Core Benchmark

> **Status:** Drafted 2026-11-14. Planning only — no code written. Companion to
> `plan/ingest-gateway-scaling-plan.md` (executed: cluster, stream lifecycle, native
> verify, batched writer, 2-core profile) and `plan/fastify-ingestion-gateway-plan.md`.
>
> **Reader's ground rules:** claims marked **verified** were read from source in this repo
> (`services/ingest/src/**`, `backend/src/**`, `shared/src/utils/classify-sync-error.ts`,
> compose files, k6 harness). Unmarked items are design intent. Nothing here is implemented.

---

## 0. Executive summary

Four defects, four fixes:

| # | Defect | Verified failure path | Fix shape |
|---|---|---|---|
| A | **Poison pill → campus-wide 503**. A scan that can never commit (deleted session, FK violation) is retried forever: it is never acked, so it sits in the PEL; once its age passes `INGEST_MAX_LAG_SECONDS=30` the request path sheds **all** traffic. | `writer.ts:192` (`session … disappeared before commit`), `writer.ts:312/322` (row-count mismatch → throw, batch rolls back), `queue.ts` `commitMessages` (failed sessions stay pending, ack only successful ones), `http.ts:179` (`probe.lag > INGEST_MAX_LAG_SECONDS → tooMany`) | Max delivery attempts (default 5) + DLQ stream + ack + `ingest_dead_letter_total`; permanent data errors advance attempts faster than transient ones |
| B | **No request-path dedupe.** Double-scans both get 201 + buffered; the second is discarded later by the DB writer (`ON CONFLICT DO NOTHING`). Wastes stream memory, drain work, and lies to the student twice. | `http.ts:214-246` (every accepted validation → `appendScan`); `writer.ts` dedupe happens post-hoc | Atomic `SET scan:dedupe:<sessionId>:<userId> EX 86400 NX` before `appendScan`; duplicate gets the control-plane envelope with `reason: 'duplicate'`, HTTP 200 |
| C | **Redis AOF `everysec` leaves a 1 s loss window.** Default fsync policy; the 50k-scan buffer is the only pre-commit durability layer. | `docker-compose.local.yml`/`docker-compose.coolify.yml` (`redis-server --appendonly yes`, no `appendfsync` arg) | Make `appendfsync` env-selectable (`REDIS_AOF_FSYNC`), document `always` + replica standby for production |
| D | **Benchmarks were run against a 24-core workstation.** The 2-core profile exists in compose (`INGEST_HTTP_WORKERS=1`, `INGEST_CLUSTER_ENABLED=false`, `cpus: 1.0`) but was never benchmarked, and no `mem_limit` exists. | `docker-compose.local.yml` (verified: `cpus: ${SERVICE_CPU_LIMIT:-1.0}` on backend/ingest; **0** `mem_limit` lines) | Add memory caps, run the 5,000-scan benchmark pinned to 2 cores, verify zero lag lockouts + zero DLQ items |

**One correction to the task's acceptance criteria:** the backend has **85 suites / 1,067
tests**, not "14 suites, 354+". The success criterion stands — *all* backend suites green —
the numbers in the brief are stale. `pnpm --filter @polycheck/backend test:ci` is the gate.

---

## 1. Defect A — Poison-pill quarantine (DLQ)

### 1.1 Why this is a campus-wide outage today

Verified chain of failure:

1. `writeBatch` throws for a session that disappeared between accept and commit
   (`writer.ts:192`) or when a row-count invariant fails (`writer.ts:312/322`).
2. `commitMessages` (`queue.ts:267-308`) catches per-session errors, increments
   `failed`, and **does not ack** those entries — at-least-once by design.
3. There is no delivery-attempt ceiling, so the entry is re-read every tick
   (25–30 ms) until the process dies, by `drainRound('>')` or `claimStale`.
4. `pendingSummary` counts it; `oldestPendingAgeSeconds` grows unbounded.
5. `http.ts:179`: `probe.lag > INGEST_MAX_LAG_SECONDS` → `tooMany(reply)` → **503 for every
   student of every session**. One bad session kills the whole gate.

### 1.2 Design: delivery counting (Redis-native, no sidecar)

Redis Streams tracks delivery count in the PEL. `XPENDING <key> <group> <start> <end>
<count>` (ioredis overload exists, verified at `RedisCommander.d.ts:6016`) returns extended
entries `[id, consumer, idleMs, deliveries]`.

**Mechanism**

- `DrainerDeps` gains two fields: `dlqKey: string` and `maxDeliveryAttempts: number`
  (both from config; `runtime.ts` passes them like `batchMax`).
- `commitMessages` already holds the parsed batch and the ack list. Extend the
  per-session failure branch:
  1. On failure, query `XPENDING <stream> <group> IDLE 0 '<oldestId>' '+'
     <count>` for **that session's unacked ids only** (ids are already in hand from the
     failed batch — no extra lookup needed: pass the failed batch's message ids directly).
     Simpler and exact: the ids being failed are known locally, so fetch their delivery
     counts with one range query filtered client-side, or — cheapest — maintain a
     **per-session in-process attempt counter map** keyed `sessionId → count`, seeded from
     the PEL's `deliveries` value the *first* time a session fails (one XPENDING call).
     Counter lives only in the single drainer process, which is the only consumer.
  2. When `attempts >= INGEST_MAX_DELIVERY_ATTEMTS`:
     - `XADD <dlqKey> * payload <original JSON> originalId <id> sessionId … userId …
         error <message> failedAt <ISO> attempts <n>` — one XADD per failed entry with
         flat metadata fields (per spec), plus the full original `payload` string.
     - Add the ids to the **acked** list (XACK removes them from the PEL → lag drops to 0
       immediately, without touching the healthy batch path).
     - `metrics.deadLetterTotal += n`, `metrics.drainDuplicates` unchanged.
  3. Below the ceiling: leave pending (retry next tick) — unchanged behaviour.

**Retry pacing, not hot-loop retrying.** A poison pill currently re-fails every ~30 ms
tick. With attempts counted, add a cheap **per-session backoff** in the drainer:
`nextAttemptAt[sessionId] = now + min(2^attempts × 500ms, 5s)`. While backed off,
`commitMessages` skips that session's batch *without reading it* — the entries stay
pending, their lag grows, but **they are quarantined before lag can exceed 30 s** because
attempts 1–5 complete well within 30 s (5 attempts × ≤5 s ≈ 15 s worst case). Belt and
braces: even if backoff timing slips, step 2 fires on the 5th attempt regardless.

**Permanent vs transient errors (spec B, writer.ts):** introduce a typed error:

```ts
export class PermanentWriteError extends Error {}   // never worth retrying
```

`writer.ts` throws it for: session disappeared (`:192`), FK/enum violations (catch
`P2003`/`22P02`-shaped pg errors around the batched statements), and any row-count
mismatch that a retry would repeat unchanged. `commitMessages` treats a
`PermanentWriteError` as an **immediate DLQ** (attempts ceiling overridden — one delivery
is enough). Transient shapes (connection timeout, lock wait, pool exhaustion, anything
matching `isDatabaseCapacityError` in the backend's filter — mirror that classifier in the
drainer) keep the retry ladder. DLQ metadata records `error` either way; the ops story is
the same: inspect `XRANGE attendance:dead_letter - +`, decide, replay manually.

**Key naming.** The control plane's RedisService prefixes `polycheck:`; the ingest gateway
writes keys with the prefix embedded (`polycheck:ingest:scans`). Default therefore:
`polycheck:ingest:dead-letter` (`INGEST_DLQ_STREAM_KEY`), not the brief's bare
`attendance:dead_letter` — this keeps the existing fallback drainer and ops tooling on one
namespace convention. The brief's key remains honored via env override if an external
consumer requires it. **Documented deviation.**

**What DLQ does NOT do:** no automatic replay. A poisoned scan means *some* invariant
broke; auto-replaying risks the exact failure again. The teacher's dispute flow already
covers the student-facing remedy (re-mark status); the DLQ is an audit + repair surface.
DLQ entries carry the original `payload`, so a repair script can re-enqueue after a fix —
out of scope for this change, named in the runbook.

### 1.3 Metrics

`metrics.ts` gains `deadLetterTotal` counter → `ingest_dead_letter_total`, plus
`dlqDepth` gauge (XLEN of the DLQ, sampled in `/metrics` like `streamLength`). The
quarantined lag guarantee is observable: `ingest_buffer_lag_seconds` returns to 0 after
quarantine, `ingest_pending_depth` returns to 0.

### 1.4 Lag semantics after quarantine

`pendingSummary`/`oldestPendingAgeSeconds` need **no changes**: XACK is what removes the
entry from the PEL, and both read XPENDING. Quarantine = ack, so the healthy-session
request path unblocks on the next `probeHotPath` (one pipelined XPENDING, ~ms). Verified:
no code change required in `http.ts` for this — the defect fix is entirely in the drainer.

### 1.5 Tests (`services/ingest/test/queue.test.ts`)

Existing fake-Redis doubles are extended with `xpending`/`xadd` mocks:

1. **Retries up to the ceiling.** Writer rejects with a transient error; assert the batch
   is *not* acked on attempts 1..4, acked on attempt 5 (default), with an XADD to the DLQ
   carrying `attempts: 5`, `originalId`, `sessionId`, `userId`, `error`, `failedAt`.
2. **Permanent error quarantines immediately.** Writer throws `PermanentWriteError`;
   single delivery → DLQ + ack, no retries.
3. **Healthy sessions drain while a pill is pending.** Two sessions, one failing:
   failing entries stay pending, healthy entries acked, and (after ceiling) the failing
   one is quarantined → `pendingSummary` reads 0/0-lag (assert via `pendingSummary` on the
   fake).
4. **DLQ metadata shape.** Fields `originalId`, `sessionId`, `userId`, `payload`, `error`,
   `failedAt`, `attempts` all present and correct.
5. **Ceiling is env-driven.** `maxDeliveryAttempts: 2` in deps → DLQ on second failure.

Writer-side: `writer.integration.test.ts` gains one DB-backed case — delete the fixture
session between accept and `writeBatch` → expect `PermanentWriteError` (or the classified
shape) rather than a generic throw.

---

## 2. Defect B — Request-path atomic deduplication

### 2.1 Current behaviour (verified)

`http.ts submit()` validates → `deps.appendScan(...)` for every passing scan → 201
`buffered`. Two rapid duplicates both enter the stream; the DB writer's
`ON CONFLICT ("sessionId","studentId") DO NOTHING` + pending-claim guard makes the second
**a no-op at commit time**. The student saw two 201s; the stream and drainer paid for both.

### 2.2 Design: `SET NX` reservation before append

**New dependency** (keeps `http.ts` testable):

```ts
// IngestDeps
reserveScan: (sessionId: string, userId: string, ttlSeconds: number) => Promise<boolean>
// runtime.ts: (sessionId, userId, ttl) =>
//   (await redis.set(`scan:dedupe:${sessionId}:${userId}`, '1', 'EX', ttl, 'NX')) === 'OK'
```

`IngestDeps.redis` widens from `Pick<Redis, 'ping'>` to
`Pick<Redis, 'ping' | 'set'>` (the runtime already owns the full client).

**Placement in `submit()`** — after validation succeeds, *before* `appendScan`:

1. `const reserved = await deps.reserveScan(snapshot.id, user.id, dedupeTtl)`
2. `reserved === false` → **do not append**; `metrics.scansDuplicate += 1`; return
   HTTP **200** with the control-plane duplicate envelope:
   `{ success: false, status: priorStatus…, reason: 'duplicate',
      message: 'Attendance was already submitted for this session' }`
3. `reserved === true` → `appendScan` as today.

**Key shape:** `scan:dedupe:${sessionId}:${userId}` — **control-plane namespace note:**
the backend's `RedisService` prefixes `polycheck:` and reads/writes its own keys; the
gateway never touches backend keys, and the backend never reads gateway keys, so a bare
`scan:dedupe:` prefix inside the gateway's own keyspace is safe **only if** nothing in the
control plane later scans for `scan:dedupe:*`. To keep the fleet's keyspace unambiguous,
default to `polycheck:ingest:dedupe:${sessionId}:${userId}` via
`INGEST_DEDUPE_KEY_PREFIX` (the brief's key shape honored by env override). **Documented
deviation, same rationale as the DLQ key.**

**TTL — 24 h fixed, not "session lifespan".** Verified: the `SessionSnapshot` the gateway
reads has `isActive`/`endedAt` but **no** `endTime`/expiry fields, and snapshots die with
the session (activation path republishes, `end()` deletes the cache key). Deriving TTL from
the snapshot would make TTL 0 for ended sessions — wrong direction for a replay window.
Fixed 24 h (`INGEST_DEDUPE_TTL_SECONDS` default 86400) is simple, bounded, and covers the
offline-replay horizon (clients replay up to ~30 days in theory; 24 h is the practical
live-replay horizon the control plane itself treats as duplicate-on-first-arrival).
**Documented deviation from "TTL matching session lifespan".**

**Second-scan semantics — status field.** The backend's duplicate envelope includes
`status: priorStatus` (the roster row's current status). The gateway's snapshot does not
carry roster status, and fetching it would put a DB/lookup on the hot path — exactly what
the gateway exists to avoid. The dedupe envelope therefore returns
`{ success: false, reason: 'duplicate', message: … }` **without** `status` (or with
`status: undefined` omitted). Verified consumers: the Flutter sync classifier matches on
`message.toLowerCase().includes('already submitted for this session')`
(`sync_engine.dart:228`), the shared classifier matches the same string, and the RN client
classifies `result.error`/message text — none reads `status` on a duplicate. The k6
harness checks `body.success !== false` only on *first* scans. The web/RN *live* paths hit
this envelope only in the retry race (the client's own "already saved on this device"
guard fires first); those treat non-5xx as the documented duplicate acknowledgment.

**Race honesty.** `SET NX` reserves at the gateway; the stream write follows. Crash
between the two leaves a reservation without a stream entry → the student's scan is
dropped (student sees a 201-ish success but no record). Mitigations, in order: (a) this is
the same failure window the control plane has between session-create and commit, and the
teacher's roster shows `pending`, which is re-markable; (b) reservation is written **only
after** full validation and **immediately before** XADD, shrinking the window to ~1 ms;
(c) a runbook command can clear a dangling reservation key (`DEL polycheck:ingest:dedupe:…`)
— same repair shape as the DLQ replay. Documented, accepted.

**Interaction with the control plane.** No contract change: the backend keeps serving
scans when the gateway is bypassed, and its own P2002/roster-claim dedupe remains the
authority for scans that reach it. The gateway reservation is *additional* fast-path
dedupe. If a scan is reserved at the gateway and the gateway dies before XADD, the
control plane still accepts a retry (different keyspace) — correct by construction.

### 2.3 Metrics + tests

- `metrics.ts`: `scansDuplicate` counter → `ingest_scans_duplicate_total`.
- `http.test.ts` additions:
  1. First scan (fresh reservation) → **201**, `syncState: 'buffered'`, appended exactly once.
  2. Second scan (reservation fails) → **200**, `success: false`, `reason: 'duplicate'`,
     message `'Attendance was already submitted for this session'`, **zero** new appends.
  3. Reservation failure does **not** consume a validation rejection slot (metrics:
     `scansAccepted` unchanged, `scansDuplicate` +1).
  4. `reserveScan` thrown → 503 retryable (same shape as snapshot-miss), not 500.
- `e2e-smoke.mjs` check #5 tightens from `status < 500` to exact
  `status === 200 && json.reason === 'duplicate'` (script change only).

---

## 3. Defect C — Redis durability tuning

**Change (both compose files):**

```yaml
redis:
  command:
    - redis-server
    - --appendonly
    - "yes"
    - --appendfsync
    - ${REDIS_AOF_FSYNC:-everysec}
```

- Local default stays `everysec` (the benchmark workhorse); comment documents:
  > Production high-durability targets can set `REDIS_AOF_FSYNC=always` — the ~1 s
  > kernel-panic loss window closes, at the cost of an fsync per write on the hot
  > append path (measure on staging: the scan path does one XADD per request). A
  > replicated Redis standby (coolify: second redis replica) is the complementary
  > layer: fsync covers power loss, replication covers instance loss.
- `.env.example` gains `REDIS_AOF_FSYNC=everysec` with the same note.
- `docker-compose.yml` (production) gets the same env hook — verified it currently has a
  redis service whose command would need the identical edit.

**What this does not change:** the gateway's own backpressure contract. `always` fsync
raises per-XADD latency; the benchmark (§4) runs before and after the env flip on staging
to quantify it. No gateway code changes.

---

## 4. Defect D — 2-core staging benchmark verification

**State (verified):** `docker-compose.local.yml` already pins the 2-core profile —
`INGEST_HTTP_WORKERS: 1`, `INGEST_CLUSTER_ENABLED: false`, `cpus: 1.0` on backend/ingest,
drainer pool 4, backend `connection_limit=12`. **Missing:** memory caps and an actual
benchmark at that profile.

**Changes:**

1. `mem_limit: ${SERVICE_MEM_LIMIT:-4g}` on backend, ingest, ingest-drain (+ `2g` on
   postgres, `512m` on redis — sized to the 50k-entry stream ≈ 50 MB with headroom).
2. Benchmark protocol (staging or the local stack pinned to 2 cores — **never the
   workstation unbounded**, per the 2026-11-14 decision):
   - `TARGET_COUNT=5000 VUS=200 node performance/run-gateway-k6.mjs <fixture>`
   - Capture: req/s, p50/p90/p95/max (`http_req_duration`), `http_req_failed`,
     `ingest_dead_letter_total` (expect **0**), `ingest_buffer_lag_seconds` (expect 0),
     `ingest_pending_depth` after drain (expect 0), `ingest_scans_duplicate_total`
     (dupes counted, none swallowed).
   - Acceptance for this run: zero lag lockouts (no 503 `database_busy`/backpressure),
     zero DLQ items, ledger verify `verified: true` at the end.
3. Record results in the plan addendum (not AGENTS.md — this is a measurement, not a wave).

**Honest expectation:** the 4-worker/24-core run measured 3,100 rps @ p50 62 ms. At
1 worker/2 cores with the same native verify, expect roughly one worker's share
(~1,000–1,500 rps, p50 ~60–120 ms) — still ≥ 50× a bell rush (2,000 students / 120 s ≈
17 rps). The benchmark exists to prove no *cliff*, not to re-chase the 24-core number.

---

## 5. Files changed (complete list)

| File | Change |
|---|---|
| `services/ingest/src/config.ts` | `INGEST_MAX_DELIVERY_ATTEMPTS` (default 5, 1–100), `INGEST_DLQ_STREAM_KEY` (default `polycheck:ingest:dead-letter`), `INGEST_DEDUPE_TTL_SECONDS` (default 86400), `INGEST_DEDUPE_KEY_PREFIX` (default `polycheck:ingest:dedupe:`) |
| `services/ingest/src/queue.ts` | `PermanentWriteError` export; `DrainerDeps.{dlqKey,maxDeliveryAttempts}`; per-session attempt counters + backoff; DLQ XADD + ack on ceiling; quarantine path in `commitMessages` |
| `services/ingest/src/writer.ts` | Throw `PermanentWriteError` for session-disappeared/FK/enum violations; retryable shapes unchanged |
| `services/ingest/src/metrics.ts` | `deadLetterTotal`, `dlqDepth`, `scansDuplicate` + render lines |
| `services/ingest/src/http.ts` | `IngestDeps.{reserveScan}`; `redis` widened to `Pick<Redis,'ping'\|'set'>`; dedupe check between validation and `appendScan`; duplicate envelope (200); `scansDuplicate` |
| `services/ingest/src/runtime.ts` | Wire `reserveScan` (SET NX), pass `dlqKey`/`maxDeliveryAttempts` into drainer deps; `/metrics` gains dlqDepth |
| `services/ingest/test/queue.test.ts` | 5 DLQ cases (§1.5) |
| `services/ingest/test/writer.integration.test.ts` | Deleted-session → `PermanentWriteError` case |
| `services/ingest/test/http.test.ts` | 4 dedupe cases (§2.3) |
| `services/ingest/scripts/e2e-smoke.mjs` | Duplicate check tightened to exact 200/duplicate envelope |
| `docker-compose.local.yml`, `docker-compose.coolify.yml`, `docker-compose.yml` | Redis `--appendfsync ${REDIS_AOF_FSYNC:-everysec}`; local: `mem_limit` per service |
| `.env.example` / `.env.docker.local.example` | `REDIS_AOF_FSYNC` documented |

**Not changed:** `shared/**` (token contract untouched — contract gate keeps passing),
backend source (its dedupe/ledger authority is untouched), any client, any schema. The
`ingest-fallback.service.ts` (NestJS) keeps replaying the main stream; DLQ entries are
deliberately invisible to it.

## 6. Sequencing & verification

1. **DLQ first** (config → queue/writer/metrics → runtime wiring → tests): the outage
   defect, highest severity. Gate: `pnpm --filter @polycheck/ingest test` (all new cases +
   existing 75), backend `test:ci` untouched but re-run (85 suites / 1,067 tests), contract
   gate exit 0.
2. **Dedupe second** (config → http/runtime → tests): gate as above; `e2e-smoke.mjs`
   re-run live (17 checks, duplicate check now exact).
3. **Durability third** (compose + env example): no code; verify `redis-cli CONFIG GET
   appendfsync` reflects the env after `up`.
4. **Benchmark last**: 5,000-scan run on the 2-core profile; results recorded in the plan
   addendum; zero lockouts, zero DLQ, ledger verified.

**Risk notes.** The attempt counter lives in the drainer process; a drainer restart resets
counters, but `claimStale`/startup replay re-reads the PEL whose `deliveries` field is
Redis-persisted — the first re-failure re-seeds the counter from PEL deliveries, so the
ceiling survives restarts. The dedupe reservation is process-independent (Redis), so the
gateway restart does not weaken it. `PERMANENT`-vs-transient classification mirrors the
backend's `isDatabaseCapacityError` patterns to avoid two vocabularies drifting.

## 7. Deviations from the brief (with reasons)

1. **DLQ key** `polycheck:ingest:dead-letter` (default) instead of bare
   `attendance:dead_letter` — namespace consistency with every ingest key; env-overridable.
2. **Dedupe TTL** fixed 24 h instead of "session lifespan" — the gateway snapshot has no
   lifespan field; deriving one would put a lookup on the hot path. 24 h is the practical
   replay horizon; env-overridable.
3. **Dedupe key prefix** `polycheck:ingest:dedupe:` — same namespace rationale.
4. **Duplicate envelope omits `status`** — the gateway snapshot cannot know roster status
   without a DB round-trip; verified that no consumer reads `status` on a duplicate.
5. **No auto-replay from DLQ** — a poisoned record means an invariant broke; replay is a
   manual, audited decision. The brief asks for quarantine + ack, which is delivered.
6. **Backend gate is 85 suites / 1,067 tests**, not "14 suites, 354+" — the brief's numbers
   are stale; the criterion (all green) is unchanged.
