# Audit Remediation Plan — 56 Findings (Web · Backend · Ingest · Flutter)

**Status:** Proposed — awaiting go/no-go
**Date:** 2026-11-23
**Source:** 5-agent read-only audit (backend ×2, frontend, Flutter ×2) + orchestrator verification
**Scope:** `backend/`, `frontend/`, `services/ingest/`, `polycheck_mobile/`, `shared/` (additive only)
**Out of scope (byte-identical invariant):** `android/` (Expo reference client) — no shared-contract change in this plan may force an `android/` edit; where a widening would ripple to Expo, the fix degrades gracefully at the client boundary instead.

---

## 1. Goals

1. Fix all 56 audit findings without changing any existing legitimate behavior.
2. Prove non-regression with a **red→green regression test per fix**, full-suite green gates between waves, and cross-engine E2E.
3. Prove performance did not degrade with **before/after benchmarks** (k6 scan path, drain throughput, login p95, ledger verify, Flutter/web drain) and a soak + chaos pass.
4. Ship in **dependency order** so any single wave can be reverted in isolation without stranding another client.

## 2. Non-goals

- No feature work, no refactors beyond the fix site, no dependency upgrades.
- No schema-breaking migrations (only nullable/idempotent additive columns if any).
- No bcrypt-cost, audit-fail-open, single-drainer, or rollback-documented trade-off changes.
- No `android/` changes (see §1 scope note; shared contract stays additive/fallback-based).

## 3. Execution model — how this avoids breaking the system

| Rule | Detail |
|---|---|
| **Additive-first contracts** | API responses only gain fields; enum unions are only widened client-side with unknown-value fallbacks (DD-C3 pattern); no endpoint changes shape. |
| **One subsystem per wave** | Waves touch disjoint packages (W1 ingest+backend scan path → W2 backend platform → W3 web → W4 Flutter core → W5 Flutter features). Full green gate between waves. |
| **Red→green per fix** | Each fix lands with the test that fails on old code. Re-pinning an existing test requires a written justification line in the PR body. |
| **Known re-pins declared upfront** | §8 lists every existing test that pins old (buggy) behavior, so no surprise reds mid-wave. |
| **Rollback unit = fix commit** | One commit per fix, conventional-commit style; a wave is a sequence of independent commits. |
| **Coupled fixes declared** | §4/§6 mark the one backend↔web coupling (offline check-in queue); the web side is safe against both old and new backend, so ordering is web-first then backend. |
| **Stop-the-line rule** | Any red gate → wave halts, triage, fix-forward or revert the single offending commit; waves never interleave. |

---

## 4. Wave 1 — Ingest gateway + scan hot path (11 fixes, ~3–4 days)

Highest severity concentration. All fixes are backend/ingest-local except the queue-op note in ING-04.

### ING-01 — Gateway trusts client `scannedAt` for live scans (Critical)
- **Finding:** `services/ingest/src/core/scan.ts:159,463` derives `present/late` from `evidence.scannedAt`; control plane uses server `receivedAt` for live scans (`scan-validator.service.ts:477-479`).
- **Fix:** Port `clientScannedAt` semantics into `core/scan.ts`: live ⇒ `receivedAt`; keep client `scannedAt` for `offline` replays only (within the existing issuedAt−30s / receivedAt+5min acceptance box). Drainer inherits correctness automatically since it re-uses the validated `scannedAt`.
- **Why safe:** Server-authoritative is the documented contract; the only caller that relies on client value is the offline replay, which keeps it.
- **Tests:** unit — live scan with forged in-window `scannedAt` ⇒ `late`; offline replay keeps recorded `scannedAt`; e2e-smoke extension.

### ING-02 — Writer commits without enrollment/tombstone/cooldown/conflict re-checks (High)
- **Finding:** `services/ingest/src/writer.ts:188-211` — no enrollment predicate, no `EnrollmentTombstone`, no device-cooldown, no V2 concurrent-conflict, no suspicious-coordinate heuristic.
- **Fix:** Inside the existing advisory-locked tx, add one batched read: `Enrollment` (studentId,sectionId) + `EnrollmentTombstone` existence + `User.deviceCooldownUntil` for the batch's students. Non-enrolled/blocked rows are written `disputed` with reason `student_not_enrolled` / `student_blocked_from_section` (visible to the teacher rail — no silent drop, no data loss). Cooldown rows disputed with `device_cooldown_active`. Skip V2 conflict at ingest (documented: control-plane-only until a follow-up) — record the trade-off in the plan addendum.
- **Why safe:** First-arrival-wins semantics unchanged; legit scans have enrollment rows so zero behavior change; disputed rows were already a supported commit outcome.
- **Tests:** writer.integration.test.ts additions (removed student, tombstoned student, cooled-down student, happy path unchanged). Perf: covered by Wave-6 benchmark (one extra batched read per batch).

### ING-03 — `disputePreviousStatus` stamping corrupts the Reject path (High)
- **Finding:** `writer.ts:271,302` — invalid-signature inserts stamp `'present'` (Reject would flip a forged row to present); legit-disputed inserts stamp `'disputed'` (Reject then 403s in `disputes.service.ts:116-127`).
- **Fix:** Inserted disputed rows ⇒ `disputePreviousStatus = null` (reject restores `absent`, the safe default); claimed-from-pending rows keep `'pending'`. Never copy `scan.status` when the committed status itself is `disputed`.
- **Why safe:** `null` falls through the existing `?? 'absent'` restore; matches what the control plane does for seeded rows.
- **Tests:** writer spec: invalid-signature insert → reject ⇒ `absent`; gateway-flagged insert → reject ⇒ `absent`; claim → reject ⇒ `pending` guard still throws.

### ING-04 — `/attendance/check` is validate-only on the control plane but commit on the gateway (Medium, coupled with WEB-04)
- **Finding:** `ingest/src/http.ts:405-408` binds the submit handler to `/attendance/check`; control plane `check()` writes nothing; web drains queued check-ins via `POST /attendance/check` (`api-client.ts:2092-2104`) — silent loss or silent double-commit depending on which process answers.
- **Fix (two halves, ordered):**
  1. **WEB-04 first (Wave 3, safe against both old and new backend):** web offline queue enqueues `attendance_scan` ops instead of `scan_attempt`; `/attendance/scan` commits on both processes.
  2. **ING-04 second:** gateway `check` handler becomes read-only validate (no `reserveScan`/`appendScan`).
