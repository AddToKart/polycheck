# Polycheck Code Audit
Repo: `AddToKart/polycheck` — Turborepo monorepo (NestJS backend, Next.js frontend, Expo/React Native mobile, Prisma/PostgreSQL, Redis)

*Updated with a deeper second pass: every controller/service's authorization logic, the realtime gateway, the Redis fallback path, idempotency handling, cascade-delete behavior, and both frontends' token/key storage. One earlier finding is corrected in §2 ("sync batch size").*

## Remediation update - July 18, 2026

The implementation findings from this audit have now been remediated:

| Finding | Resolution |
|---|---|
| Better Auth was documented but absent | Better Auth 1.6 is now the authoritative session store. Web uses strict HttpOnly cookies, mobile uses signed bearer sessions in SecureStore, existing bcrypt credentials are migrated without changing `User.id`, and Passport JWT has been removed. |
| Single-session replacement was lazy | New logins, password resets, and account status changes revoke persisted sessions. Socket.IO broadcasts `auth:session-replaced` through the Redis adapter, disconnects old sockets, and web/mobile clients show a replacement or revocation notice. |
| Offline sync was synchronous without BullMQ | Attendance batches are durably enqueued in BullMQ with retry/backoff. The endpoint waits for authoritative per-record results before mobile deletes its SQLite source record. |
| Redis fallback weakened multi-instance guarantees | Production now requires Redis. Startup fails if Redis, the Socket.IO adapter, or BullMQ cannot connect; distributed rate limiting and idempotency fail closed during a runtime outage. Local in-process fallbacks remain development-only. |
| Proof images required a local volume | Production now requires S3-compatible object storage. The local driver remains available for development and existing `/uploads/...` references remain readable during migration. |
| Subject deletion surfaced a raw FK error | Subjects with sections now return a clean conflict response, including a Prisma `P2003` fallback translation. |

The remaining medium findings are accepted v1 constraints already documented in the system plan: commodity-device GPS spoofing and limited trust in offline device timestamps. The sections below are retained as the original audit snapshot and should be read together with this remediation status.

## Overall verdict

**Architecture/code quality: strong (8/10). Production readiness: close, not there yet (7/10 with caveats below).**

This is noticeably more mature than a typical student capstone. It has real Ed25519 QR signing, server-side geofence re-validation, atomic duplicate-rejection, Redis-backed rate limiting, RBAC guards, audit logging, idempotency handling, env validation that fails closed in production, a documented CI release gate, and extensive `.spec.ts` coverage across nearly every service. The plan documents are detailed and the implementation follows them in the security-critical paths (anti-cheat stack, offline sync, key provisioning). That combination is unusual and is the strongest signal here.

It is not yet "ship to all of PUP" ready because of a few gaps below — mostly single points of failure and a couple of doc/implementation mismatches, not fundamental design flaws.

---

## 1. Plan vs. implementation — deviations found

| Documented | Actual |
|---|---|
| "Better Auth handles session management, JWT issuance, and user account lifecycle" | No `better-auth` dependency anywhere. Custom `passport-jwt` + `bcryptjs` + a hand-rolled `authVersion` counter for single-session invalidation. **This works correctly** (verified in `jwt.strategy.ts`), it just isn't Better Auth. Documentation is stale/aspirational here. |
| "BullMQ manages batch processing of offline sync payloads asynchronously" | No BullMQ dependency. `sync.service.ts` processes records with a plain sequential `for` loop, synchronously, in the request handler. Functionally fine at small scale, but a large offline queue (a student who syncs after a week away) will block the request thread for the full batch — no chunking, no backpressure. |
| "WebSockets... Redis Pub/Sub... Active Session Caching" | Implemented as described — `RedisIoAdapter`, `AttendanceGateway`, and `cacheActiveSession` in `sessions.service.ts` all exist and are wired up correctly. |
| "Two-layer database... local SQLite... source of truth during class" | Implemented as described in `android/services/offline-store.ts` — real `expo-sqlite` queue tables (`sync_queue`, `cached_sections`, `cached_sessions`), WAL mode enabled. |
| "Signing key... stored in the device's secure enclave or keystore" | Implemented correctly via `expo-secure-store` in `signing-key.ts`. |

