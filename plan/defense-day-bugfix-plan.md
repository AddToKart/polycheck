# Defense-Day Bugfix Plan (DD) — Flutter + Web sweeps & the Offline Engine

> **Status:** Proposed — not started. Evidence: three parallel specialist audits
> (mobile-engineer x2, frontend-ui-engineer x1, backend-systems-engineer x1) plus a
> live dry-run of both offline engines (throwaway tests, since deleted; baseline
> suites green). This plan supersedes the ad-hoc fix lists in those audits.
>
> **Amended 2026-11-12** by a fourth, read-only cross-surface sweep
> (backend + web + Flutter + `@polycheck/shared`, four parallel specialists).
> It added `DD-C3`, `DD-B1..DD-B7`, `DD-W25..DD-W28` and `DD-F19..DD-F21`, and
> **corrected one false "do NOT chase" claim** (see the Flutter offline note
> below). Thirteen of the plan's pre-existing items were re-confirmed unchanged.
>
> **The headline:** offline attendance in the Flutter app is genuinely broken — the
> mechanics work, but every offline replay lands DISPUTED server-side
> (`missing_scan_evidence`) because the batch payload omits `inputChannel` +
> `locationCapturedAt`. The web offline engine works (proven end-to-end by an
> 11-test dry run) but has clock-drift, accuracy-wall, and phantom-record defects
> that will bite on a real device.

---

## 1. Verified bug inventory (four audits + two offline dry runs)

### Flutter — offline engine (THE fix)

| # | Defect | Evidence (file:line) | Dry-run proof |
|---|---|---|---|
| DD-F1 | Replay batch omits `inputChannel` — backend `missingCoreEvidence` gate stamps every replayed record `disputed / missing_scan_evidence` (all three arcs: in-person, PIN, online-checkpoint) | `sync_engine.dart:137-166` builder; `app_database.dart:193-224` schema has no column; backend gate `scan-validator.service.ts:318-339` | Dry-run printed exact payloads: no `inputChannel` on any row |
| DD-F2 | Replay batch omits `locationCapturedAt` (in-person) — second `missingCoreEvidence` branch adds a second dispute | same builder/schema; scan service already computes it live (`student_scan_service.dart:390`) but `enqueueAttendanceScan` (:506-521) has nowhere to put it | `payload.containsKey('locationCapturedAt') isFalse` on every row |
| DD-F3 | Silent-dispute masking: server returns disputed records as success-with-record, so the engine marks the row CONFIRMED and the dashboard toast says "1 check-in synced" while the cached record is disputed | `sync_engine.dart:426-432`; server `attendance.service.ts:589` | Dry-run row: disputed record resulted in row CONFIRMED, report "confirmed: 3" |
| DD-F4 | Parity break vs RN/web: both enqueue and replay the entire original payload (`android/services/api-client.ts:1274-1358` to `:1936`; web `api-client.ts:1369`); Flutter normalizes into a drift row and strips evidence at rebuild | code comparison | — |

Verified working (do NOT chase): `teacherPublicKey` reaches students (`present()` includes it for all roles); in-person lazy activation arms correctly; migration v1 to v2 + PIN cold-start decrypt proven; receipt timeout stays retryable, never stuck; 401 release; terminal retention.

**Corrected 2026-11-12 — two prior "verified" claims were wrong:**
- ~~"staleness on replay is NOT a rejection risk; late arrivals get the by-design `delayed_offline_sync` dispute"~~ — true **in-person only**. For `online` sessions the armed-token check (`scan-validator.service.ts:173-176`) runs **before** the delayed-sync branch (`:296-317`), and `end()`/the cron null `startQrToken`/`endQrToken`. So an offline online check-out replayed after the class closed is rejected `absent / checkpoint_not_armed` ("This checkpoint has not been opened yet") and the evidence is discarded — never `delayed_offline_sync`. **→ DD-B4.**
- ~~"in-person lazy activation works"~~ — it arms, but never sets `autoEndAt`, so the session is invisible to the auto-end cron and every roster row stays `pending` forever. **→ DD-B1.**

### Flutter — earlier sweep findings (prior audits, still open)