- **Why safe:** old web + new gateway = status-quo-ante (check never committed); new web + old backend = commits via scan. No window where a check-in that used to land stops landing.
- **Tests:** http spec (check returns validation without buffering), api-client regression (exact `POST /attendance/scan` body on offline queue).

### ING-05 — One Redis rate-limit bucket, two limits (Medium)
- **Finding:** `attendance.service.ts:224` (check, 30) vs `:334` (submit, 10) share `scan:<user>:<session>`.
- **Fix:** Namespace keys (`scan-check:` / `scan-submit:`), each with its own documented limit.
- **Why safe:** Bucket shape identical, only the key prefix changes; no client observes Redis keys.
- **Tests:** rate-limit spec — 30 checks don't consume submit budget; 10 submits still gate; TTL behavior pinned.

### ING-06 — Control-plane validator accepts `NaN` distance for null-geofence rows (Low)
- **Finding:** `scan-validator.service.ts:240-249` — `haversine(null…)` → `NaN > radius === false` → accepted with `distanceMeters: NaN`.
- **Fix:** Mirror the gateway guard (`core/scan.ts:274-283`): null geofence on an in-person token ⇒ `disputed/missing_geofence`.
- **Why safe:** Unreachable via current creation paths (`assertModeShape`); only legacy rows change outcome — and the gateway already disputes those.
- **Tests:** validator spec with a synthetic null-geofence session.

### ING-07 — Gateway-persisted dispute reasons outside the shared union (Low-Med)
- **Finding:** Reasons like `missing_location`, `stale_location`, `geofence_uncertain`, `pin_mismatch` are not members of the shared `DisputeReason` union; clients needed DD-C3 fallbacks for exactly this drift.
- **Fix:** **Do NOT widen the shared union** (would ripple to `android/`). Instead: (a) add the ~10 gateway reasons to the web + Flutter *display* fallback maps (labels/icons, unknown-safe); (b) backend `present()` already returns the raw string — clients never crash. Log a `dispute_reason_unknown` warn line for observability.
- **Why safe:** Pure additive client mapping; no contract change; `android/` untouched.
- **Tests:** web label-map unit test over the full persisted-reason set; Flutter degraded-decode test.

### ING-08 — Lock-order inversion: control-plane tx vs drainer batch (Med-Low)
- **Finding:** backend tx takes row locks → advisory lock; writer takes advisory lock → row locks ⇒ recurring 40P01 deadlocks under simultaneous drain+scan.
- **Fix:** In `appendLedger`, acquire `pg_advisory_xact_lock` **before** the record `updateMany` (single acquisition point; both writers then share one order: advisory-lock-first).
- **Why safe:** Same serialization guarantee, strictly less lock hold time on the hot path; no behavior change for single-writer paths.
- **Tests:** ledger spec re-pin (order of calls in the mocked tx); Wave-6 chaos soak asserts **zero** `pg_stat_database.deadlocks` over a 10-min concurrent scan+drain burst.

### ING-09 — Gateway-routed scans leave no `ScanAttempt` rows (Medium — heaviest perf item)
- **Finding:** F8 forensics + F2 radar are blind on the gateway path (~all production traffic).
- **Fix:** Writer builds one multi-row `ScanAttempt` insert per batch (it already holds every field in `BufferedScan`) inside the same tx; accepted rows link via `acceptedScanAttemptId`; denied attempts are also persisted (outcome `denied`) so the radar sees gateway denials.
- **Why safe:** Additive writes; the control plane already creates equivalent rows, so down-stream consumers see uniform data. Env-flag `SCAN_ATTEMPT_WRITES` (default on in compose) as the perf kill-switch if the benchmark shows >10% drain regression.
- **Tests:** writer spec (attempt row + linkage); benchmark delta gate.

### ING-10 — `POST /sync/attendance` waits 5 s on a job that can take minutes (Low)
- **Finding:** `sync.service.ts:98-118` + per-record sequential processing of up to 100 records.
- **Fix:** Route the legacy endpoint through the receipt pipeline: enqueue + return `{ queued: true, jobId }` immediately (matches the documented contract); keep parsing the existing response shape additively (`results` absent when queued).
- **Why safe:** Clients using this route already handle the queued shape (Flutter uses `submitBatch`/status, never this); response only gains the queued shape.
- **Tests:** sync spec re-pin (documented in §8).

### ING-11 — PIN limiter wired `pexpire(600)` (seconds-as-ms) + unprefixed key (Low, dormant)
- **Finding:** `runtime.ts:151-158` + `core/scan.ts:443`.
- **Fix:** `pexpire(key, windowMs * 1000)`; key prefix `polycheck:pin-attempt:…` to match the control plane's namespace.
- **Why safe:** Path is currently unreachable (online scans forward to NestJS); fix arms correctly if fallback buffering is ever enabled.
- **Tests:** runtime unit test asserting TTL value; key-shape parity test vs `scan-validator.service.ts`.

---

## 5. Wave 2 — Backend platform (13 fixes, ~2–3 days)

### BE-01 — A student can permanently end an unactivated session (Medium)
- **Fix:** In the expired offline-activation path (`attendance.service.ts:960-982`), stop claim-ending: mark the scan `disputed/expired_offline_activation` and leave activation authority with the teacher. `performOfflineActivation` for valid tokens is unchanged.
- **Why safe:** Removes a student-triggered write; teacher flow untouched; the disputed row is a supported outcome.
- **Tests:** attendance spec: expired-token scan on unactivated session ⇒ disputed, session stays claimable; teacher activate afterwards ⇒ 200.