Nothing here is a security problem, but the docs oversell the async/queueing story and undersell that auth is custom-built, not a managed library. Worth updating the docs so a future contributor doesn't go looking for a `better-auth` config file that doesn't exist.

---

## 2. Security review

### Strong points
- **QR signing**: real asymmetric crypto (`tweetnacl` Ed25519 `nacl.sign`), not HMAC-with-shared-secret. Server verifies signature, session/section/teacher binding, and rejects tampered `issuedAt` (`payload.issuedAt > Date.now() + 5min` check in `activate()`), which correctly defeats clock-rollback replay per the plan's Scenario 4.
- **Geofence**: real server-side Haversine re-check against DB-stored coordinates in `attendance.service.ts`, not just trusting the client's pass/fail flag.
- **Duplicate rejection**: uses a conditional `updateMany` (`where: { status: { in: ['pending','absent'] }, ... }`) instead of read-then-write, so it's race-safe under concurrent syncs — a good, non-obvious detail.
- **Rate limiting**: Redis-backed, per-student+session+device on scan attempts, plus separate identity and IP limits on login, with a fallback DUMMY_HASH compare to avoid a timing oracle on "does this student ID exist."
- **RBAC**: global `JwtAuthGuard` + `RolesGuard`, role re-fetched from DB on every request (not trusted from the JWT payload) — this avoids the stale-role-in-token class of bug entirely.
- **File uploads (proofs)**: path traversal is defended (`resolve()` + prefix check before serving), filenames are randomized with `randomUUID`, write uses `wx` flag to avoid overwrite races.
- **Prod config posture**: `PRODUCTION_DEPLOYMENT.md` documents a JWT secret minimum length, same-site cookie domain requirement, and states the app "fails closed" if Postgres/Redis/JWT/CORS config is missing — that's the right instinct, assuming `env-validation.ts` actually enforces it (it does, per `validateEnv`).

### Gaps / findings

**Medium — GPS spoofing is explicitly unsolved (by design, per docs, but worth restating loudly)**
Offline scans trust the client-submitted lat/lon for the *first* geofence check; "suspicious coordinates" detection only fires retroactively (2+ identical coordinate reports across sessions, or exact-center match) and just flags to `disputed` status rather than blocking. This is honestly documented as a v1 limitation in the plan, but it means a student with a mock-location app who is careful not to reuse the exact same faked coordinate twice will not be caught. Fine for v1 if the university accepts the tradeoff; make sure whoever signs off on "production ready" knows this is a known, accepted gap, not an oversight.

**Medium — offline `scannedAt` timestamp is client-controlled**
Status (present vs. late) is computed against the *client-submitted* `scannedAt`, bounded only by `issuedAt - 30s` and `receivedAt + 5min`. A student who was late but syncs from a device with a manipulated local clock inside that 5-minute slack could self-report as "present." Narrow window, low blast radius, but worth a look — could be tightened by cross-checking `scannedAt` against a signed client-side attestation, or simply accepting this as a v1-acceptable risk (similar to the GPS gap).

**Medium — single point of failure on file storage**
Proof-of-class images are written to a local disk volume (`UPLOAD_DIR`), not object storage (S3/GCS/Supabase Storage). Docker Compose mounts a persistent volume, which is fine for a single backend instance, but this blocks horizontal scaling of the API tier and complicates backups/CDN delivery. Not a bug, but a real constraint on "production ready at scale."

**Low — enrollment code brute force**
7-char code from a 33-character alphabet (`crypto.randomInt`, good) ≈ 3.4×10¹⁰ combinations — strong. But `enrollByCode` has no dedicated rate limit beyond the global default (120 req/min/IP via `ThrottlerModule`). At that ceiling a targeted single-IP guess run is impractical anyway, so this is low severity, just worth a session/account-scoped limiter to be thorough.

**Correction from the first pass — sync batch size is capped.** I originally flagged unbounded sync payloads as a risk. On closer read, `SyncAttendanceBatchDto` has `@ArrayMinSize(1)` and `@ArrayMaxSize(100)` on the records array, enforced by the global `ValidationPipe`. A device with a huge offline backlog needs multiple sync calls, but a single malicious/malformed request can't flood a worker thread. Withdrawing that finding.