| # | Defect | Evidence |
|---|---|---|
| DD-F5 | Faculty schedule day-sheet/event cards pop with the CALLER context while the sheet rides the root navigator — the sign-out crash class, missed on this screen | `faculty_schedule_screen.dart:211,251`; shell nesting via `faculty_routes.dart:103-110` |
| DD-F6 | Dispute override offers `excused` — backend `ResolveDisputeDto` allowlist rejects it, producing a 400 mid-demo | `faculty_disputes_screen.dart:694-699` vs `disputes.controller.ts:31` |
| DD-F7 | Cockpit 1 Hz ticker never cancelled — leaks + full-roster rebuild every second after session end | `session_cockpit_screen.dart:79-86,72-77` |
| DD-F8 | Cockpit realtime gives up after 8 x 1s reconnect — no self-heal; radar/anomaly stream stays dead after a network blip | `cockpit_realtime.dart:37` |
| DD-F9 | `retryOne` mid-drain is a soft no-op when the single-batch loop is already running (multi-batch re-query partially works) | `sync_engine.dart:621-654` |
| DD-F10 | At-risk: setState after await without a mounted guard; non-ApiRequestError escapes `_fileReferral`/`_downloadNotice` | `faculty_at_risk_screen.dart:318-326,368-379` |
| DD-F11 | Torch icon desyncs from the real torch state | `student_scan_screen.dart:291-301` |
| DD-F12 | Outage "Restore & replay" does not trigger a drain (up to 30 s wait) | `outage_widgets.dart:179-195` |
| DD-F13 | Cockpit `finally` block fires `await _refresh()` after unmount | `session_cockpit_screen.dart:526-529,562-565` |
| DD-F14 | Month-view fetch catches only ApiRequestError — other errors render silently empty with no retry | `student_month_calendar.dart:337`, `student_schedule_screen.dart:147` |
| DD-F15 | `NotificationRealtime.start()` fire-and-forget without try/catch (zone error noise) | `notification_realtime.dart:26-40` |
| DD-F16 | Offline prep steps 3-6 catch only ApiRequestError | `offline_readiness.dart:198-252` |
| DD-F17 | End-session summary counts disputed/excused as pending | `session_wizard.dart:266-296` |
| DD-F18 | Sockets capture the bearer at construction; mid-session rotation leaves reconnects stale | `cockpit_realtime.dart:36`, `notification_realtime.dart:37`, `session_replacement.dart:198` |
| DD-F19 | **Data loss.** Any batch-level HTTP 4xx terminalizes **every row in the batch**, permanently: `sync_engine.dart:529-537` handles only 401/503-maintenance/429 as retryable, then `markQueueFailed(serverError: 'terminal: …', incrementRetry: false)`; `isAttendanceRetryEligible` (`:119`) refuses `terminal:` forever. Routine trigger: `SyncController` is `@RequiresPrivacyConsent()`, so a `PRIVACY_NOTICE_VERSION` bump 403s the whole batch and up to 25 queued check-ins die — and accepting the new notice cannot recover them. Second trigger: one bad record (session/section deleted server-side) `throw`s inside the record loop (`attendance.service.ts:417,423,451`) and terminalizes the whole batch including valid rows | `sync_engine.dart:529-537,119`; `backend/src/common/guards/privacy-consent.guard.ts:26`; `backend/src/attendance/attendance.service.ts:417,423,451` |
| DD-F20 | Location-staleness tolerance is 30 s looser than the server because it is applied to **both** bounds (`age > maxAge + tolerance` = 150 s vs the server's 120 s). A fix aged 120-150 s passes locally, queues, then returns `stale_location` → disputed instead of the clean "acquire a fresh location" prompt. The tolerance is only meant for the negative side (the comment and `scan-validator.service.ts:243` say so) | `student_scan_service.dart:141-147` (live `:352`, offline `:474`) vs `backend/src/attendance/scan-validator.service.ts:243` |
| DD-F21 | The in-flight drain guard ignores `userId`, so after an account switch the new student's "Sync now" joins the **previous owner's** future: it aborts with `ownerChanged`, `syncDrainMessage` has no branch for it, and the UI says "Everything is already synced" while the new queue is untouched | `sync_engine.dart:248-253,621-623,696-710` (message); `sync_lifecycle_binder.dart:159-166` |

### Web — sweep findings

| # | Defect | Evidence |
|---|---|---|
| DD-W1 | Offline window check uses the RAW device clock — no `/health` offset in `submitScan` (while `checkAttendance` applies it); clock drift produces "window expired" on valid scans; +1 min kills the online-checkpoint (60-300 s) arcs | `api-client.ts:1275,1298,1346-1352`; `checkAttendance` :1425,:1475 (offset decorative there too); dry-run confirmed drift rejects |
| DD-W2 | Web client caps accuracy at 50 m; the server web policy is 500 m — offline scans indoors silently impossible | `api-client.ts:1329-1332` vs `backend/src/attendance/types.ts:8` |
| DD-W3 | Signature-invalid masks not-synced — the verify runs BEFORE the cached-session check; students who never prepared see "QR token signature is invalid" instead of "Sync before class" | `api-client.ts:1290-1313` (dry-run test 4) |
| DD-W4 | Terminal drain failure leaves a phantom cached record — a wrong PIN offline permanently bricks that checkpoint re-entry ("already saved" guard + `replaceCachedAttendanceForStudent` re-caches unsynced rows); RN fixed this (MP5), web did not | `api-client.ts:1944-1948` vs success path :1949; dry-run test 8 |
| DD-W5 | Faculty section detail `init()` unguarded produces an infinite spinner on any fetch failure | `sections/[id]/page.tsx:121-148` |
| DD-W6 | Student detail `init()` unguarded + a no-`?sectionId` deep link returns null forever (permanent blank) | `students/[id]/page.tsx:56-74,:134,:65` |
| DD-W7 | Disputes `handleResolve` — no try/catch, no busy state; double-click means double resolve | `disputes/page.tsx:156-173,691-702` |
| DD-W8 | Cockpit `handleManualOverride` — same gap; overlapping mutations + refresh races | `sessions/[id]/page.tsx:544-572,1001` |
| DD-W9 | Reports page: zero error handling (`.then` with no catch, unguarded `Promise.all`, export unguarded) leading to silent zeros + a dead export | `reports/page.tsx:89-101,169-185` |
| DD-W10 | Global search: per-keystroke requests, no debounce/abort/sequencing, causing stale-result races; uncaught failures | `search/page.tsx:55-66,88,44-53,36-42` |
| DD-W11 | QAC proof upload unguarded + no busy state (double upload) | `student/subjects/[id]/sessions/[sessionId]/page.tsx:58-73` |
| DD-W12 | Subject/section create forms: no try/catch (409 silent), no double-submit guard | `subjects/create/page.tsx:34-39`; `sections/create/page.tsx:106-123` |
| DD-W13 | Section-detail mutation cluster unguarded (enroll/reset/disable/grant/revoke/remove/assign, nine handlers) | `sections/[id]/page.tsx:118,188-214,454-471,486-490,522-527,541-545,407` |
| DD-W14 | Disputes `fetchData` 4-call `Promise.all` unguarded, so all lists can be silently empty | `disputes/page.tsx:141-153` |
| DD-W15 | Scheduled sessions show a "Completed" badge (the Android parity fix never landed on web) | `student/subjects/[id]/page.tsx:202`, `sessions/[sessionId]/page.tsx:121` |
| DD-W16 | Manual records persist fake `0,0` coordinates into the audit trail | `sessions/[id]/page.tsx:563`, `students/[id]/page.tsx:115` |
| DD-W17 | Settings per-key `Promise.all` discards partial successes, so "save failed" appears while keys saved; dirty dots lie | `settings/page.tsx:511-521` |
| DD-W18 | Cockpit back button uses `router.back()`, which exits on deep links (the Sidebar already has `backHref`) | `sessions/[id]/page.tsx:582` |
| DD-W19 | Student dashboard ScanQrModal onClose refetch uncaught | `dashboard/page.tsx:278` |
| DD-W20 | Subject/subject-sessions/create-session init chains have no catch, so failures produce blank pages | `subjects/[id]/page.tsx:32-45`, `subjects/[id]/sessions/page.tsx:53-67`, `create-session/page.tsx:51-72` |
| DD-W21 | Student schedule 4-call `Promise.all` uncaught produces a silent empty schedule | `student/schedule/page.tsx:525-547` |
| DD-W22 | ScanQrModal FileReader rejection unhandled | `ScanQrModal.tsx:100-105,405,593` |
| DD-W23 | Student detail `STATUS_CYCLE` omits `incomplete` | `students/[id]/page.tsx:15` |
| DD-W24 | Offline drain: no drain on cold boot (30 s gap), no retry backoff/cap, stops at the first retryable row | `OfflineSyncPanel.tsx:75-101`, `store.ts:419,447-454,460` |
| DD-W25 | **Data loss.** `logout()` calls `wipeOfflineStore()` unconditionally — `queue_v2`, `records` and `crypto_keys` are cleared with **no** `getPendingSyncCount()` check and no warning. A student who queued check-ins offline and signs out loses the evidence permanently (the session resolves absent). The same wipe runs on programmatic termination: `terminateOnAuthoritativeReplacement()` → `api.logout({ armDeviceCooldown: false })`, so a second-device login kick destroys the kicked device's queue with no user action | `api-client.ts:586-593`; `offline/store.ts:65-79`; `AuthSessionMonitor.tsx:44-46` |
| DD-W26 | **PII exposure.** The service worker caches authenticated API bodies in cleartext, keyed by **URL only**, and never purges them. `API_READ_PREFIXES` includes `/api/users`, `/api/attendance`, `/api/dashboard`; `networkFirstApi` does `cache.put(request, …)` and serves `caches.match(request)` offline. The Cache API ignores the cookie, so student A's roster/attendance is served to student B on the same browser offline. Nothing in `frontend/src` ever calls `caches.delete` (the only SW message is `SKIP_WAITING`), so entries survive logout and account switch. Also a plaintext duplicate of data the IndexedDB layer deliberately encrypts and owner-scopes. Registers by default in prod (`NEXT_PUBLIC_PWA_OFFLINE !== 'false'`) | `frontend/public/sw.js:26-32,88-100,133-151`; `lib/pwa/register-sw.ts:45-46` |
| DD-W27 | Session-create duplicate check races itself: the effect has no cancellation or request sequencing, and `hasDuplicateConflict` gates the submit button's `disabled`. Switching section/date quickly lets a stale response win, so the form is **permanently un-submittable** for a session that doesn't exist, with a warning naming the wrong day | `sessions/create/page.tsx:81-89` (deps `[bulkMode, sectionId, date]`) |
| DD-W28 | Kiosk "verified" ring drifts: `verified` is monotonic, incremented once per unseen `recordId` and never recalculated, so a cockpit override (present→absent, or absent→present after an initial absent event) is dropped as a duplicate. The projector disagrees with the authoritative roster until the session finale | `kiosk/page.tsx:347-357` |

### Contract drift (backend-systems-engineer audit)

| # | Drift | Verdict |
|---|---|---|
| DD-C1 | `GET /reports/export` rejects `department` (ExportQueryDto whitelist), so a super-admin/department CSV export 400s | Backend one-liner + no client change (the web field is legitimate) |
| DD-C2 | Roster rows typed as full `Student` on web (the backend omits `role`/`enrolledSectionIds`) — no runtime crash, but a type lie | Optional backend one-liner (`role: 'student'`) + web type honesty |
| DD-C3 | **Crash.** `missing_scan_evidence` is a real wire value (validator returns `success:true, status:'disputed', reason:'missing_scan_evidence'`; the service persists it as `disputeReason`) but is absent from `DisputeReason` in `shared/src/types/attendance.ts:33-47` **and** the Flutter mirror. Web: `DISPUTE_ICONS[reason]` → `undefined` → `<Icon/>` at `disputes/page.tsx:573` throws *"Element type is invalid"* and kills the **whole** Disputes page. Flutter: `decodeWireEnum` throws `UnknownApiValue`, so `AttendanceRecord.fromJson` fails and the teacher sees "Unable to load disputes". Any GET returning such a row breaks both clients | Add the member to the shared union + Flutter mirror + both label/icon maps, and add an unknown-reason fallback so no future value can crash a page. Backend keeps its gate (DD-F1/F2 removes the cause; the union renders existing rows) |
| — | All **other** wire enums agree across backend/web/Flutter (attendance status, session modes, checkpoints, excuses, referrals, roles, notifications, AI, timeline kinds) | Clean (was overstated — `DisputeReason` did not) |
| DD-C4 | `updateAttendanceStatus`/`addAttendanceRecord`/`resolveDispute` accept `excused` (and `incomplete`, for resolve) from the shared `AttendanceStatus` union, but `UpdateAttendanceStatusDto` / `CreateManualAttendanceDto` / `ResolveDisputeDto.newStatus` allowlists reject them → latent 400. Not reachable today (both status cycles exclude `excused`); DD-F6 is the live Flutter instance | Align the TS params to the DTO allowlists (client-side types only; no backend change) |
| — | 11 of 14 endpoint groups byte-match; no `forbidNonWhitelisted` traps in active paths | Clean |

### Backend — found in the 2026-11-12 sweep (none were in this plan before)

| # | Defect | Evidence |
|---|---|---|
| DD-B1 | **Sessions armed by a student's offline scan never auto-end.** `performOfflineActivation` writes `isActive: true` plus the QR columns but **no `autoEndAt`**; the cron filters `where: { isActive: true, autoEndAt: { not: null } }`, so the session is never swept, `resolveSessionAttendance` never runs, and every seeded roster row stays `pending` indefinitely. The cockpit shows the class permanently live, reports show pending, absent notifications never fire, and the student's standing keeps excluding "N pending record(s)". Only a manual end repairs it, and no later write can (a subsequent `activate` is fenced by `qrToken: null`). Every teacher path sets the deadline — this one forgot | `attendance.service.ts:961-972` vs `sessions.service.ts:709-715`; contrast `sessions.service.ts:431,577,633,657` |
| DD-B2 | **Rejecting a dispute is worse than never filing it.** Filing overwrites `status` with `'disputed'` and stores no prior value; `resolve(...,'reject')` then writes `'absent'`. A student recorded `late` (or even `present`) who disputes and is rejected ends up *more* penalized: standing drops and CHED absences increase purely from using the button | `disputes.service.ts:79-83,113-121` |
| DD-B3 | **At-risk/CHED and standing use different denominators.** `countedSessions = present+late+absent` for at-risk vs `present+late+absent+incomplete` for standing (mirrored in the class record). With 1 present + 1 incomplete: `/me/standing` = 50 % (below threshold) while `classifyAtRiskRow` = 100 % (on_track). `generateReferral` then refuses `STUDENT_NOT_AT_RISK` and the CHED notice prints a line contradicting the class record for the same student | `attendance-at-risk.service.ts:47` vs `standing.service.ts:156`, `docs.service.ts:2119` |
| DD-B4 | **Online offline check-outs are discarded instead of flagged.** For `online` sessions the armed-token check runs before the delayed-sync branch, and `end()`/the cron null the token columns → a queued checkout replayed after class close returns `absent / checkpoint_not_armed` and is never persisted; the row resolves `incomplete` (or `absent`). The in-person path is null-tolerant (`session.qrToken && …`), which is why only online loses the evidence. Contradicts this plan's former "do NOT chase" note | `scan-validator.service.ts:173-176` vs `:296-317`, `:195` |
| DD-B5 | `PATCH /sections/:id` accepts an arbitrary weekday and malformed clock strings — `day`/`startTime`/`endTime` are `@IsString()` only (the create DTO validates them). `{day:"Funday"}` reaches Prisma → **500** instead of 400; `"9:00"` persists, then `sessionDurationMinutes` returns 0, giving online auto-end a 15-minute class | `sections/dto/update-section.dto.ts:4-20`; `common/utils/session-time.ts:6-13` |
| DD-B6 | A teacher's manual `pending` on an online session is never resolved: `PATCH /attendance/:id/status` accepts `'pending'` and sets `manuallySet: true`, while the online resolver only loads `status:'pending', manuallySet:false`. The record stays `pending` forever after close (the in-person branch has no such filter) | `attendance.service.ts:611`; `resolution.ts:54,77` |
| DD-B7 | Department scope is case-sensitive while every other scope path is case-insensitive: `adminScope` compares raw `===`, but `department-pin.ts:41-46` and `attendance-scope.service.ts:30` use `insensitive`. An admin provisioned as `"Computer Studies"` sees nothing for rows stored `"computer studies"` — same actor, opposite verdict per check | `common/admin-scope.ts:34,42,51,60,71-72,83,163` |

## 2. Locked decisions

| # | Decision |
|---|---|
| 1 | Flutter offline fix = schema v3: `OfflineAttendanceQueue` gains `inputChannel` + `locationCapturedAt` columns; enqueue persists both; `buildAttendanceSyncPayload` emits both (in-person only for `locationCapturedAt` — RA 10173: online stays location-free but keeps its own evidence fields). The existing payload test asserting the stripped key set is updated (it currently locks in the defect). |
| 2 | Honest dispute surfacing: when a receipt reconciles a record with `status == disputed`, the dashboard toast says "synced — flagged for instructor review" instead of "synced"; the offline panel shows flagged rows distinctly. Silent masking removed. |
| 3 | The backend patch is a separate milestone requiring owner approval and a redeploy: (a) `ExportQueryDto.department` (fixes the web export 400); (b) `role: 'student'` on roster rows (contract exactness); (c) scan-validator: for `offline === true` replays whose signature/mode/PIN verify, downgrade the clock-behind branch (`scannedAt < issuedAt - 30s`) from terminal `invalid_timestamp` to success+disputed (`implausible_client_timestamp`) so drifted-device evidence reaches the teacher instead of dead-ending as a stuck row — the future-side bound stays a hard reject; (d) optional: echo `serverTime` in batch receipts. None of these are required for the Flutter offline fix (the validator evidence gate already accepts the fixed payload). |
| 4 | Web offline parity with RN: trusted-clock window check in the `submitScan` offline branch (compare raw + offset vs issuedAt/grace; a null offset fails closed with the not-synced message — never the raw clock); the accuracy cap mirrors the server web policy (500 m — drop the 50 m client gate); the not-synced message precedes any signature check; terminal `attendance_scan` failures call `removeCachedAttendanceAttempt` (RN MP5 phantom cleanup); drain-on-mount in `OfflineSyncPanel`. |
| 5 | No policy loosening on either client signature/PIN fail-closed gates. `delayed_offline_sync` disputes are by-design (set expectations with the owner: post-window replays land in the teacher dispute rail, not as automatic Present). |
| 6 | Web mutation-guard pattern: a shared `runMutation` helper per page (try/catch + notification + per-action busy/disabled); the cockpit back button honors `backHref`; manual records send nullable coords (`{latitude: null, longitude: null}`); STATUS_CYCLE aligns with the cockpit cycle; `deriveSessionStatus` used for badges; settings uses `Promise.allSettled` with per-key results; search gains a 300 ms debounce + monotonic seq guard. |
| 7 | Flutter sweep fixes: schedule sheets pop via the root navigator (or child ownership); the override list clamps to backend-allowed statuses; the ticker is stored, cancelled, and gated on countdown visibility; realtime gets self-healing reconnect after attempts exhaust (guarded against double-connect); `retryOne` awaits an in-flight drain then re-drains; at-risk gains mounted guards + `on Object` catches; torch state reads from the controller; Restore & replay triggers `drainNow`; the cockpit `_refresh` is mounted-gated; the month fetch falls back to cache `on Object`; notification realtime gets a try/catch; offline-prep gains `on Object` fallbacks; the end-session summary separates disputed/excused buckets; sockets re-read the token on reconnect. |
| 8 | No new dependencies. All Dart/TS-only — hot restart/reload, no native rebuild. The backend patch (D3) is the only deploy-coupled item. |
| 9 | DD-C3 is **client-only and non-negotiable**: add `missing_scan_evidence` to `DisputeReason` (shared union + Flutter mirror + web/Flutter label+icon maps) **and** give both clients an unknown-reason fallback (`?? AlertTriangle` / default label) so a future wire value can never crash a page again. Existing rows already carry the value, so fixing DD-F1/F2 alone does not un-break the Disputes page. |
| 10 | DD-F19: terminalize **only** a contract-terminal 4xx set (e.g. 400 invalid payload, 409 duplicate-replay, 422). Everything else — 403 consent-version, 404, 405, 409-in-flight, 413 — releases the rows back to `pending` with backoff. Add an explicit privacy-consent branch (treat like 401/maintenance: block and retry after consent) instead of relying on the generic 4xx path. Never terminalize a whole batch for one record: a per-record rejection must not fail its siblings. |
| 11 | DD-B1: `performOfflineActivation` mirrors `activateInPerson` and writes `autoEndAt = expiresAt + gracePeriodMinutes` (or `receivedAt` when already expired) inside the same claim, so the cron can sweep it. |
| 12 | DD-B4: for `offline === true` only, allow a signature/session/mode/checkpoint-verified replay whose armed token is already null (session ended or window closed) to fall through to the existing `success + disputed delayed_offline_sync` branch instead of `checkpoint_not_armed`. The live-session path keeps the strict armed-token + token-equality check unchanged; never relax it. |
| 13 | DD-B2: preserve the pre-dispute status. Persist it when the dispute is filed (new `disputePreviousStatus` column) or reconstruct it from the accepted `ScanAttempt` at resolve time; `reject` restores that value, it does not force `absent`. `accept`/`override` behave as today. |
| 14 | DD-W25: never destroy queued evidence silently. `logout()` consults `getPendingSyncCount()` — non-empty shows a blocking confirm ("N check-ins not yet synced"), and programmatic termination (`armDeviceCooldown:false` / replaced session) preserves the queue instead of wiping it. The next login for that account drains it. |
| 15 | DD-W26: the SW stops caching authenticated PII — drop `/api/users`, `/api/attendance`, `/api/dashboard` from `API_READ_PREFIXES` (keep `/api/health` and the static-shell caches), and add a `CLEAR_API_CACHE` message the clients send on logout and account switch. IndexedDB stays the only offline data store (it is already encrypted + owner-scoped). |

## 3. Milestones

| ID | Scope | Acceptance criteria |
|---|---|---|
| DD-1 — Flutter offline engine (agent 1: owns `core/sync/sync_engine.dart`, `core/database/app_database.dart`, `core/api/sync_api.dart`, `features/student/data/student_scan_service.dart`, `features/student/data/offline_readiness.dart`, `core/sync/readiness.dart`, related tests) | Schema v3 + enqueue + payload builder (DD-F1/F2/F4), disputed-receipt honesty (DD-F3), `retryOne` chaining (DD-F9), prep `on Object` fallbacks (DD-F16), offline-prep `teacher_key` step surfacing, 4xx classification (DD-F19), staleness tolerance (DD-F20), per-owner drain futures (DD-F21) | Dry-run re-created then deleted: the replay payload contains `inputChannel` always + `locationCapturedAt` for in-person; a disputed receipt yields row CONFIRMED + the flagged toast copy; `retryOne` during an in-flight drain re-attempts the reset row; a v2-to-v3 migration test on a legacy file DB passes; full suite green |
| DD-2 — Flutter faculty surfaces + realtime (agent 2: owns `faculty_schedule_screen.dart`, `faculty_disputes_screen.dart`, `session_cockpit_screen.dart`, `faculty_at_risk_screen.dart`, `session_wizard.dart`, `cockpit_realtime.dart`) | Schedule sheet pops (DD-F5), override clamp (DD-F6), ticker cancel/gate (DD-F7), realtime self-heal + token re-read (DD-F8/F18), at-risk guards (DD-F10), summary buckets (DD-F17), `_refresh` mounted gates (DD-F13) | Widget test: a day-sheet tap inside the shell returns the tapped event (old code asserts/blank); override buttons are exactly present/late/absent; the ticker is cancelled after dispose (fake async); realtime reconnects after exhaust (fake socket); suite green |
| DD-3 — Flutter student scan UX (agent 3: owns `student_scan_screen.dart` scan-shell parts, `surface/presentation/widgets/outage_widgets.dart`, `student_month_calendar.dart`, `notification_realtime.dart`) | Torch sync (DD-F11), restore & replay drain (DD-F12), month fetch fallback (DD-F14), notification realtime guard (DD-F15) | Torch toggles match controller state (fake controller); Restore & replay triggers a drain within one frame; a month-view error renders the cached fallback; suite green |
| DD-4 — Web sweep (agent 4: owns `frontend/src/lib/api-client.ts` offline+scan paths, `components/ScanQrModal.tsx`, `components/offline/OfflineSyncPanel.tsx`, all listed `app/**` pages) | Trusted-clock offline scan (DD-W1), 500 m web cap (DD-W2), not-synced message order (DD-W3), phantom cleanup (DD-W4), drain-on-mount + backoff (DD-W24), all mutation-guard + init-hardening items (DD-W5 through W14), badge/coords/back/settings/search/cycle (DD-W15 through W23), ScanQrModal catch (DD-W22), logout queue guard (DD-W25), SW PII purge (DD-W26), duplicate-check race (DD-W27), kiosk counter (DD-W28) | Offline dry-run tests re-created: a +5 min drift scan succeeds; an 80 m fix is accepted; the not-synced student sees the right message; a wrong PIN clears the terminal row + phantom and permits re-entry; logout with a non-empty queue is blocked/confirmed and the queue survives; after logout the SW API cache holds no PII; a stale duplicate-check response cannot disable submit; the kiosk count follows a cockpit override; export/settings/search/disputes unit tests; lint+tsc+suite green |
| DD-5 — Backend patch (separate tiny task, ONLY on owner approval — requires redeploy) | `ExportQueryDto.department`; roster-row `role: 'student'`; scan-validator offline-replay clock-behind downgrade (success+disputed `implausible_client_timestamp`); optional receipt `serverTime` echo; **plus the 2026-11-12 additions:** `autoEndAt` on offline activation (DD-B1), online offline-replay ordering (DD-B4), dispute-reject status preservation (DD-B2, needs a migration), at-risk/standing denominator alignment (DD-B3), `UpdateSectionDto` schedule validation (DD-B5), manual-`pending` resolution on online close (DD-B6), case-insensitive department scope (DD-B7) | Backend suite green; container smoke: export with a department filter returns 200; a drifted-clock offline replay lands disputed (not a stuck row); a scan-armed in-person session auto-ends and resolves its roster; an online checkout replayed after close lands `delayed_offline_sync` (not `checkpoint_not_armed`); a rejected `late` dispute returns to `late`; `/me/standing` and the at-risk row agree for a student with one `incomplete`; `PATCH /sections/:id` with `day:"Funday"` returns 400 |
| DD-6 — VER | Whole-repo gates + consolidated smoke script | `flutter analyze` 0 / full flutter suite / `pnpm lint` + `tsc` + web suite / fresh debug APK + rebuilt web bundle; smoke checklist below |

## 4. Testing strategy

| Layer | Coverage |
|---|---|
| Flutter offline dry-run (recreated in DD-1) | replay payload fingerprint (evidence fields present), disputed-receipt honesty, retryOne-during-drain, v2-to-v3 migration on a legacy DB, PIN cold-start unchanged |
| Flutter widget/unit | schedule sheet pop inside the shell (red-to-green), override button set, ticker cancel (fake async), realtime exhaust-reconnect (fake socket), at-risk unmount, torch/restore/month fallbacks |
| Web offline dry-run (recreated in DD-4) | clock-drift scans both directions, an 80 m fix accepted, not-synced precedence, wrong-PIN terminal with phantom removed + re-entry, a delayed replay reconciled as disputed, drain-on-mount |
| Web unit | runMutation busy/disabled matrix, search seq guard, settings allSettled, badge utility (Scheduled/Active/Completed), export payload |
| Regression guards | existing fail-closed verify tests (both clients) keep passing; the `delayed_offline_sync` dispute path stays by-design |
| Client contract (DD-C3) | a `missing_scan_evidence` record renders on the web Disputes page **and** decodes in Flutter; an unknown `disputeReason` hits the fallback icon/label instead of throwing |
| Flutter offline (DD-F19/F21) | a 403 consent-version batch releases every row to retryable `pending` (not `terminal:`), and a later drain succeeds after consent; one per-record 4xx leaves its siblings pending; an account switch mid-drain reports per-owner and the message is never "already synced" for the new owner |
| Web logout / SW (DD-W25/W26) | logout with a non-empty queue is blocked/confirmed and the queue survives; a fresh account on the same browser offline never reads the previous account's cached API body |
| Backend (DD-B1..DD-B7) | a scan-armed in-person session is swept by the cron and resolves its roster; an online checkout replayed after close lands `delayed_offline_sync`; rejecting a `late` dispute restores `late`; `/me/standing` and the at-risk row agree with one `incomplete`; `PATCH /sections/:id` with `day:"Funday"` returns 400; a manual `pending` on an online session resolves at close; mixed-case department scope returns the same rows as the insensitive paths |

## 5. Device smoke checklist (defense rehearsal)

1. Flutter offline arc end-to-end: teacher arms an in-person QR (online), student scans in airplane mode, "SAVED ON DEVICE", reconnect, drain, teacher cockpit roster shows Present (not disputed) — the money shot.
2. Same arc with a PIN-protected online checkpoint.
3. Post-window replay: scan offline, sync later, teacher sees a `delayed_offline_sync` dispute (review, not automatic Present).
4. Web offline arc end-to-end with a deliberately drifted laptop clock (+5 min).
5. Cockpit realtime recovers after an 8 s network blip (radar/anomaly stream returns).
6. Disputes resolve + override with a throttled network (one call per click, errors visible).
7. Reports + export as super admin with a department filter (needs DD-5 to pass).
8. Settings save with one key failing (partial success reported honestly).
9. Deep-link cockpit back arrow returns to `/faculty/sessions`.
10. Global search rapid typing returns final-query results.
11. Disputes page opens with a `missing_scan_evidence` record present (web + Flutter) — no crash, reason labelled.
12. Flutter: queue a check-in, then bump the privacy-notice version / trigger a 403 drain — the row stays retryable, and after accepting consent it syncs.
13. Web: queue a check-in, attempt logout — the confirm appears and the queue survives; sign in as another student offline and confirm no cross-account data appears.
14. Scan-armed in-person session: arm from a student's offline scan, wait past the grace window, confirm the cron ends it and the roster resolves (not permanently pending).
15. Online: student checks out offline, teacher ends the class, student reconnects — teacher sees a `delayed_offline_sync` dispute (not "checkpoint has not been opened").

---

## 6. Execution order

1. DD-1 + DD-2 + DD-3 in parallel (three Flutter agents, disjoint file ownership as listed).
2. DD-4 in parallel with the Flutter waves (web agent, disjoint tree).
3. DD-5 backend patch ONLY on owner approval (requires a backend redeploy; separate from the client fixes).
4. DD-6 VER sweep, then fresh debug APK + rebuilt web bundle.

## 7. Open questions (defaults if silent)

1. Approve the DD-5 backend patch as part of this wave? (Default: yes — the export 400 and the drifted-clock dead-end rows are both demo-relevant; without (c) a clock-drifted laptop keeps producing stuck terminal rows on the web offline path.) **Amended 2026-11-12:** the patch now also carries DD-B1 (never-auto-ending scan-armed sessions), DD-B4 (online late replays), DD-B2 (dispute-reject restore), DD-B3 (denominator parity) and DD-B5/B6/B7. DD-B1/B2/B4 are demo-visible data-integrity fixes, not polish — recommend keeping them in.
2. Confirm the intended semantics for post-window offline replays: they SHOULD land in the teacher dispute rail as `delayed_offline_sync` (review), never auto-Present. (Default: yes, matches backend design + AGENTS.md.)
3. For the Flutter disputed-receipt toast copy: "synced - flagged for instructor review" vs a more explicit wording? (Default: the former, short.)
4. Does the service worker keep **any** API caching, or should it stop caching API responses entirely? (Default: drop only the PII prefixes `/api/users`, `/api/attendance`, `/api/dashboard` and keep `/api/health`; the encrypted IndexedDB store is the offline read path either way.)
5. DD-B2 needs a schema change — OK to add a nullable `disputePreviousStatus` column to `AttendanceRecord` in the same backend patch (rather than reconstructing from `ScanAttempt`, which cannot represent a teacher-manual status)? (Default: yes, nullable + no backfill; fall back to `absent` only when the column is null for legacy rows.)

## 8. Execution addendum (2026-11-12) — EXECUTED

All six milestones ran: five implementation streams in parallel (3 Flutter, 2 web, 1 backend), then an integration pass. Every DD item is fixed; nothing was deferred.

| Milestone | Result |
|---|---|
| DD-1 Flutter offline engine | schema v3 (v2→v3 + v1→v3 migration tests), replay payload byte-parity with the live scan body, `confirmedFlagged` reconciliation + panel treatment, 4xx split (`{400,409,422}` terminal; 403-consent/404/405/413 retryable), per-owner drain futures, `retryOne` chaining, staleness bound corrected, prep `on Object` |
| DD-2 Flutter faculty/scan UX | F5–F10, F13, F17, F18 all in; realtime self-heal uses a fake-socket seam; sheet ownership moved into the sheet |
| DD-3 Flutter student scan UX | F11, F12, F14, F15 in; month fetch returns `{sessions, fromCache, error}` with a retry banner |
| DD-4 Web (split a/b) | W1–W28 in, plus `useRunMutation`, `latest-request` sequencing, `dispute-reasons`, kiosk delta bookkeeping |
| DD-5 Backend | C1, C2, B1–B7, clock-behind downgrade in; migration `20261112120000_dispute_previous_status` |
| DD-6 VER | see numbers below |

**Deviation 1 — `implausible_client_timestamp` needed a contract entry.** DD-5(c) introduced a new wire reason with no union member, which is exactly the DD-C3 crash class. Resolved by adding it to `SystemDisputeReason`, the Dart enum, and both label/icon maps (with fallbacks) rather than letting the backend emit an untyped value.

**Deviation 2 — manual `pending` (DD-B6) was fixed by rejection.** The plan allowed either resolution or a DTO rejection; rejection was chosen (smaller blast radius, since a parked row can never resolve). `CreateManualAttendanceDto` was aligned too.

**Deviation 3 — `offline_sync_panel.dart` was outside every initial ownership list.** DD-1 flagged that decision 2's "panel shows flagged rows distinctly" was unmet; a follow-up pass added it (no retry affordance, excluded from the attention count).

**Deviation 4 — one stale assertion.** DD-B7's case-insensitive scope changed the Prisma `where` shape; `users.service.spec.ts` still pinned the raw `{ department: 'CCIS' }` literal and was updated in the integration pass.

**Deviation 5 — DD-W22 initially fell through an ownership split.** `ScanQrModal.tsx` sat in one agent's file list while the finding was delegated to another, so neither fixed it; the integration pass caught it while cross-checking the 60 IDs. Fixed in the integration pass (`handleImageFile` now resolves via `Promise.withResolvers`, rejects through `reader.onerror`, and converts a read failure into a user-visible "That image could not be read" state instead of an unhandled rejection from the fire-and-forget call sites), with a new regression test that stubs a failing `FileReader`.

**Deviation 6 — two E2E specs were broken before this wave (never executed here) and were repaired during live verification.** `e2e/section-session-fixes.spec.ts` called the `request` fixture without authenticating it (the Playwright `request` context has its own cookie jar, so the browser-page `loginFaculty` in `beforeEach` does not apply) → its API-created section 401'd. It now calls `apiLoginFaculty(request)` like the other specs do. Its bulk-session assertion also assumed the 2027-dated rows were visible on page 1 of the now-paginated sessions list; it now scopes the list with the existing `?sectionId=` filter. Both repairs are test-only — the product behaviour (per-slot times persisted: `08:00-10:30` Mon, `09:00-12:30` Wed, 4 sessions) was verified correct in the database before touching the spec.

**Deviation 7 — `extended-flows.spec.ts` pinned the old 3-state cycle.** DD-W23 intentionally added `incomplete` to the student-detail `STATUS_CYCLE` (aligning it with the cockpit), so the spec's `CYCLE_LABELS = ['Present','Late','Absent']` and its hardcoded "two more clicks" return path were stale. Re-pinned to `['Present','Late','Incomplete','Absent']` with a cycle-length-driven return loop — the product behaviour is the intended one.

**Deviation 8 (pre-existing, not fixed here) — a fresh seed never backfills the attendance hash chain.** `Dockerfile.backend` compiles `prisma/backfills/ledger-backfill.ts` into `dist-seed`, but the seed service runs only `dist-seed/prisma/seed.js`. On a fresh volume that left **15 of 16 records with `recordHash = NULL`**, and `POST /audit-logs/ledger/verify` answered `verified: true` with **0 records checked** — a false assurance on a non-empty table. Running `node dist-seed/prisma/backfills/ledger-backfill.js` chained the 15 rows and F9 passed. Recommended follow-up (not in this wave): run the backfill from the seed entrypoint, and make verify report `insufficient_data` rather than "intact" when no hashed records exist.

**Verification**

| Gate | Command | Result |
|---|---|---|
| shared | `pnpm --filter @polycheck/shared test` | 202 / 18 files |
| shared build | `pnpm --filter @polycheck/shared build` | CJS + ESM + DTS success |
| backend | `pnpm --filter @polycheck/backend test` | **1059 / 84 suites** |
| backend static | `typecheck`, `lint:check`, `format:check`, `prisma validate` + `generate` | clean |
| web | `pnpm --filter frontend test` | **501 / 76 files** |
| web static | `tsc --noEmit`, `eslint`, `next build` | clean, 0 problems |
| flutter | `flutter test` | **749 passed** |
| flutter static | `dart format lib test` (369 files, 0 changed), `flutter analyze` | 0 issues |
| monorepo | `pnpm build` | clean |

**Not verified (environment):** container/DB smoke — the Docker CLI is installed but the daemon is not running and no PostgreSQL is available. DB-dependent behaviour (migration application, auto-end sweep against real rows) is therefore proven by mocked service specs plus `prisma validate`/`generate`, not by a live database. Device smoke (checklist items 1–6, 14–15) still needs a real build + backend.

**Smoke-checklist coverage by automated proof:** items 3, 7, 11, 12, 14, 15 are covered by new backend/Flutter/web tests; items 4, 8, 9, 10, 13 by new web tests; item 5 by the fake-socket realtime test; items 1, 2, 6 remain manual device runs.

## 9. Live verification (2026-11-12, local Docker stack)

Docker was available for a real run: `docker compose -f docker-compose.local.yml up -d --build` brought up postgres + redis + migrate + seed + backend + frontend. This closes the "mocked Prisma only" caveat for the DB-dependent paths.

**Migration (DD-B2) — real Postgres.**
- `_prisma_migrations`: **27 applied**, latest `20261112120000_dispute_previous_status`.
- `AttendanceRecord.disputePreviousStatus` exists with the `AttendanceStatus` enum type.
- migrate and seed containers both exited successfully; `GET /api/health/ready` → 200.

**API smoke — 27/27 checks passed** (throwaway script, deleted; cookie-auth against the running API).

| Check | Result |
|---|---|
| super admin + teacher login, roles | pass (201) |
| `GET /sections/:id/students` carries `role: 'student'` (DD-C2) | pass |
| `PATCH /sections/:id` with `day:"Funday"` → 400 (DD-B5) | pass |
| `PATCH /sections/:id` with `startTime:"9:00"` → 400 (DD-B5) | pass |
| `PATCH /sections/:id` with a valid body → 200 | pass |
| `GET /reports/export?department=CCIS` → 200 with rows (DD-C1) | pass |
| unknown department → 200, empty (no crash) | pass |
| student files dispute → `status=disputed` + `disputePreviousStatus=late` | pass |
| teacher `reject` → status restored to `late`, **not** `absent` (DD-B2) | pass |
| `/me/standing` vs `/attendance/at-risk` with one `incomplete`: same rate **and** same status (DD-B3) | pass |
| auto-end cron: fixture session with 13 pending rows + `autoEndAt` in the past → cron ended it, **0 rows left pending**, resolved to `absent` | pass |
| anonymous `/sections` → 401; student `/audit-logs` → 403 | pass |

Note: the smoke intentionally mutated local dev rows (one session ended, its 13 rows resolved, one record's status toggled) — a local fixture only; re-running the `seed` service restores the demo dataset.

Still not covered by this run: the Flutter app against a real backend (no device/emulator attached), and the `autoEndAt` **write** inside `performOfflineActivation` (needs a teacher-signed QR, i.e. a provisioned device key) — that write remains unit-proven; what is now proven live is its consequence (the cron sweeps and resolves).

### 9.1 Full Chromium E2E (126 tests, serial)

Final result: **120 passed, 2 failed, 4 skipped**. The count moved from 118 → 120 as the triaged items were repaired.

| Failure | Root cause | Verdict |
|---|---|---|
| `system-reports.spec.ts:29` | `403 active_session_elsewhere` on a raw `page.request` student login with **no `deviceId`**, while a browser session for `2024-00001-MN-0` from an earlier spec is still live. The device-integrity gate (LI wave) fails closed on an unidentified attempt. | **Pre-existing cross-spec collision**, not a product defect. Passes in isolation on a clean DB. |
| `wow-suite.spec.ts:70` (F8) | Identical — same student, same gate, same `activeSessionLastActiveAt`. | **Pre-existing**, passes in isolation. |

Both were verified green in a 5-test isolated run on a fresh volume, so they are ordering artefacts rather than behaviour regressions. Suggested fix (not applied here, outside this plan's scope): give these specs a device-aware student login — either a per-spec `deviceId` that the spec also uses to log out first, or a dedicated seeded student no other spec signs in as.

Repaired during the run (all test-only): `section-session-fixes.spec.ts` (missing `apiLoginFaculty(request)`; paginated assertion now scoped with `?sectionId=`), `extended-flows.spec.ts` (`CYCLE_LABELS` + cycle-length-driven return loop for the intentional 4-state cycle), and the ledger backfill (Deviation 8).

## 10. Residual fixes + the app's first E2E layer (2026-11-12)

### 10.1 Ledger truth (Deviations 8 closed)

- **Seed now chains history.** `prisma/backfills/ledger-backfill.ts` exports `backfillAttendanceLedger(prisma)` (same algorithm: per session in `(timestamp, id)` order, skip hashed rows, reuse salt/prevHash) and keeps a `require.main` CLI. `prisma/seed.ts` calls it at the end, so both `ts-node prisma/seed.ts` and the container's `node dist-seed/prisma/seed.js` produce a fully chained ledger.
- **`verify` no longer lies.** `LedgerVerifyResult` gains `status: 'verified' | 'broken' | 'insufficient_data'` and `unhashedRecords` (both optional at the type level so the read-only RN fixtures still compile). `verifyLedger` counts total vs hashed up front; `hashedRecords === 0` returns `insufficient_data` with `verified: false` and never scans. Web + Flutter render three distinct states ("Ledger intact" / "Ledger not anchored — N record(s) have no chain entry" / broken detail).

### 10.2 A real ledger-corruption bug found by the E2E run

`wow-suite F9` kept failing standalone with *"stored hash no longer recomputes"*. Root cause was **not** pollution:

- `resolution.ts` (in-person at `:47`, online at `:92`) and `sessions.service.ts:460` (expired activation) rewrote `timestamp: new Date()` when collapsing `pending` rows to `absent`.
- `timestamp` is part of the hash preimage (`prevHash|studentId|timestampIso|sessionId|salt`), and `appendLedger` is a no-op once `recordHash` is set.
- Therefore **every session that ended with unscanned students silently corrupted its own chain** — the flagship audit feature broke in normal operation.

Fix: none of the three paths rewrites `timestamp` any more (the session's `endedAt` records when resolution ran). Three specs that pinned the old shape (`resolution.spec.ts`, `sessions.service.spec.ts` ×2) were re-pinned to the invariant.

### 10.3 Playwright isolation (the 2 order-dependent reds)

Root cause: `student.spec.ts` logs the seeded student in via `beforeEach`, then signs a *disposable* student into the **same browser context**. The new login replaces the cookie, so `afterEach` could only revoke the disposable session and `s-001`'s row survived the file. Every later unidentified raw login then failed closed with `403 active_session_elsewhere`.

Fix (test-only, `e2e/**`): `revokeBrowserSession(page)` called before any in-context account switch; `apiLoginStudent` signs in with a stable `STUDENT_API_DEVICE_ID` and self-heals once on `active_session_elsewhere` via the existing teacher Emergency Device Release; `system-reports.spec.ts` uses the shared helper instead of its own raw login. Full serial suite after the fix: **121 passed / 1 failed (F9, pre-reseed DB corruption) / 4 skipped**, and `student.spec` leaves **0** live student sessions.

### 10.4 Flutter end-to-end harness (new)

`polycheck_mobile/integration_test/` (the app's first device-level tests; `integration_test` SDK package only, no new pub deps):

| File | Proves |
|---|---|
| `offline_attendance_test.dart` | teacher signs an in-person token **locally** with the app's Ed25519 key, arms the session; student scans with the outage simulator armed → row lands in the encrypted Drift queue with `inputChannel` + `locationCapturedAt`; disarm → real `SyncEngine` drain → **server row `status: present`** with real coordinates (not `disputed`) |
| `logout_queue_test.dart` | authoritative/401 sign-out preserves queued rows **and** owner keys, then the re-authenticated account drains them to `present`; the explicit user sign-out still purges |
| `student_login_test.dart` | portal login with a disposable student lands on the student dashboard (live router/auth gate) |
| `support/{env,api_helpers,fixtures,harness}.dart` | `--dart-define` base URL (default `http://10.0.2.2:4000/api`), disposable teacher/student/section/session fixtures, a `ProviderContainer` wired to the real drift DB + real API client, and a guard that fails if the app client and the harness target different backends |

Run: `flutter test integration_test -d emulator-5554 --dart-define=PUP_API_BASE_URL=http://10.0.2.2:4000/api --dart-define=ENABLE_OUTAGE_SIMULATOR=true --dart-define=ALLOW_QR_FALLBACKS=true` → **4/4 tests pass**. Runbook: `polycheck_mobile/INTEGRATION_TESTS.md`.

### 10.5 Two more lib fixes

- `sync_lifecycle_binder.dart` read `ref` inside `State.dispose()` → Riverpod 3 throws on any teardown of `PolycheckApp(bootstrap: true)`. The monitor is now captured in `initState` and stopped from the field.
- `test/features/student/officer_permission_test.dart` was a **time bomb**: its only permission fixture hardcoded `expiresAt: '2026-11-11T18:00:00.000Z'`, so once that instant passed every "authorized" case silently flipped to `denied` and four tests failed. The fixture is now relative (`now + 2h`), which cannot expire mid-run.
- `android/app/(faculty)/disputes.tsx` gained the two new `DisputeReason` entries so the RN reference app typechecks again after the shared union change (it is a consumer of the contract, not frozen against it).