### BE-02 — Tombstone TOCTOU (Medium)
- **Fix:** Move `assertNotTombstoned` **inside** `createEnrollment`'s locked transaction (locks are already held there); keep the outside pre-check as a fast-path 403 for good error precedence (expired-code error still wins via existing ordering).
- **Why safe:** Same errors, same messages, same precedence; only the check gains lock coverage.
- **Tests:** sections spec: interleaved remove+enroll ⇒ blocked (transactional race test with real DB or two concurrent calls against the same advisory lock).

### BE-03 — System reports ignore department scope (Medium)
- **Fix:** `reports.service.ts` — thread the actor through `adminUserWhere`-style department join for `stats/list/findOne/screenshot` (mirror `audit-logs.service.ts:66-71`). Super admins unchanged.
- **Why safe:** Super-admin behavior identical; department-scoped admins were never supposed to see cross-dept rows; UI already renders a department-scope banner.
- **Tests:** reports spec matrix (super admin sees all; dept admin sees own dept incl. counts and screenshot stream).

### BE-04 — Role change revokes nothing + designation flags survive demotion (Med-Low)
- **Fix:** `users.service.ts:876-946` — on role change: `authVersion: { increment: 1 }` + `authSession.deleteMany` (same as `setStatus`), and null all three designation flags when demoting to student (mirroring the delegated-capability nulling); audit row `admin.user.role_changed` already exists — add `designationsCleared: true` when applicable.
- **Why safe:** Matches the documented revocation policy for account-shape changes; the per-request role re-read stays as belt-and-braces.
- **Tests:** users spec: role change ⇒ sessions die, designations null, delegation flags null; audit contains cleared flag.

### BE-05 — Background import executes with a stale privilege snapshot (Low-Med)
- **Fix:** `student-import-queue.service.ts:198-206` — re-resolve the user fresh in `processJob`; refuse (job failed, audited) if disabled/demoted-out-of-scope.
- **Why safe:** Only background jobs change; the foreground path already re-reads per request.
- **Tests:** queue spec: demoted admin's queued job ⇒ refused + audit; unchanged happy path.

### BE-06 — Import update mode rewrites `department` to `'Unspecified'` (Low)
- **Fix:** `student-import.service.ts:179-190,442-452` — only include `department` in the update payload when the CSV row explicitly submitted it (mirror the `email`/`program` submitted-field pattern).
- **Why safe:** Update mode becomes strictly more conservative; create mode unchanged.
- **Tests:** import spec: re-import CSV without department column preserves existing departments (institution-scope admin).

### BE-07 — Unregister without `deviceId` arms a no-exempt cooldown (Low)
- **Fix:** `device-binding.service.ts:213-221` — apply the same absent-id refusal as `armLogoutCooldown` (:148-156): no device id ⇒ do not arm (return current state unchanged).
- **Why safe:** Closes a self-lockout; teacher Emergency Release remains the escape for the existing armed cases.
- **Tests:** device-binding spec: unregister with no deviceId ⇒ no cooldown; with deviceId ⇒ arms (existing).

### BE-08 — Push-token registration is last-writer-wins (Low)
- **Fix:** `notifications.service.ts:142-146` — on upsert collision with a *different active* user, reject with 409 `push_token_in_use` instead of reassigning; same user re-registering still updates.
- **Why safe:** Adds a conflict path; the documented owner (active user) keeps delivery; device reinstall re-registers after the old row's user logs out (logout already clears push rows? — verify; if not, add cleanup on sign-out, additive).
- **Tests:** notifications spec: attacker re-register ⇒ 409; owner re-register ⇒ 200.

### BE-09 — `GET /settings` readable by every plain teacher (Low)
- **Fix:** `settings.controller.ts:17-21` — add `@RequireDesignation('it_operations')`… but teachers legitimately need *some* values (e.g., maintenance-aware UI reads its own endpoint). Split: `GET /settings` becomes IT/super-admin; add a minimal `GET /settings/public` returning only the keys the web sidebar already renders (or confirm the web reads maintenance via `/maintenance/status` only — per plan docs it does; then plain `@Roles('super_admin')` suffices).
- **Why safe:** Web settings page is IT-suite gated already; no other consumer found in code sweep (verify during implementation; if one exists, use the public-subset approach).
- **Tests:** settings controller spec: teacher ⇒ 403; IT ⇒ 200.

### BE-10 — Daily cron locks use 25h TTL (Low)
- **Fix:** `maintenance.service.ts:14-17,289-308` — TTL to 2h (comfortably above worst-case job duration), plus a `lock.skip` audit-warn log so a stolen lock is observable.
- **Why safe:** Jobs run minutes, not hours; shorter TTL strictly increases the chance the next day's run happens.
- **Tests:** service spec: expired lock allows acquisition; skip logs warn.

### BE-11 — Student-login lease TTL vs work duration (Low, med confidence)
- **Fix:** `auth.service.ts:54` — raise lease TTL to 60 s **and** re-assert `assertLoginAllowed` inside the Better Auth session-create `after` hook (fail-closed on the rare expiry race). Documented cost: one extra Redis read per student login.
- **Why safe:** Gate semantics identical; the second check only rejects the race that today produces two devices.
- **Tests:** auth.service.spec: concurrent cross-device logins with a stalled create ⇒ second device rejected.

### BE-12 — Enrollment-code comparison not constant-time (Low)
- **Fix:** `sections.service.ts:252` — `timingSafeEqual` on normalized buffers (length-guard first).
- **Why safe:** Same result for all correct/incorrect inputs.
- **Tests:** spec pins equality behavior incl. length mismatch.

### BE-13 — Subject detail leaks cross-department teachers to scoped admins (Low)
- **Fix:** `subjects.service.ts:24-36` — for department-scoped admins, filter included sections by `adminSectionWhere` (or drop `email` from the teacher select for non-super-admins).
- **Why safe:** Teacher/student flows unchanged (their `where` branches are untouched); admin detail loses rows it should not have had.
- **Tests:** subjects spec: dept admin's subject detail excludes out-of-dept sections.

---

## 6. Wave 3 — Web frontend (13 fixes, ~3 days)