**Low — Swagger docs exposed pending env**
`/api/docs` is gated by `NODE_ENV !== 'production' || ENABLE_API_DOCS`, so it's off by default in prod — good — but it's a single boolean flag away from being world-readable API documentation (including auth flows) in production. Not a flaw, just flag it in the deploy checklist.

**Informational — no explicit device-binding/biometric gate**, but this is explicitly deferred to v2 in the plan, not a gap against the stated scope.

---

## 2b. Endpoint-by-endpoint authorization pass

Traced every controller against its service to check that the `@Roles()` decorator (or its absence) actually matches the ownership/scope check underneath. Findings:

- **Auth, sessions, attendance, disputes, section-roles, session-permissions, sync, users, proofs** — every mutating endpoint I checked either has a `@Roles()` guard or does its own ownership/scope check in the service (or both). No missing-authorization endpoint found. Several controllers (`disputes`, `section-roles`, `session-permissions`) deliberately omit `@Roles()` on read endpoints and instead branch scope logic inside the service by `user.role` — a valid pattern, and it's applied consistently rather than as an accidental omission.
- **`users.service.ts` privilege boundaries are notably careful**: a department-scoped `super_admin` cannot create/reset/disable an account outside their department (`assertDepartmentScope`), and *no* super admin — department-scoped or institution-scoped — can reset another super admin's password or disable a super admin account through this API (`resetPassword`/`setStatus` both explicitly block `target.role === 'super_admin'`). That closes the obvious "compromise one admin, lock out all admins" escalation path.
- **`session-permissions` + `section-roles` combine correctly** to gate student-officer session creation: `sessions.service.ts#authorizeCreator` requires *both* an active `SectionRole('president')` *and* a live, non-expired `SessionPermission` grant from the teacher. Neither alone is sufficient — a student can't self-escalate by only holding the officer title if the teacher hasn't also issued a (24h-expiring) permission grant. This is a real two-factor check, not just decoration.
- **Realtime gateway (`attendance.gateway.ts`) re-implements the same JWT + `authVersion` check** used by the REST `JwtStrategy`, applied once at socket handshake (`server.use(...)` middleware), and then re-checks section/teacher ownership per `session:join`. Students are explicitly and intentionally blocked from joining any session's room — the code comment calls out *why* ("attendance updates contain classmates' identifiers"), which is exactly the right privacy instinct for a system that broadcasts other students' names/statuses in real time.

### New finding — `subjects.service.ts#remove()` has no FK-safety guard, unlike its sibling
`sections.service.ts#remove()` explicitly checks for existing sessions before deleting a section ("Cannot delete a section with existing session history") and returns a clean 400. `subjects.service.ts#remove()` has no equivalent check — it calls `prisma.subject.delete()` directly. `Section.subjectId` has no `onDelete: Cascade` in the schema (Prisma/Postgres default is effectively restrict), so deleting a subject that still has sections will throw a raw Prisma `P2003` foreign-key-violation error. The global `AllExceptionsFilter` doesn't special-case Prisma error codes, so this surfaces to the teacher as a generic `500 Internal server error` instead of a clean "delete the sections first" message. Not a security issue (no data leaks, the delete correctly fails rather than silently cascading and wiping attendance history) — it's a real, reproducible UX/API-consistency bug, and a five-minute fix once flagged (mirror the section-delete guard, or catch `P2002/P2003` in the filter and translate to 409).