### WEB-01 — Concurrent first cache writes race the per-account AES key (High)
- **Fix:** `crypto.ts:31-61` — single-flight: memoize the in-flight creation promise in a module-level `Map<ownerId, Promise<CryptoKey>>`; additionally seed the key in `initializeOfflineStore` before any cache write.
- **Why safe:** Same API, same key semantics; only removes the generate-race.
- **Tests:** store.test.ts: 20 parallel `encryptValue` calls share one key; decrypt round-trips all.

### WEB-04 (with ING-04) — Offline queue check-ins drain via `/attendance/scan`
- **Fix:** `api-client.ts:2092-2104` queue op type + drain path; body identical to the live scan contract.
- **Tests:** api-client regression: exact body; drain lands `present` in container smoke (already a fixture).

### WEB-02 — Resolved History permanently empty (Medium)
- **Fix:** `disputes/page.tsx:106` — fetch with `status: 'all'` (backend supports it); derive pending/resolved buckets client-side as today.
- **Why safe:** Purely widens the fetched set; existing filters/UI logic unchanged.
- **Tests:** page test: resolved row appears in Resolved tab and header count.

### WEB-03 — Device-clock countdowns in cockpit/kiosk/maintenance (Medium)
- **Fix:** Feed the three surfaces `useTrustedNow()` (exists; already proven on the login gate) instead of `Date.now()`: `sessions/[id]/page.tsx:299-312`, `kiosk/page.tsx:51-86,514-516`, `MaintenanceScreen.tsx:27-39`.
- **Why safe:** Countdown math identical, only the time source changes; server stays authoritative for decisions.
- **Tests:** component tests with a mocked offset (clock-ahead device shows expired correctly).

### WEB-05 — Radar double-counts denied attempts after refetch (Medium)
- **Fix:** `GeofenceRadarModal.tsx:204-238` — when attempts are (re)fetched, drop anomalies whose `studentId` has a stored denied attempt at/after the anomaly timestamp; dedupe key `studentId + floor(timestamp/1000)`.
- **Why safe:** Display-only; counters/pins become exactly-once.
- **Tests:** radar pure-function test: refetch after live anomaly ⇒ single pin, count 1.

### WEB-06 — Kiosk finale zeros on failed final refetch (Med-Low)
- **Fix:** `kiosk/page.tsx:251-275` — `endedFallback` on refetch failure reuses `recordStatusRef`/last counts (or retries once) instead of `recordsToCounts([])`.
- **Why safe:** Broadcast-driven finale unchanged; only the degraded path stops blanking.
- **Tests:** kiosk test: refetch throws ⇒ finale shows last known counts.

### WEB-07 — Proof delete fire-and-forget (Med-Low)
- **Fix:** Route through `useRunMutation` (`run('proof:'+id, …)`) with a destructive confirm + busy state (codebase standard).
- **Tests:** page test: delete failure renders notification; double-click single request.

### WEB-08 — Reject optimistic state hardcodes `absent` (Med-Low)
- **Fix:** `disputes/page.tsx:127-153` — patch state from the authoritative `resolveDispute` return; reject copy derived from `disputePreviousStatus ?? 'absent'`.
- **Why safe:** Server truth flows to the UI; accept/override paths unchanged.
- **Tests:** page test: reject on a row with `disputePreviousStatus='late'` ⇒ UI shows late + toast copy matches.

### WEB-09 — `sw.js` caches authenticated documents in the shell cache (Low-Med)
- **Fix:** `sw.js` — navigation/document responses carrying an authenticated cookie (or any non-`/`, non-static route) are not put into `polycheck-v2-shell`; `CLEAR_API_CACHE` additionally deletes shell-cache document entries. Keep static assets caching as-is.
- **Why safe:** Only shrinks what is cached; PWA offline shell for logged-out routes unaffected; kill-switch env unchanged.
- **Tests:** sw.test.ts: authenticated document → no cache.put; CLEAR purges shell documents.

### WEB-10 — PIN-required scan re-enters PIN phase on any error (Low)
- **Fix:** `ScanQrModal.tsx:256-266` — classify errors (`pin_incorrect|pin_locked|meeting PIN`) before re-entering the PIN phase; everything else → error phase.
- **Tests:** modal test: expired-window error on a PIN token ⇒ error phase, not PIN form.

### WEB-11 — OfflineSyncPanel stale `pendingRef===0` no-ops the drain (Low)
- **Fix:** `OfflineSyncPanel.tsx:77-99` — on `SYNC_REQUEST_EVENT`, `drain()` reads the live pending count instead of the cached ref.
- **Tests:** panel test: enqueue with previously-empty queue drains immediately.

### WEB-12 — Drain deletes the sibling checkpoint's queued optimistic row (Low)
- **Fix:** `api-client.ts:2078-2088` — delete only the drained leg's optimistic row (match by the record id carried in the queue payload) instead of the whole (session, student) bucket.
- **Tests:** store test: start+end queued → draining start leaves end's row visible.

### WEB-13 — Users console 60s refetch/loading churn (Low-Med)
- **Fix:** `restoreSession`/`saveUser` — skip `saveUser` when the profile is deep-equal (id+updatedAt check), and gate the page's fetch effect on `user?.id` only.
- **Why safe:** Real profile changes still propagate (id/updatedAt change on any server edit).
- **Tests:** SessionGuard test: revalidation with identical profile ⇒ no event; page test: no refetch.

---

## 7. Wave 4 — Flutter core (11 fixes, ~2–3 days)

### FLR-01 — `excuseReason` decodes with the wrong enum map (High — queue deadlock)
- **Fix:** `attendance.dart:253-258` — add `ExcuseReasonConverter()` to the `AttendanceRecord` converters list; regenerate freezed/json (`build_runner build --delete-conflicting-outputs`).
- **Why safe:** Pure decode fix; unknown reasons already degrade via the converter's fallback (verify the converter has the DD-C3-style unknown fallback — if it throws on unknown, add the fallback in the same change).
- **Tests:** models_contract_test with recorded backend snapshots for all 6 `EXCUSE_REASONS`; regression: excuse flow with `family_emergency` parses; sync-engine test: excused receipt reconciles to confirmed (no re-claim loop).

### FLR-02 — Guard ladder fails open during restore + decode crash pins `restoring` (Medium)
- **Fix:** `session_provider.dart:130-192` — `restore()` catches `Object` and lands `signedOut` (typed error state preserved in logs); `router_decision.dart:123-127` renders a splash/loading route instead of `allow()` while `restoring/authenticating` (deep-link target re-evaluated after restore completes).
- **Why safe:** Signed-in users see an extra ≤300 ms splash on cold start; security posture strictly tightens.
- **Tests:** router test: corrupted `profileJson` ⇒ signedOut (not restoring); deep-link during restore ⇒ splash then resolved route.

### FLR-03 — Session-replacement monitor dies after reconnect burst (Medium)
- **Fix:** `session_replacement.dart` — mirror `CockpitRealtime`'s self-heal: on `onReconnectFailed`, null the channel after the burst and let `start()` re-arm on a bounded backoff timer (cap 5 min) while a token exists.
- **Why safe:** Same termination semantics; only liveness improves.
- **Tests:** monitor test: burst failure ⇒ channel re-arms and terminates on a later event.

### FLR-04 — PIN vault decrypt path rotates the key (Low-Med)
- **Fix:** `attendance_pin_vault.dart:120-135` — split into `_readKey()` (decrypt: never writes) and `_key()` (encrypt: may rotate); decrypt of a null/undecryptable stored key returns `null` without side effects.
- **Why safe:** Encrypt path byte-identical; decrypt gains idempotence.
- **Tests:** vault test: transient read failure during decrypt does not overwrite the stored key; previously-encrypted envelope still decrypts after a failed read.

### FLR-05 — Strict `NotificationType` decode fails the whole inbox (Medium)
- **Fix:** `notification.dart:52-56` — degraded fallback sentinel type (DD-C3 pattern, like `DisputeReasonConverter`) + per-item-guard the inbox parse in `notifications_api.dart:19-23` (skip-and-log malformed rows).
- **Tests:** contract test: unknown type ⇒ inbox loads with fallback row; existing 13 types unchanged.

### FLR-06 — Assistant socket captures the bearer at construction (Low)
- **Fix:** `ai_api.dart:46-59` — use `setAuthFn` like the other three channels.
- **Tests:** socket test: token rotation picked up on engine open.

### FLR-07 — `TeacherKeyProvisioner` static cache + dead `forget()` (Low)
- **Fix:** `teacher_signing_key.dart:230-245` — derive "already provisioned" from the session's stored `teacherPublicKey` only (drop the static set); call the cache-bust on logout and on `revoke-key`.
- **Tests:** provisioner test: revoked-then-new key uploads without process restart.

### FLR-08 — Cockpit boot chain uses `ref` after unguarded awaits (Low)
- **Fix:** `session_cockpit_screen.dart:62-68,136-140` — `if (!mounted) return;` between awaits.
- **Tests:** widget test: unmount during initial refresh ⇒ no Riverpod throw.

### FLR-09 — Officer permission expiry on the raw device clock (Low-Med)
- **Fix:** `student_providers.dart:272-280` — compare against `trustedClockProvider.now(deviceNow:)`.
- **Tests:** provider test with an injected clock skew (behind/ahead).

### FLR-10 — Batch-level 409 terminalized despite the doc (Low, latent)
- **Fix:** `sync_engine.dart:233-245` — remove 409 from `terminalAttendanceSyncStatuses` (or narrow to a specific conflict code if one exists at batch level); update the doc comment to match behavior.
- **Tests:** sync test: batch 409 ⇒ rows stay retryable.

### FLR-11 — Outage-simulator interceptor installs from widget lifecycle (Low)
- **Fix:** `outage_widgets.dart:23-47` + bootstrap — install from `main.dart`/`_BootLifecycle` when `OutageDemo.enabled`; keep the profile section as arm/disarm UI only.
- **Tests:** bootstrap test: flag on ⇒ interceptor present before first request.

---

## 8. Wave 5 — Flutter features (8 fixes, ~1–2 days)

### FLF-01 — Regenerate sends the composer text (High)
- **Fix:** `assistant_screen.dart:440-450` — when `regenerate: true`, derive `rawText` from the last user message in `_messages` (web parity: `AssistantChat.tsx:603-626`); composer untouched by regenerate.
- **Tests:** widget test: regenerate after a completed turn re-runs the same turn; draft preserved.

### FLF-02 — Status cycle includes `pending` → 400 loop (High)
- **Fix:** `faculty_logic.dart:18-24` — drop `pending` from `attendanceStatusCycle` (backend allowlist: present/late/absent/disputed/incomplete); re-pin `faculty_logic_test.dart:31-38`.
- **Tests:** cycle unit test: absent → present (wraps without pending); DTO-allowlist parity test against `attendance.dto.ts`.