### New finding — the "security alert" from Anti-Cheat Scenario 2 isn't actually pushed
The plan states that when a second login replaces a session, "student B is immediately logged out of their existing session and receives a security alert." In the code, `authVersion` invalidation is real and correct, but it's **lazy, not active**: the old JWT/cookie only gets rejected the next time the old device makes a REST call (`JwtStrategy#validate` compares `authVersion`) or reconnects a socket (the WS auth middleware only runs once, at handshake — an already-open socket isn't proactively dropped when `authVersion` changes). There's no server-initiated push notification, WS `disconnect` call, or "someone logged into your account" alert anywhere in `auth.service.ts` or `attendance.gateway.ts`. Practically: the legitimate student's *next action* will fail with 401 (so credential sharing is still disruptive, per the plan's actual security goal), but they won't be proactively notified the moment it happens the way the doc implies — they'll only find out when they next try to use the app. Worth either updating the doc to describe the real (still-effective) behavior, or adding a lightweight push/WS event on `beginSession()` to match what's written.

---

## 2c. Resilience: the Redis fallback quietly changes guarantees under multi-instance deployment

`redis.service.ts` is well-built — every Redis-backed operation (`consumeRateLimit`, `setIfAbsent`, `getJson`/`setJson`) has an in-process `Map`-based fallback with its own TTL pruning and a bounded size (`MAX_LOCAL_FALLBACK_ENTRIES = 10_000`) so it can't leak memory unbounded. On a **single backend instance**, this is a genuinely good resilience feature: if Redis blips, login rate limiting, scan rate limiting, idempotency keys, and the active-session cache all keep working locally instead of hard-failing.

The catch is what happens the moment you run **more than one backend instance** (which `PRODUCTION_DEPLOYMENT.md`'s mention of a reverse proxy in front of the API implies is the eventual target) *and* Redis becomes unreachable:
- Rate limits become per-instance instead of global — a client behind a load balancer with N instances effectively gets up to N× the intended rate limit (login attempts, scan attempts) for the duration of the outage.
- The `IdempotencyInterceptor`'s dedup and locking stop working across instances — the same `Idempotency-Key` could be processed once per instance instead of once globally, undermining the exact guarantee it exists to provide.
- `sessions.service.ts#cacheActiveSession` (Redis-backed active-session cache for low-latency validation) silently falls back to per-instance memory too, so a scan validated against instance A's cached geofence/QR state and a sync landing on instance B could momentarily see different cached state (the source of truth in Postgres is still correct, but the fast-path cache diverges).

None of this is a correctness bug in the single-instance deployment this project is clearly scoped for today, and the code is honest about it — every fallback path logs a warning. But if/when Polycheck scales beyond one backend container, this is the first thing to revisit, and it should be paired with real alerting on "Redis unavailable" (right now it's a `logger.warn`, easy to miss in production log volume) rather than discovering it via a rate-limit bypass report.

---

## 2d. Frontend/mobile key & token storage — verified sound, with one nuance

- **Web (`frontend/src/lib/api-client.ts`)**: the JWT is *never* touched by frontend JS. Login sets an `httpOnly`, `sameSite=strict`, `secure`-in-production cookie (`auth.controller.ts#cookieOptions`); every subsequent request uses `credentials: 'include'` and doesn't attach an `Authorization` header at all. Only non-sensitive profile fields go into `localStorage` (`polycheck-user`), and there's a dedicated Vitest test asserting a marker string that "must-not-be-persisted" never shows up in `localStorage`. This is the correct pattern and defeats XSS-based token theft (there's no token in JS-reachable storage to steal).
- **Web teacher signing key (`frontend/src/lib/signing-key.ts`)**: the Ed25519 private key is encrypted at rest with AES-GCM using a *non-extractable* WebCrypto key stored in IndexedDB, with the ciphertext in `localStorage`. This is a real, deliberate upgrade from a plaintext-at-rest predecessor (there's explicit migration code for exactly that case) and correctly prevents key theft via static storage inspection (stolen browser profile, malicious extension reading `localStorage`, DB backup, etc.). The one honest caveat: "non-extractable" prevents *exporting* the raw key bytes, not *using* the key — a successful XSS on the teacher dashboard could still call the app's own `signQRToken()`/`getOrCreateTeacherSigningKey()` functions to mint valid signed QR tokens for as long as the page is open, since that's just normal same-origin JS calling normal same-origin JS. That's close to the practical ceiling of what client-side crypto can do against an active XSS (no client-side scheme fully survives arbitrary same-origin script execution), so this isn't a design flaw so much as a reminder that this mitigation's value is in the at-rest case, not the active-session case — and it's one more reason the app's CSP/XSS hygiene on the teacher dashboard specifically matters more than most pages.
- **Mobile (`android/services/api-client.ts`, `signing-key.ts`)**: both the JWT and the Ed25519 private key go through `expo-secure-store` (Keychain/Keystore-backed), consistent with the plan. No plaintext token or key found in `AsyncStorage` or anywhere else.
- No `dangerouslySetInnerHTML`, `eval`, or `new Function` usage in either frontend beyond one static, hardcoded (no user input) theme-flash-prevention `<script>` in `layout.tsx` — not a vector.

---

## 2e. Data-integrity / cascade-delete posture

Only one `onDelete: Cascade` exists in the whole schema (`ScheduleDay → Section`, which is correct — schedule rows are trivially owned by their section). Everything else defaults to restrict-on-delete, which is the right call for an attendance system: it's structurally impossible to accidentally cascade-delete a student's attendance history by deleting a section, subject, or session out from under it. `sections.service.ts#remove()` builds on this correctly with an explicit pre-check; `subjects.service.ts#remove()` does not (see §2b finding above) — that's the one place the restrict-by-default posture surfaces as an ungraceful error instead of a handled one.

---

## 3. Architecture quality

- **Module boundaries** in the NestJS backend map cleanly to the plan's functional split (auth, sessions, attendance, sync, disputes, section-roles, session-permissions, proofs, dashboard, realtime, infrastructure). Nothing is a god-module.
- **Prisma schema** is well-indexed for the actual access patterns (`[sectionId, date]`, `[teacherId, date]`, `[sessionId, studentId]` uniques, etc.) rather than indexed defensively/randomly — this suggests the schema was designed against real query shapes, not guessed.
- **Shared package** (`@polycheck/shared`) correctly centralizes the QR signing, Haversine, and validation logic so mobile and backend can't drift apart on the security-critical math — this is the right call for a monorepo and is actually being used, not just present.
- **Test coverage**: near-universal `.spec.ts` files per service, including guard unit tests and a dedicated `authorization-policy.spec.ts`. I didn't run the suite, but the presence and structure suggest real coverage rather than scaffolding.
- **Ops posture**: graceful shutdown with connection draining, health/readiness endpoints, Pino structured logging, audit interceptor, idempotency interceptor on mutating routes — these are the kind of details that get skipped in most student projects and weren't here.

---

## 4. Is it production-ready?

**For a pilot deployment (single section/department, one backend instance): yes.** The deeper pass didn't surface anything that changes this — no missing-authorization endpoint, no XSS/CSRF hole, no accidental data-cascade risk. The two things to fix before a pilot: catch/translate the `subjects.delete()` FK error into a clean 400 (trivial), and make sure whoever signs off on "production ready" has explicitly seen and accepted the GPS-spoofing and offline-timestamp-trust tradeoffs (both are honestly documented in the plan as v1 scope, not hidden bugs).

**For institution-wide, multi-instance production: not quite**, for one more reason than the first pass found: beyond proof-uploads-on-local-disk and needing to confirm sync batching (now resolved — it's capped), the Redis in-process fallback quietly changes rate-limiting, idempotency, and active-session-cache guarantees from "global" to "per-instance" the moment you run more than one backend container and Redis has a bad day. That's a monitoring/alerting gap more than a code gap — add an alert on sustained Redis-fallback mode before horizontally scaling, and this stops being a concern.

**What actually stood out on the deeper pass**: the authorization logic is consistently correct across every module I traced (auth, sessions, attendance, disputes, section-roles, session-permissions, users, proofs, realtime) — including the less-obvious cases like blocking students from realtime rooms for privacy reasons, requiring two independent grants before a student officer can create a session, and refusing to let any admin touch another admin's account. The doc-vs-code mismatches found (Better Auth, BullMQ, the "security alert" push) are all cosmetic-to-moderate — the underlying security property each one is supposed to provide is still actually enforced, just via a plainer mechanism than the plan describes.

If you want to go further, the two things I haven't done are (1) actually running the test suite (I read the specs, didn't execute them — would need a Postgres/Redis instance spun up), and (2) load-testing the sync path with a realistic offline-backlog size to see how the sequential-processing-within-a-100-record-batch performs in practice.