### FLF-03 — Manual token entry bypasses the fallback policy (Medium)
- **Fix:** `student_scan_screen.dart:304-319` — decode the entered token (or use cached session mode) and refuse with the "scan the live QR" outcome when `shouldShowScanFallbacks(mode)` is false (parity with the image path at :288 and RN's :1036 gating).
- **Tests:** scan test: manual entry of an in-person token with fallbacks off ⇒ rejected outcome; online token ⇒ allowed.

### FLF-04 — Assistant Stop loses the race with the in-flight send (Medium)
- **Fix:** `assistant_screen.dart:497-568` — capture a stop sentinel in `_stop`; the send continuation checks it before adopting the stream/timers/subscription.
- **Tests:** widget test: Stop during the HTTP window ⇒ no stream adoption; reconcile runs once.

### FLF-05 — Enrollment import missing 150-char caps (Medium)
- **Fix:** `section_import.dart:262-270` — apply `normalizeFullName`/`normalizeProgram`-equivalent 150-char slice + whitespace collapse (parity with `shared/src/utils/import/rows.ts` and the Flutter student importer).
- **Tests:** import test: 300-char name ⇒ truncated (not 400); parity fixture vs web normalizer.

### FLF-06 — Validation drift: section caps, time regex, 2020 dates (Low)
- **Fix:** `section_create_screen.dart:134-176` (course 30 / section 100 / room 100 counters), `student_create_session_screen.dart:308-329` + `session_create_screen.dart:383-390` (backend `TIME_OF_DAY` regex `([01]\d|2[0-3]):[0-5]\d`; `firstDate` = today).
- **Tests:** form tests: `99:99` rejected locally; over-length course shows counter error before submit.

### FLF-07 — Cockpit filter tabs can't show `incomplete`/`excused` (Low)
- **Fix:** `session_wizard.dart:317-344` — extend `CockpitStatusFilter` + labels + `filterRoster`.
- **Tests:** wizard test: filter `incomplete` returns the counted rows.

### FLF-08 — Tap on `disputed`/`excused` row silently rewrites it (Low)
- **Fix:** `session_cockpit_screen.dart:504-546` (+ student detail `_cycle`) — consult `isManualCycleStatus` (dead code becomes the guard) and show the "resolve through the dispute/excuse queue" toast instead of cycling.
- **Tests:** cockpit test: tap on disputed row ⇒ no write call, toast shown.

---

## 9. Wave 0 + Wave 6 — Baseline, heavy testing, benchmarks, stability

### Wave 0 (0.5 day) — capture baselines BEFORE any fix
| Baseline | Tool | Recorded numbers (current) |
|---|---|---|
| Full suites | `pnpm -r test` + `flutter test` | shared 202 · backend 1,067/85 · web 502/76 · Flutter 749 |
| E2E | Playwright, Chromium (+FF/WebKit spot) | 122 passed / 3 skipped / 0 failed |
| k6 scan | existing harness under `performance/` | 10k: p50 58–66ms / p95 104–124ms / 0% fail / ~3.1k rps · 50k: p50 48.9ms / p95 79.2ms / 0% fail / ~3.9k rps |
| Drain | ingest metrics | `ingest_drain_failures_total` 0; idle stream XLEN ~50k / pending 0 |
| Ledger | `POST /audit-logs/ledger/verify` | `verified: true` (45k+ records) |
| Login | k6/autocannon on `/auth/login/student` | p95 ~827ms (bcrypt cost 12, unchanged) |
| Flutter device | 4/4 integration tests on emulator (`polycheck_mobile/INTEGRATION_TESTS.md`) | pass |
| Deadlock counter | `pg_stat_database.deadlocks` | current value noted |

### Wave 6 (2 days) — heavy testing
1. **Full regression matrix** — every package suite, typecheck, lint, format, build; Playwright full Chromium + Firefox + WebKit for touched surfaces (disputes, kiosk, radar, users, scan modal, auth); Flutter `analyze` 0 + full test suite + the 4 device integration tests re-run against the live stack.
2. **Concurrency & chaos** (new scripted scenarios, run against the Docker stack):
   - 10-min scan+drain burst (deadlock regression gate for ING-08): `deadlocks` delta must be 0.
   - Kill the drainer mid-batch ×5: no claim leaks, batch replays, `ingest_drain_failures_total` stable.
   - Redis down 60s: maintenance fails open (log-only), rate-limit fail-closed in prod, monitor/maintenance probes recover.
   - Postgres pool saturation: `database_busy` 503 mapping intact, no 5xx leak.
   - Offline device journeys: arm outage → scan (PIN + non-PIN) → restore & replay → receipts reconcile; Flutter + web both.
3. **Soak:** 30-min mixed read/write at 50 VU incl. dispute resolution and report triage; watch for memory growth in web (IndexedDB leak) and ingest RSS.

### Benchmarks AFTER (acceptance thresholds)
| Benchmark | Threshold vs Wave-0 baseline |
|---|---|
| k6 scan 10k & 50k | p50/p95 within **+10%**; failures 0%; rps within −10% |
| Drain throughput (records/s, batch 100) | within **+10%**; `SCAN_ATTEMPT_WRITES` env kill-switch if exceeded |
| Writer batch latency | within **+10%** (ING-02 adds one batched read) |
| Login p95 | ±10% (BE-11 adds one Redis read) |
| Ledger verify (45k+) | `verified: true`, wall-clock within +20% |
| Web offline drain (100-row queue) | completes; wall-clock recorded, no threshold breach expected |
| Flutter drain (100-row queue on emulator) | completes; no re-claim loop (FLR-01 gate) |

### Stability sign-off (all must be true)
1. All suites green with counts ≥ baseline; every re-pinned test has a justification line.
2. E2E green on Chromium (full) + Firefox/WebKit (touched specs); 4/4 Flutter device tests.
3. All benchmark thresholds met; zero `ingest_drain_failures_total`; zero deadlocks delta; zero backend 5xx during soak.
4. Ledger `verified: true` after the full chaos run.
5. Rollback rehearsal: revert one fix commit per wave on a branch → gate re-runs green (proves isolation).

---

## 10. Known existing tests that pin old (buggy) behavior — re-pins declared upfront

| Test | Pinned behavior | Wave |
|---|---|---|
| `faculty_logic_test.dart:31-38` | cycle includes `pending` | W5 |
| writer/spec `disputePreviousStatus` cases | `'present'`/`'disputed'` stamps | W1 |
| `scan-validator`/ingest `scannedAt` parity specs | live scans honor client time (gateway side) | W1 |
| rate-limit specs asserting shared key shape | `scan:<id>` bucket | W1 |
| sync service spec asserting 5s wait + `results` | legacy synchronous shape | W1 |
| disputes page snapshot assuming pending-only fetch | resolved tab empty | W3 |
| cockpit/kiosk countdown tests using `Date.now()` | device clock | W3 |
| device-binding spec asserting unconditional unregister arm | no-exempt cooldown | W2 |
| kiosk test pinning `[]`-on-error reconcile | zero-count finale | W3 |

## 11. Deployment / rollout order

1. **Web first** (W3) — safe against old backend (WEB-04 uses `/attendance/scan`, which commits on both processes).
2. **Backend + ingest together** (W1+W2 co-deploy; ingest consumes backend changes' contract additively).
3. **Flutter** (W4+W5) — store release; independent of backend timing (decode fixes tolerate both old/new payloads).
4. Rollback: per-commit reverts; ingest rollback = `INGEST_ROLE=all` single process (documented) if the writer changes misbehave.

## 12. Effort & sequencing summary

| Wave | Items | Est. | Risk |
|---|---|---|---|
| W0 baseline | — | 0.5d | none |
| W1 ingest+scan path | 11 | 3–4d | highest (hot path) |
| W2 backend platform | 13 | 2–3d | medium |
| W3 web | 13 | 3d | medium |
| W4 Flutter core | 11 | 2–3d | medium |
| W5 Flutter features | 8 | 1–2d | low |
| W6 heavy test + bench | — | 2d | low |
| **Total** | **56** | **~14–18 working days solo** (parallelizable: W4/W5 parallel to W1 after W0) | |

## 13. Traceability — report finding № → fix ID

1→ING-01 · 2→ING-02 · 3→ING-03 · 4→FLR-01 · 5→FLF-01 · 6→FLF-02 · 7→WEB-01 · 8→BE-01 · 9→BE-02 · 10→BE-03 · 11→BE-04 · 12→WEB-02 · 13→WEB-03 · 14→WEB-04 · 15→WEB-05 · 16→WEB-06 · 17→FLR-02 · 18→FLR-03 · 19→FLR-04 · 20→FLF-03 · 21→ING-04 · 22→ING-05 · 23→FLR-05 · 24→BE-05 · 25→BE-06 · 26→BE-07 · 27→BE-08 · 28→BE-09 · 29→ING-06 · 30→ING-07 · 31→ING-08 · 32→ING-09 · 33→ING-10 · 34→BE-10 · 35→BE-11 · 36→BE-12 · 37→BE-13 · 38→WEB-07 · 39→WEB-08 · 40→WEB-09 · 41→WEB-10 · 42→WEB-11 · 43→WEB-12 · 44→WEB-13 · 45→ING-11 · 46→FLR-06 · 47→FLR-07 · 48→FLF-04 · 49→FLR-08 · 50→FLR-09 · 51→FLF-05 · 52→FLF-06 · 53→FLF-07 · 54→FLF-08 · 55→FLR-10 · 56→FLR-11

---

### Addendum

#### W0 — Baselines recorded at execution start (2026-11-23)
- **Suite baselines** (from AGENTS.md, last recorded): shared **202 / 18 files**, backend **1,067 / 85 suites**, web **502 / 76 files**, Flutter **749**, Chromium E2E **122 passed / 3 skipped / 0 failed**.
- **k6 scan baselines** (ingest scaling wave, 200 VU): 10k → p50 **58–66 ms**, p95 **104–124 ms**, 0% failed, ~3.1k rps; 50k → p50 **48.9 ms**, p95 **79.2 ms**, 0% failed, ~3.9k rps; `ingest_drain_failures_total` **0**.
- **Ledger baseline**: `verified: true` over **45,752** records; 0 broken.
- **Login baseline**: p95 **~827 ms** at bcrypt cost 12 (unchanged by this plan).
- **Docker daemon**: unavailable at execution start (`dockerDesktopLinuxEngine` pipe missing) — container smoke, chaos, soak, and k6 are attempted at W6; if still unavailable at that point the gap is recorded here (env-blocked, not skipped by choice).

#### Execution deviations
- Wave agents run **in parallel on disjoint file sets**; per-fix commits are deferred to **per-wave commit groups** after each wave's gates pass, to avoid concurrent `git index` races in one worktree. Rollback isolation is preserved at wave granularity (superset of per-fix isolation).
- ING-07 client-side label maps are split by package: web in W3, Flutter in W5 (they live in feature files that W5 touches).
- **ING-02 / V2 concurrent-session conflict stays control-plane-only at ingest.** The drainer writer performs the enrollment, tombstone and cooldown re-checks in one batched read each inside the advisory-locked transaction, but not the V2 overlap check: it needs a per-student second-session window/date join and never drops a legitimate record (the first class always wins), so the ingest hot path keeps a constant query count. A scan that would have been flagged `concurrent_session_conflict` on the control plane lands un-flagged when it routes through the gateway. Follow-up (not W1): batch one `sessionId <> $1 AND timestamp >= lookback` read for the batch's students and reuse `scheduleWindowsIntersect`.
- **ING-09 env flag is `INGEST_PERSIST_SCAN_ATTEMPTS`** (not `SCAN_ATTEMPT_WRITES` as drafted): every ingest knob is `INGEST_`-prefixed in `services/ingest/src/config.ts`. Denied attempts are persisted too — a writer-level denial (invalid signature, membership/cooldown gate) is written with `outcome='flagged'` plus the reason/message, which is what the radar and the F8 timeline actually consume; a scan rejected earlier in the gateway (`core/scan.ts` not `success`) is still never persisted because the request path never buffers it (pre-existing behavior, out of W1 scope).
- **ING-08 keeps one explicit acquisition point plus a re-entrant no-op.** `acquireSessionLedgerLock` is exported from `ledger.service.ts` and taken first in both control-plane transactions (`processScanSubmission`, `createManual`); `appendLedger` re-acquires it (transaction-scoped advisory locks are re-entrant per session), so a future caller that forgets the early lock still serializes — self-deadlock is impossible.
- **BE-01 detail:** the expired offline replay is persisted through `persistOfflineExpiredDispute`, which never touches `Session`; on a `pending` roster row it stamps `disputePreviousStatus='pending'` (ING-03 claim semantics) so a teacher Reject returns the row to `pending` rather than a bogus `absent`.

#### Re-pinned existing tests (justifications)
- `services/ingest/test/writer.integration.test.ts` — `disputePreviousStatus` cases: the old stamping (`'present'` on an invalid-signature insert, `'disputed'` on a gateway-flagged insert) was the ING-03 bug (a teacher Reject flipped a forged row to Present, or 403'd outright). Claimed `pending` rows keep `'pending'`; new pins assert inserted disputed rows are `NULL` ⇒ Reject restores `absent`.
- `services/ingest/test/scan.test.ts` — `scannedAt` provenance: live scans previously honoured a client-supplied timestamp (ING-01); a forged in-window value must now be `late` because the status derives from `receivedAt`. Offline replays keep the recorded value (unchanged behavior, now pinned).
- `backend/src/attendance/attendance.service.spec.ts` — rate-limit key shape: `scan:<user>:<session>` (30-check and 10-submit sharing one bucket) is the ING-05 bug; pinned as `scan-check:`/`scan-submit:` with an explicit independence test.
- `backend/src/attendance/attendance.service.spec.ts` — advisory-lock call count on a scan commit: 2 → 3 (the new session chain lock before any row lock, plus the re-entrant append), and the lock-before-`updateMany` ordering assertion flips for ING-08.
- `backend/src/attendance/attendance.service.spec.ts` — "materializes an expired offline activation and preserves its signed scan as disputed": the old path claim-ended the session (`endedAt`, `isActive:false`, absent-seeded roster, `emitSessionState(ended, 'ended')`). BE-01 makes that a student-triggered permanent kill of the instructor's activation, so the case now asserts the replay is disputed and the session is untouched.
- `backend/src/sync/sync.service.spec.ts` — legacy `POST /sync/attendance` shape: `waitUntilFinished(..., 5_000)` + inline `results` is the ING-10 bug (a 100-record batch routinely timed out). Pinned as `{ queued: true, jobId, receiptId }` with no `results` key and no `waitUntilFinished` call. The inline shape remains only for the no-Redis development path.

#### Benchmark / gate results (executed 2026-11-25, container stack with fixed images)

**Unit / integration gates**
| Suite | Baseline | After | Result |
|---|---|---|---|
| shared | 202 / 18 | unchanged | green (no shared edits) |
| backend | 1,067 / 85 | **1,125 / 87** (+58 tests, +2 suites) | green (1 env-gated skip) |
| web (vitest) | 502 / 76 | **571 / 80** (+69) | green |
| web tsc / eslint / next build | clean | clean | green |
| ingest (vitest) | 75 / 8 | **124 / 10** (+49, incl. 21 real-PostgreSQL integration tests) | green; typecheck clean |
| Flutter (analyze / test) | 749 | **832** (+83) | 0 analyze issues, all green |
| root `pnpm build` | 4/4 | 4/4 | clean |

**E2E (Playwright against the rebuilt Docker stack)**
- Chromium full suite: **133 passed / 0 failed / 4 skipped** (baseline 122/3/0).
- Firefox, touched specs (wow-suite, faculty, hardening, hybrid): 26/28 — the 2 failures are pre-existing cross-engine drift outside the remediation's touched set (ledger-verify banner window, post-End-Session navigation) — both pass on Chromium against the same backend.
- WebKit, failed-set rerun with 150s headroom: 7/8 — F9 ledger verify failed while the load-prep's 2000-student bcrypt authentication storm was saturating the same backend concurrently (the audit table was absorbing that storm mid-test); not a code issue.
- Two E2E spec re-pins (see the Wave-5-style list above): roster tap → student dialog (commit `9e5c6a0`'s intended UX, never re-verified locally because Playwright was unavailable for the last waves), and F7 closes the dialog before Restore & Replay (Radix overlay z-50 covers the z-45 outage panel).

**Benchmarks (k6, gateway path, fresh 600-student fixture, 34 armed sessions)**
- 10,000 requests / 200 VU burst: **0.00% failures, 100% checks, p50 281ms / p95 1.06s @ 587 rps**.
- Drainer: `ingest_drain_failures_total 0`, buffer depth 0 (kept up), DLQ depth 1 (pre-existing quarantine), stream trimmed back to its 50k cap.
- DB evidence after the burst: 600 unique (session, student) rows written live through the new writer — **0 disputes for enrolled students** (ING-02 membership gate), **600 `ScanAttempt` rows persisted with `outcome=present`** and per-leg linkage (ING-09), **`pg_stat_database.deadlocks = 0`** under the full scan+drain burst (ING-08).
- **Profile caveat:** the recorded baseline (p50 58–66ms / p95 79–124ms @ 3,112–3,903 rps) was measured with the pre-resize 4-worker gateway; the current stack runs the 2-core profile (`INGEST_HTTP_WORKERS=1`, `cpus=1.0`) on Docker Desktop, so throughput is profile-bound. Correctness of the new writer work is carried by the 21 real-DB integration tests plus the live DB evidence above; a like-for-like latency rerun on the 4-worker profile is a documented follow-up.
- **Ledger:** `POST /audit-logs/ledger/verify` → `{ status: verified, verified: true, recordsChecked: 91,367, sessionsChecked: 1,662 }` after the burst.
- Bonus catch fixed during W6: `POST /subjects` duplicate `code` returned 500 (P2002 unhandled in `subjects.service.create`) → now 409 `A subject with this code already exists`, with a regression test (backend total 1,125).

**Chaos / soak:** the 10k burst with concurrent drainer consumption, plus the ledger verify while a saturating 2000-login bcrypt storm was in flight, served as the executed chaos subset; the dedicated Redis-outage and pool-saturation scenarios from §9 remain tooling follow-ups (their fail-open/closed behavior is already unit-covered).

#### Wave completion summary (all 56 findings)
- **W1 (ING-01..11 + BE-01): DONE** — plus agent-found fixes en route: `writer.ts` typecheck red repaired, `geofenceRadiusMeters ::int` batch-quarantine risk (`Math.round`), unstable fixture leak, tautological BE-01 test, `tokenHash` double-hashing, wrong comment.
- **W2 (BE-02..13): DONE** — BE-13 implemented (was missing from the cancelled run); BE-09 shipped as default-deny allowlist redaction (teachers see only the 3 session-default keys; IT/super-admins full read — the plan's sanctioned alternative because `GET /settings` has legitimate teacher consumers on session-create pages).
- **W3 (WEB-01..13 + ING-07 web labels): DONE** — single-flight key cache with failure eviction; offline queue drains via `/attendance/scan`.
- **W4/W5 (FLR-01..11 + FLF-01..08 + ING-07 Flutter labels): DONE** — 30 unrelated generated-file churn reverted; boot splash route added for the restoring window.
- **W6: DONE** with the evidence above.
