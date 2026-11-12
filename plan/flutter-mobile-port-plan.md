# Polycheck Mobile — Flutter Port Plan (polycheck_mobile) — Play Store Submission Nov 18–20, 2026

> **Directive context:** Staff Flutter & Distributed-Systems engineering task — a deterministic 1:1 port of the existing, proven attendance system from React Native (`android/`) + Next.js web (`frontend/`) + shared TS contracts (`shared/`) + NestJS API (`backend/`) into a new production-grade Flutter app at `polycheck_mobile/`. NOT greenfield innovation.
>
> **Timeline:** `.aab` must reach signed upload Nov 18–20; capstone defense Dec 4, 2026.
> **Status:** Implemented (A1–A3, B1–B5, C1, VER) — 2026-11-10. See §9 Implementation Addendum for delivered waves, verification evidence, deviations/gaps, and follow-ups.

---

## 0. Monorepo placement & non-negotiable guardrails

- **New sibling package:** the Flutter app lives in a NEW folder `polycheck_mobile/` at the repo root, next to `frontend/` and `android/` — not inside `android/`, not replacing it.
- **`android/` is a READ-ONLY reference, never modified.** Its screens, hooks, services, tests, EAS config and everything else stay byte-identical through every phase; the current RN app remains the shippable mobile app until the Flutter build passes all gates and the team decides to cut over. No code, config, or doc change inside `android/` is permitted as part of this port (including `pnpm-workspace.yaml` moving android packages around).
- **`shared/` contracts are consumed, not forked.** Dart models mirror `shared/src/types`, `pup-courses.ts`, `section-label.ts`, `session-slots.ts` math — but the TypeScript files and the NestJS backend stay untouched; the Dart port just mirrors their behavior, validated with the same fixture vectors already in the repo.
- **Worktree only, no new services.** `backend/` and `frontend/` stay out of scope for source edits; the server is the single source of truth both clients talk to. Any contract mismatch is surfaced back to `shared/` types — never "fixed" separately in the Flutter app.
- **Add to workspaces deliberately:** `polycheck_mobile/` added to the root `pnpm-workspace.yaml` (or excluded from it, since Flutter manages its own toolchain) as a documented decision at scaffold time — CI gates (`scripts/verify-tracked-build-files.mjs`, Android bundle checks) must keep passing untouched.
- **AGENTS.md** gains a progress trail for the Flutter port as phases land, WITHOUT removing or rewriting the existing React Native history.

## 1. Source-of-Truth Inventory (must be read before each corresponding Phase step)

| Contract | Source of truth | Plenty detail |
|---|---|---|
| Domain types (User, Section, Session, AttendanceRecord, SessionPermission, Referral, Dispute, QRTokenPayload, ReportIssue, Excuse, Notification, AtRiskStanding, SystemReport | `shared/src/types/*.ts` | 1:1 translate to `@freezed` |
| Sections courses | `shared/src/constants/pup-courses.ts` | 1:1 as `List<PupCourse>` |
| Haversine + token math | `shared/src/utils/haversine.ts`, `token.ts` | Unit-test parity vs TS vectors |
| Section heading (“Section 4-1 · BSIT”) | `shared/src/utils/section-label.ts` | Format 1:1 |
| Session slots / bulk math | `frontend/src/lib/session-slots.ts` | Port math 1:1, add unit tests |
| QR generation | `backend/src/auth/*`, `shared/src/utils/token.ts` | Ed25519 teacher keys via better-auth (upstream ecosystem at `backend/src/auth/better-auth.service.ts`) |
| Sync batching API | `backend/src/sync/`, `POST /sync/attendance/batches`, receipt contract | Drift queue aligns to response contract |
| Better Auth endpoints incl. `deviceId` on login and logout | `backend/src/auth/auth.controller.ts`, `backend/src/auth/dto/login-student.dto.ts`, `backend/src/auth/dto/logout.dto.ts` | Android client already sends `deviceId` — parity required |
| Device-integrity gate payloads | 403 `active_session_elsewhere` + 403 `device_cooldown_active` (+`remainingSeconds`, `activeDeviceKind`, `activeSessionLastActiveAt`) — see `plan/device-integrity-login-plan.md` | **Affects gate UX + with coach view to counselor release** |
| Teacher Emergency Device Release | `POST /users/students/:id/device-release`, `{ hadBinding, hadCooldown }` | Displayed to teacher + students |
| Maintenance + 503 contract | `shared/src/types/maintenance.ts`, `backend/src/maintenance-mode/*` | go_router redirect to `/maintenance` |
| 3D ID card visuals + hologram | `android/components/IdCardModal.tsx`, `android/components/HologramOverlay.tsx`, `frontend/src/components/student/HologramOverlay.tsx` | 22° gold/maroon sweep + 1Hz trusted UTC watermark, device chip `…<last4>` |
| Offline “Saved on Device” UX | `frontend/src/app/student/dashboard`, `android/app/(tabs)/scan.tsx`, `frontend/src/components/ScanQrModal.tsx` | White-on-gold banner over the receipt chip |
| Notching / E2EE key handling for local QR signing | `frontend/src/lib/signing-key.ts` + `android/services/api-client.ts` | Ed25519 wrapped key + SecureStore BB model; sync `payload.sig` to backend? — debt recorded below |
| **Notifications** | `backend/src/notifications/*` (`GET /notifications`, unread-count, `POST /notifications/read`, `notifications:new` socket event, `PushSubscription`) | Center UX + bell badge parity — web panel + Android center |
| **AI Assistant** | `backend/src/ai/*` (`GET /ai/capabilities`, `POST /ai/chat` incl. `regenerate`, threads CRUD, `ai:thread:*` socket rooms, role-tuned tools) | Streaming chat parity; policy-gated (master/role toggles); attachments → share sheet |
| **Excuses** | `backend/src/attendance/*` (`POST /attendance/records/:id/excuse`, `GET /attendance/excuses`, `…/excuse/decision`) | Student request + teacher queue parity, evidence upload |
| **Docs / exports** | `backend/src/docs/*` (master-list PDF/DOCX, session attendance CSV/PDF, class-record PDF/DOCX, CHED notice, DPO summary) | Download → share-sheet flows; formula-safe CSV |
| **Admin/oversight endpoints** | `GET /dashboard/admin-overview`, `GET /dashboard/server-status`, users admin (`GET/PATCH /users…`, `/users/admins`, import endpoints), `GET/PUT /settings`, audit logs + `POST /audit-logs/ledger/verify`, system-reports triage, `GET /attendance/at-risk`, CHED referral state machine, `GET /search` | Super-admin + IT-coordinator + registrar suite (Android already ships it — plan had omitted it) |
| **Standing / at-risk payloads** | `shared/src/types/standing.ts`, `at-risk.ts` | Banner + roster parity |
| **Privacy (RA 10173)** | `backend/src/settings/privacy-center/*`, `shared/src/types/privacy.ts` | Read-only privacy screen + data inventory |

## 2. Locked Tech Stack (zero ambiguity)

Same as directive: Flutter 3.44+/Dart 3.12+; Riverpod (annotated) only; go_router (centralized `RouterNotifier` for auth/role/mustChangePassword/maintenance 503 transitions); freezed/json_serializable; dio + cookie (or bearer) against Better Auth; drift offline repos + `.watch()` streams; cryptography/pinenacl for Ed25519 teacher offline signing; flutter_secure_storage; mobile_scanner; geolocator + `position.isMocked` rejection; image_picker + compression; socket_io_client re-exponential backoff; connectivity_plus + internet_connection_checker_plus.

**Directory skeleton:**
```
polycheck_mobile/
  lib/src/
    core/         (theme, db, network, router, utils, providers)
    features/
      auth/       (login, force-password-change, device-gate)
      student/    (id-card, scanner+geofence, schedule, history, disputes, excuses, enroll, officers, assistant)
      faculty/    (dashboard, subjects+sections, session wizard+bulk, cockpit+radar, disputes, excuses, at-risk, reports+exports, calendar, assistant)
      admin/      (users, settings, audit-logs+ledger, server-status, system-reports triage, global search, designations gates)
      assistant/  (shared streaming chat core + attachment share)
      maintenance/
      profile/    (profile, contacts+device, my-system-reports, outage-simulator dev pill)
```

Deviations from directive, locked from Day 1 (recorded as **K-decision** table):

| # | Decision |
|---|---|
| K1 | **No `Number.parseDouble` timezone aliasing.** All attendance/timestamp math uses `TrustedClock.now()` = raw UTC epoch ms + `serverTimeOffsetMs` from `/health`; expiry & token checks use the server offset, never device wall clock (matches existing apps). |
| K2 | **Section course display is not-new.** Uses `formatSectionHeading` 1:1 (`Section {name} · {course}`); course picker only if missing (web has it — port full create-section flow) — do **not** invent a v2 course table. |
| K3 | **Device-integrity gate lives in the core client.** On 403 `active_session_elsewhere` → red explainer panel ("Signed in on another device — log out there or ask instructor for Emergency Device Release"); on 403 `device_cooldown_active` → countdown pill driven by `remainingSeconds` + `TrustedClock`. Logout sends `deviceId`, calls `armDeviceCooldown` — expose the same as web client did. Teacher “Emergency Release” confirms `{ hadBinding, hadCooldown }` in toast. |
| K4 | **Course→Section selection mirrors web form** (`Section {name} · {course}`); no alternate naming. |
| K5 | **QR expiry window drailed 1–15 min; grace capped 60 min; diagnostic banner live** — same as existing Android/web facsimile. |
| K6 | **Local QR signing must be exact-parity with backend as source of trace** — do NOT rely on a local secret for chain replay; rely on existing `publicKey` upload path (`POST /auth/provision-key`) and deterministic nonce. |
| K7 | **No proof-of-concept** for new engines (e.g., never "@supabase / possibly supabase”); strictly Riverpod + drift + dio + go_router + mobile_scanner + geolocator. |
| K8 | **Play Policy:** targetSdk = Play requirements at submission (34+); `minSdkVersion` 26 (Android 8) to satisfy SDP; privacy policy URL + Data Safety forms aligned to attestation engine described in release-readiness docs. |
| K9 | **Backend API base URL** driven by `--dart-define=PUP_API_BASE_URL` and `PUP_WS_BASE_URL` (defaults to Polycheck staging URL used by Android `EXPO_PUBLIC_API_URL`) with a “backend not reachable” gate. |
| K10 | **Zero theme drift-pd tokens:** Colors/typography/1px borders/zero radius exactly as existing web/mobile; `Color(0xFF7B1113)`, `Color(0xFFFFDF00)`, `GoogleFonts.lora()` display, `GoogleFonts.dmSans()` body. |
| K11 | **Enums mirror the backend exactly — never invent.** Student dispute reasons are `outside_geofence, expired_token, duplicate_submission, invalid_signature, device_mismatch, suspicious_coordinates, other` (`shared/src/types/attendance.ts`); the teacher rail additionally carries the `SystemDisputeReason` union labels; notification `type` mirrors the seeds. The earlier plan draft (`gps_inaccurate`/`network_delay`) was wrong and is retired. |
| K12 | **Assistant is in scope.** Streaming chat via the same AI contract (SSE-style token stream over Socket.IO `ai:thread:*`), thread list/delete, regenerate/stop, tool-activity collapsible, attachment downloads via the platform share sheet; visibility follows `GET /ai/capabilities` (master + role toggles + policyBlocked). |
| K13 | **Role suites follow `shared/src/utils/designations.ts` gating exactly** — super-admin implicit-all, IT coordinator (server status, system-reports triage, settings System tab), registrar (department-pinned user admin), department head (oversight reports/excuses/at-risk). Maintenance exemption flags ride the same helpers. |

## 3. Porting Matrix (locked mapping)

| Source (TS / web / Android) | Flutter target | Notes |
|---|---|---|
| `shared/src/types/*.ts` | `polycheck_mobile/lib/src/core/models/*.dart` (freezed + json_serializable, fieldRename.none) | Types equal to `@freezed` pure; no network adaptation leakage |
| `shared/src/constants/pup-courses.ts` | `core/constants/pup_courses.dart` | 1:1, helper API: `pupCourseByCode`, `pupCourseName`, `pupCoursesByDepartment` |
| `shared/src/utils/haversine.ts` | `core/utils/haversine.dart` | Unit tests with the SAME vectors as existing haversine.test.ts |
| `shared/src/utils/section-label.ts` | `core/utils/section_label.dart` | `formatSectionHeading(section)` / `sectionCourseLabel` |
| `shared/src/utils/token.ts` (`isTokenInValidityWindow`, decode) | `core/utils/token_crypto.dart` | Ports `decodeTokenPayload`, `isTokenInValidityWindow(payload, trustedNow)`, Ed25519 pin-hash PWD iteration count identical |
| `frontend/src/lib/session-slots.ts` | `core/utils/session_slots.dart` | Full parity incl. `nextOccurrenceDate`, per-slot bulk `countSlotOccurrences` |
| `android/hooks/qr-fallback-policy.ts` | `core/rules/qr_fallback_policy.dart` | Only true for `EXPO_PUBLIC_…`→`--dart-define` env-pin equivalent, in-person opt-in |
| `android/services/api-client.ts` (`logout { deviceId, armDeviceCooldown }`) | `core/network/polycheck_api_client.dart` | Same request/response shapes + error-typed gateway |
| React screens (`frontend/**/page.tsx`) + RN screens (`android/app/**.tsx`) | `features/*/presentation/…` widgets + pages | Keep flows 1:1; dialogs reworked to show the same functionality |
| Drift + SQLite cache names in Android SQLite service | `core/database/app_database.dart` tables: CachedSubjects/CachedSections/CachedSchedules/CachedRosters/OfflineAttendanceQueue/ReportsQueue/ProfileCache | Schema superset (RLS via SQL filters + owner-restricted) |

## 4. Phased Execution with Verification Gates

### Phase 1 — Foundation & Contracts (Gate: `flutter analyze` = 0 issues, build runners green, unit tests for haversine/tokens/section-label/slots parity vs TS tests = pass)

Initialize `polycheck_mobile/` package pinned to Flutter stable at submission. Build:
- `core/theme/pup_theme.dart` — light + dark ThemeData; zero radius everywhere; surface tint transparent; custom `ThemeExtension<PupTokens>` with maroon/gold/ink/borderSubtle; 1px borders.
- `core/models/*` — full port of `shared/src/types` dto set.
- `core/database/app_database.dart` — drift schema for the tables in §5 with `dateTimeAsText`,indices on sessionId+studentId and syncStatus; a `MigrationStrategy` that stamps schema version.
- `core/network/polycheck_dio_client.dart` — Dio + AuthInterceptor (cookie or bearer per Better Auth device trust) + device fingerprint header (`X-Polycheck-Device-Id`, generated and stored in secure storage, included in login/logout body per backend contract) + 401/503 interceptor + repeat-safe `RetryInterceptor`.
- `core/providers/trusted_clock.dart` — `serverTimeOffsetMs` on startup and after each `/health` poll; `TrustedClock.now()` read wallet.
- `core/router/router_notifier.dart` — go_router guard ladder: `/login?reason=active-elsewhere|cooldown|expired` → `/force-password-change` → `/maintenance` → role home (`STUDENT|PRESIDENT|QAC|FACULTY|ADMIN`). Deep links for each route.
- Unit tests: haversine parity, token decode + `isTokenInValidityWindow` with trusted-clock, section-label, pup-courses lookup, crypto helpers.

### Phase 2 — Student Flows (Gate: tests for scan pipeline + devices gate, full parity walk of student flows = done)

- Login: student number + password (matches web login payload incl. `deviceId`) with the **device-integrity gate** UX from plan/device-integrity-login-plan.md (cooldown pill counting down via TrustedClock; explainer mentioning instructor release + activeDeviceKind), plus `System report` → maintenance redirect.
- Forced password change screen (mirror web/mobile `mustChangePassword`).
- Dashboard parity: stats, today’s schedule with `SCHEDULED|ACTIVE|COMPLETED` badges, subject chips, standing banner (“below the 75% attendance threshold” with dismissal persistence), actions sheet, offline sync panel + readiness chip.
- 3D ID card widget (`digital_id_card.dart`) — 1Hz UTC watermark (`Timer.periodic`, `TrustedClock.now()`), holographic shimmer (`ShaderMask` + gradient tween over rotating gradient colors), magnetic stripe/conditions/emergency back-face, tap-to-flip `pi/2` matrix with `setEntry(3, 2, 0.001)`; device chip showing `…last4`.
- Scanner (`qr_scanner_screen.dart`): ML Kit QR-only scan + frame throttle; **offline validation pipeline < 50 ms** (parse token → public key cache → TrustedClock window → geolocator + isMocked rejection → Haversine < geofence radius), then either fire POST (online) or write `OfflineAttendanceQueue` with UUIDv4 client receipt status `PENDING`, and surface **“Saved on Device (Offline — Pending Sync)”**; share/upload QR fallback modes per opt-in env; manual code entry fallback modal.
- Schedule + history: weekly timetable table (student weekly view), history + filters (All Time/7d/30d + status chips incl. `excused`/`disputed`), pull-to-refresh → drift watermark.
- Disputes: reason enum parity with backend per K11 (student union; labels/icons), 10–1000 char validation with live counter, inline API error display, `role="alert"` equivalents.
- Excuse request (student): `absent|late|incomplete`-eligible records, reason enum + description + evidence image (compressed), status chips + teacher-note display.
- Notifications center: bell badge (unread count), center list, mark-read, deep-link per `type` map, realtime `notifications:new` insert into `NotificationsInbox`.
- AI assistant (student): streaming chat per K12 with standing-aware starter prompts.
- Profile screen: identity, password rotation, contacts (`updateContacts`), device panel (cooldown countdown + unregister with re-auth), “My reports” tab; universal `/profile` parity.
- Enrollment codes; President (session-create + GPS pin) and QAC (proof-of-class capture + geotag + upload) tools; officer-only session detail showing the armed class QR (or “awaiting instructor activation” explainer — Android parity); student subject-detail read-only page with role badges; student system-report reporting; internet-outage simulator pill (dev-only, behind env flag); read-only privacy (RA 10173) screen.

### Phase 3 — Faculty & Classroom Flows (Gate: cockpit E2E-vs-web parity run, unit tests for slot math parity, sweep of sections naming `Section {name} · {course}` everywhere)

- Faculty dashboard: stat cards, attendance trend sparklines, “Students to check on” widget, Today’s Schedule cards with deep links into the cockpit, My Subjects rows.
- Subjects + Sections master (`Section {name} · {course}` per `formatSectionHeading`; PUP course picker parity with web — grouped by department + “Other — specify manually” fallback to string input); subject-create (name/code/description); subject detail sections grid; section detail (roster, officers, enrollment code reset/disable, enroll-student, bulk enrollment import, section-role assignment).
- Session wizard: mode (`in_person|online`, matching backend SessionMode), meeting-slot picker (multi-schedule sections auto-populate times and next occurrence date), bulk slot-aware generator over date range (parity with `frontend/src/lib/session-slots.ts`), geofence map pin for in_person; expiry window 1–15 + grace 60 inputs; duplicate-date warning; Create → API; offline-first no-throw for outdated background sync.
- Live Cockpit (full web parity): Ed25519-signed QR generated locally, dual checkpoint state for `online` sessions (start/end arms, per-leg roster badges, meeting PIN entry + announce chip + regen), zero-GPS privacy card for online, QR validity dialog (1–15 min / grace 0–60), countdown ring, QR fullscreen + share/download + token copy, **geofence radar modal** (accepted pins + denied pins with `124m away · 74m outside geofence` copy, Inside/Denied counters, legend), realtime `attendance:updated` + `attendance:anomaly` + `session:finale` listeners, roster tap-cycles P→L→A with optimistic local write + manual-override audit indicator, incapable-network manual attendance otherwise, End Session (auto-end cron note), and the completion summary.
- Student detail screen (faculty): flippable ID card, attendance-per-session history, governance actions (delegated password reset with one-time credential display, Emergency Device Release with `hadBinding`/`hadCooldown` outcome copy), remove-from-section confirm.
- Disputes blackbox queue + CHED referral (CMO No. 40) actions: scan telemetry drawer (timestamp, distance delta, isMocked, recommendation chip), Accept / Reject / Override; referral state machine (acknowledge → counseling → resolve) for head/admin scope with `student_not_at_risk`/`referral_active` error surfaces; excuse queue (approve/reject/override with evidence viewer); at-risk roster cards per section (head sees department-wide filters).
- Reports & exports: attendance overview with subject/section/date filters, analytics donut + comparisons, **CSV export** (share sheet) and **document downloads** — master list (PDF/DOCX), class record, session attendance (CSV/PDF), CHED notice, DPO summary — all via share/download matching web routes.
- Month/Week calendar (faculty) with event dots/popover deep links; global search entry (role-gated per K13); manual attendance fallback; notifications center (faculty variant); AI assistant (faculty tools per K12).

### Phase 3.5 — Oversight & Administration (Super-admin / IT coordinator / Registrar — Android already ships this suite; the Flutter port must match, gated per K13)

- Admin dashboard (`admin-overview`): counts, live session snapshot, DB/Redis health, recent audit activity.
- User administration: filtered/paginated list (role/status/department/search), student & teacher detail drawers, create flows (generated-credential modal with copy), role change (student↔teacher guards), Add Super Admin, teacher capability tri-state, designation editor (super-admin-only writes), delegated actions (password reset, Emergency Device Release), **bulk user import** (upload→map→validate→commit→report flow, paste-first like Android BM6) and **section enrollment import**.
- Institution settings (4 categorized tabs: Institution · Sessions & attendance · Accounts & access · AI Assistant) + per-tab save/unsaved dots + AI key seal (never rendered) + maintenance trio in the System tab + read-only Privacy (RA 10173) tab; department admins read-only; IT coordinators see System/Privacy only.
- Audit log (filterable list) + **Verify Ledger Integrity** action with `LedgerVerifyResult` banner (web + Android parity).
- Server status (super-admin + IT coordinator): live metrics via `server:subscribe`/`server:metrics`, sparkline cards, snapshot fallback; screen gated like Android.
- System-reports triage (super-admin + IT): category/severity/status/role/date filters, detail sheet with telemetry grid + streamed screenshot (authed fetch), status transitions + admin notes; submitter side already in Phase 2/3 via Report Issue.
- Global search (super-admin): student/section lookup with read-only deep links (Option A accountability rule).
- Maintenance experience: 503-gated router surface with preservation notice, countdown estimate display, exemption pill — matching Android `MaintenanceScreen` and web `MaintenanceProvider` semantics.

### Phase 4 — Sync engine + Play Store Readiness (Gate: e2e flutter_test + integration_test for full journey; `flutter analyze` = 0 issues)

- Background `Riverpod`-led sync worker: on connection regain / app resume / manual tap, batches `PENDING` → `POST /sync/attendance/batches`, reconciles per-record receipts to `CONFIRMED` or `DISPUTED_DUPLICATE`, leaves retryable `FAILED`, exponential-backoff, roll-up journal, Reschedule guard for stale duplicate token.
- Play-store readiness: `app signing` config template + keystore doc, `AndroidManifest.xml` permission foreach (CAMERA, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, INTERNET, VIBRATE), R8/ProGuard keep rules, splash + PUP maroon icon, versionCode policy, `flutter test`, `flutter analyze` zero-issue gate, `flutter build appbundle --release` artifact smoke, release-binary 65k dex safety, sponsored ERB/BetterRollpack rules; data-safety disclosure equivalent table mapped against backend audit contract (location, device id, education).

## 5. Offline-First Sync Engine (single source of truth tables)

Table set (drift; all tables owner-scoped):
```
CachedSubjects / CachedSections / CachedSchedules / CachedRosters,
OfflineAttendanceQueue (clientReceiptId uuid pk, sessionId, studentId,
  scannedToken, checkpoint, pinHash?, latitude, longitude, accuracy,
  haversineDistance, isMocked, scannedAtUtc TrustedClock, syncStatus enums,
  serverError, retryCount, lastSentAt),
SystemReportQueue, ExcuseQueue, NotificationsInbox, ServerStatusSnapshot cache.
```
- Every screen reads from `.watch()` drift streams; network refresh completes into the same DB write, guaranteeing UI/staleness protection.
- All offline writes carry UUID receipts and trusted-clock timestamps; 503/system_maintenance-aware network classification.
- Verification test: airplane-mode scan → “Saved on Device” → reconnect auto-drains with batch receipts; airplane-mode scan twice for same token yields `DISPUTED_DUPLICATE` UX identical to web.

## 6. Workflow & Gates (mirrors directive)

| Gate | Enforced by |
|---|---|
| Every Dart file compiled through build_runner + `dart format` and `flutter analyze` 0 issues | `justfile`/CI script per phase |
| Crypto/Haversine/token/section-label/slots parity tests vs TS vectors green in phase 1 | `polycheck_mobile/test/core/` |
| Full parity walkthrough checklist per feature (with screen-table in-plan updates each phase) | subagent run book |
| **Route-parity matrix: all 39 web routes (`frontend/src/app/**/page.tsx`) mapped to a Flutter screen or an explicitly justified deferral — zero unaccounted gaps at VER** | parity audit table in-plan |
| Play Store readiness audit (signing, data safety, permissions, R8 rules) | release checklist |

## 7. Debt / intentionally deferred (recorded for parity audit)

0. **Coexistence, not replacement (this wave).** The RN `android/` app keeps shipping — the Flutter port runs as `polycheck_mobile/` in parallel until all gates pass. Any `android/**` file touched by this port is a BUG; tests and CI must verify `git status -- android` stays clean per phase gate.

1. iOS is out of scope for the Nov 18–20 submission; Android `.aab` first (`polycheck_mobile/` is structured for a later iOS pass without feature rewrites).
2. **Device fingerprinting beyond `deviceId`**: we use the same `deviceId` strategy as the React Native app; enhanced fingerprinting remains a backend waveform (v2 roadmap, out of scope).
3. Web-push style PWA equivalents don’t apply; push notifications use FCM only if time permits (same as Android app wave), else queued for post-defense.
4. QR signing key rotation UX parity — currently uses the same refresh lifecycle as Android app; if backend enforces new rotation windows during defense window, we adopt a server-driven TTL only.
5. Android `expo-*` some view-level components (e.g. exact RN “Bluetooth-mock” restrictions) are quality-parity concerns, not feature parity; logged under the master mobile improvement plan.
6. **Kiosk projector stage stays web-only** (matching the existing Android decision — the mobile app keeps the live cockpit; the projector/kiosk finale is a desktop/projector surface). Recorded per the Feature Parity Gate justification rule; revisit only if defense demo requires it.
7. **Scope risk note (added with Phase 3.5 + assistant/notifications):** the flutter port now covers the full web parity surface (39 routes) — the deadline is unchanged, so Phase 3.5 admin screens deliberately reuse the same list/detail shells from Phase 3 and stay functionally simple rather than visually novel; the capstone wow-features (cockpit, ID hologram, radar, offline) are unchanged.

## 8. Next actions

1. FX gate: confirm e2e base URL, Better Auth endpoints, and two-way shared types using a read-only inspection of `shared/src/`, `backend/src/` (auth/attendance/sync), plus `frontend`/`android` network layers.
2. Scaffold `polycheck_mobile/` per §2, produce a `pubspec.lock` pinned set, run Phase 1 gates.
3. Phase-by-phase exec as per §4 with per-device verification walkthroughs; log deviations into this file.

---

## 9. Implementation Addendum (delivered)

**Status:** Implemented (A1–A3, B1–B5, C1, VER) — 2026-11-10. Flutter **3.44.2** / Dart **3.12.2**; new sibling package `polycheck_mobile/`; application id `edu.pup.polycheck.mobile` (coexists with the RN app `edu.pup.polycheck`). The RN `android/` tree stayed byte-identical — `git status --porcelain -- android` is empty.

### 9.1 Delivered

| Wave | Delivered |
|---|---|
| **A1–A3 — foundation + auth** | Pinned `pubspec.lock`; freezed/json models mirroring `shared/src/types`; PUP zero-radius theme (maroon/gold/ink, Lora + DM Sans, 1px borders); drift owner-scoped schema; Dio client with typed `ApiRequestError`; `TrustedClock` (`/health` midpoint offset, persisted); go_router guard ladder (restore → auth → role → forced rotation → maintenance → role section) with password-change and maintenance recovery; portal select, student/faculty login (device id + `active_session_elsewhere` explainer + trusted-clock cooldown countdown), forced-password rotation, maintenance screen. |
| **B1–B2 — student** | Dashboard (standing banner, readiness chip, Sync now, offline strip), weekly schedule, history with filters + dispute/excuse submission, 3D ID card with 1 Hz trusted-UTC watermark + hologram sweep + masked device chip, profile/device/contacts. Scanner: live camera, uploaded-image decode, manual token entry, trusted-clock window, mock-location + accuracy + Haversine geofence, meeting-PIN phase, online zero-GPS mode, owner-scoped offline queue (no plaintext PIN at rest) with "SAVED ON DEVICE" outcome. |
| **B3 — student officer** | Enrollment code, officer session creation with geofence + current location, student section detail, student session detail (signed class QR when armed, otherwise "awaiting instructor activation"), read-only privacy (RA 10173). |
| **B4 — faculty classroom** | Dashboard, subjects/sections master (`Section {name} · {course}`), create subject/section (catalog course picker + custom code), section detail (roster, search, pagination, officers, enrollment code reset/disable, enroll student, section import), session wizard (in-person/online, class-meeting selector, slot-aware bulk `slots`), dual-checkpoint cockpit (locally Ed25519-signed QR, `QrImageView` + fullscreen stage, countdown, meeting PIN hash/announce/regenerate, realtime `attendance:updated`/`attendance:anomaly`/`session:finale`, per-leg roster, manual overrides, teacher-location override dialog, end session + auto-end copy), faculty student detail (flippable ID, governance reset/release, remove from section). |
| **B5 — faculty oversight** | Disputes queue with scan-telemetry timeline + recommendation chip, excuses queue with evidence, at-risk roster + CHED CMO No. 40 referral state machine (`generated → acknowledged → counseling_scheduled → resolved`), attendance overview, reports + donut + CSV/document downloads/share sheet, month/week schedule, notifications centre, role-tuned assistant. |
| **C1 — admin console** | Dashboard (`admin-overview`), users (server search/filters/pagination, edit, role change, add super admin, create with one-time credential dialog, delegated reset/release, designations, paste-first bulk import + section import), institution settings (4 tabs, per-tab save, maintenance trio, AI availability, sealed API key never rendered, read-only privacy tab), audit log + **Verify Ledger Integrity** banner, live **Server status** (`server:subscribe` / `server:metrics`, unsubscribe on exit, snapshot fallback), system-reports triage (filters, telemetry, authenticated screenshot, status transitions), global search (read-only). Designation gating follows `shared/src/utils/designations.ts` (super-admin implicit-all; IT: server status / triage / settings System; registrar: department-pinned users; heads: no console). |
| **Sync engine** | Drift `OfflineAttendanceQueue` (receipt UUID, trusted-clock `scannedAt`, nullable coordinates, no plaintext PIN), batch cap 100, receipt polling, `CONFIRMED` / `DISPUTED_DUPLICATE` (first-arrival-wins) / retryable `FAILED` / terminal evidence retained, exponential backoff (5 s → 5 min), abort on 401/maintenance, owner-scoped purge, automatic drain on app resume / connectivity regain / student session + manual **Sync now**. |
| **Release** | `edu.pup.polycheck.mobile`, minSdk 26 / targetSdk 36, permissions (CAMERA, fine/coarse location, INTERNET, VIBRATE, POST_NOTIFICATIONS declared-but-unrequested), R8 + shrink + keep rules, PUP maroon splash (light) / black (night), legacy + adaptive + monochrome icons, versionCode policy from `pubspec.yaml`, `android/key.properties` opt-in signing with debug-key fallback, `RELEASE.md` runbook + Play data-safety mapping. |

### 9.2 Verification (re-run for this addendum)

| Gate | Result |
|---|---|
| `flutter pub get` | OK (1 discontinued package warning: `flutter_markdown` → upstream rename; no resolution errors). |
| `dart format --output=none --set-exit-if-changed lib test` | **300 files, 0 changed**, exit 0. |
| `flutter analyze` | **No issues found**, exit 0 (10.9 s). |
| `flutter test` | **476 / 476 passed**, 0 failed / 0 skipped (64 `*_test.dart` files, ~25 s). |
| `flutter build apk --debug` | Built `build/app/outputs/flutter-apk/app-debug.apk` (200,649,186 B / 191.35 MiB), exit 0. (The earlier `flutter_image_compress` KGP warning was later removed by replacing the plugin with pure-Dart compression — see §9.4 tooling row.) |
| Existing release AAB | `build/app/outputs/bundle/release/app-release.aab`, **81,103,989 B / 77.35 MiB** (modified 2026-11-10 20:59). `jarsigner -verify` = jar verified; certificate **`CN=Android Debug`** → debug-key fallback (no `key.properties`). Not rebuilt for this audit. |
| Existing release APK | `build/app/outputs/flutter-apk/app-release.apk`, 90,984,782 B / 86.77 MiB (also debug-signed fallback). |
| Repo hygiene | `git status --porcelain -- android` empty; only `plan/flutter-mobile-port-plan.md` and `polycheck_mobile/` untracked; no `key.properties`, `.jks`, or `.keystore` inside the package (`key.properties.example` only); `build/` + `.dart_tool/` ignored; no secrets found in source. |
| Toolchain | `flutter doctor`: Flutter 3.44.2 stable, Android SDK 36.1.0; **cmdline-tools missing** and Android license status unknown (the known post-build AAB `apkanalyzer` check caveat). |

### 9.3 Route-parity matrix (all 39 web routes)

| Web route (`frontend/src/app/**/page.tsx`) | Flutter route / screen | Status |
|---|---|---|
| `/` | `/` `PortalSelectScreen` | Real |
| `/login` | `/` portal select (role chooser; guard redirects `/login` → `/`) | Real (equivalent) |
| `/login/faculty` | `/login/faculty` `FacultyLoginScreen` | Real |
| `/login/student` | `/login/student` `StudentLoginScreen` | Real |
| `/faculty` | role-prefix redirect → `/faculty/dashboard` | Real |
| `/faculty/assistant` | `/assistant` `AssistantScreen` (shared, faculty-tuned) | Real |
| `/faculty/at-risk` | `/faculty/at-risk` `FacultyAtRiskScreen` | Real |
| `/faculty/attendance` | `/faculty/attendance` `FacultyAttendanceScreen` | Real |
| `/faculty/audit-logs` | `/admin/audit-logs` `AuditLogsScreen` (super admin) | Real (console path) |
| `/faculty/disputes` | `/faculty/disputes` `FacultyDisputesScreen` | Real |
| `/faculty/excuses` | `/faculty/excuses` `FacultyExcusesScreen` | Real |
| `/faculty/reports` | `/faculty/reports` `FacultyReportsScreen` | Real |
| `/faculty/schedule` | `/faculty/schedule` `FacultyScheduleScreen` | Real |
| `/faculty/search` | `/admin/search` `GlobalSearchScreen` | **Partial** — super-admin only (web also allows teachers) |
| `/faculty/sections/create` | `/faculty/sections/create?subjectId=…` `SectionCreateScreen` | Real |
| `/faculty/sections/[id]` | `/faculty/sections/:id` `SectionDetailScreen` | Real |
| `/faculty/sessions` | `/faculty/sessions` (+ `?sectionId=`) `FacultySessionsScreen` | Real |
| `/faculty/sessions/create` | `/faculty/sessions/create` (+ `?sectionId=`) `SessionCreateScreen` | Real |
| `/faculty/sessions/[id]` | `/faculty/sessions/:id` `SessionCockpitScreen` | Real |
| `/faculty/sessions/[id]/kiosk` | — | **Deferred** — web-only projector stage (§7.6, same decision as RN) |
| `/faculty/server-status` | `/admin/server-status` `ServerStatusScreen` (super admin + IT) | Real (console path) |
| `/faculty/settings` | `/admin/settings` `AdminSettingsScreen` (super admin + IT; privacy tab read-only) | Real (console path) |
| `/faculty/students/[id]` | `/faculty/students/:id` `FacultyStudentDetailScreen` | Real |
| `/faculty/subjects` | `/faculty/subjects` `FacultySubjectsScreen` | Real |
| `/faculty/subjects/create` | `/faculty/subjects/create` `SubjectCreateScreen` | Real |
| `/faculty/subjects/[id]` | `/faculty/subjects/:id` `SubjectDetailScreen` | Real |
| `/faculty/subjects/[id]/sessions` | `/faculty/subjects/:id/sessions` `FacultySessionsScreen(subjectId:)` | Real |
| `/faculty/system-reports` | `/admin/system-reports` `SystemReportsScreen` (super admin + IT) | Real (console path) |
| `/faculty/users` | `/admin/users` `AdminUsersScreen` (super admin + registrar) | Real (console path) |
| `/offline` | — | **Deferred** — PWA shell fallback; native equivalent is the offline cache/queue + offline banner |
| `/privacy` | `/privacy` `PrivacyScreen` → `PrivacyPanel` | Real |
| `/profile` | `/profile` `ProfileScreen` (+ `?tab=security|contacts|device|reports|notifications|privacy|dev`) | Real |
| `/student` | `/student` → redirect `/student/dashboard` | Real |
| `/student/assistant` | `/assistant` `AssistantScreen` (shared, student-tuned) | Real |
| `/student/dashboard` | `/student/dashboard` `StudentDashboardScreen` | Real |
| `/student/schedule` | `/student/schedule` `StudentScheduleScreen` | Real |
| `/student/subjects/[id]` | `/student/subjects/:id` `StudentSectionDetailScreen` | Real |
| `/student/subjects/[id]/create-session` | `/student/subjects/:id/create-session` `StudentCreateSessionScreen` | Real |
| `/student/subjects/[id]/sessions/[sessionId]` | `/student/subjects/:id/sessions/:sessionId` `StudentSessionDetailScreen` | Real |

### 9.4 Deviations / gaps (recorded at VER)

| Area | Deviation | Impact / disposition |
|---|---|---|
| Global search | Flutter exposes the console search (`/admin/search`) to super admins only; web `/faculty/search` also allows plain teachers. | Minor parity gap (read-only lookup); backend `/search` is role-scoped. Follow-up if teachers need mobile lookup. |
| Assistant entry gating | Student app-bar and faculty shell assistant icons are unconditional; `AssistantScreen` renders the policy-blocked state and the backend returns 403. Profile entry is gated by `shouldShowAssistantEntry`. Web/RN hide the entry entirely. | Minor UX deviation; no policy bypass (server enforced). |
| Teacher offline cockpit | QR signing is local, but activation (`POST /sessions/:id/activate`), end session, and manual attendance/status calls require the API; there is **no `session_activation`/manual-write offline queue** (unlike web/RN cockpit M4). | Parity gap for offline classroom activation; in-class attendance evidence on the student side is unaffected. Decide whether to port the queue. |
| Scan-time signature verify | The offline scanner validates token shape/window/PIN/geofence but does not locally verify the Ed25519 signature against a cached teacher public key; the server verifies on submit/sync. | Defense-in-depth/UX difference; forged tokens queue then fail terminally server-side. |
| PIN cold start | Meeting PINs live only in the process-lifetime `AttendancePinVault` (never at rest). After a cold start, a queued PIN-protected scan replays without the PIN and is rejected terminally (`pin_required`); evidence is retained for review, never silently discarded. | Accepted limitation; needs a product decision (encrypted PIN persistence vs force online rescan). |
| Push notifications | No FCM/provider wiring; `POST_NOTIFICATIONS` is declared but never requested. Notifications are in-app + realtime `notifications:new`. | Deferred (same as RN post-defence work). |
| Background sync | Drains on app resume, connectivity regain, student session activation, and manual **Sync now**; no OS-scheduled background work. | Deferred; queue is durable. |
| Assistant threads | Server threads (7-day TTL) are browsable/deletable from the Conversations sheet, but the current thread id is not persisted across launches; a relaunch starts a new thread. | Minor UX gap; `RELEASE.md` wording ("cross-launch browsing") overstates the limitation. |
| Kiosk | No `/faculty/sessions/:id/kiosk`; mobile keeps the live cockpit. | Justified web-only projector surface (§7.6). |
| PWA `/offline` | No native page; the native equivalent is the drift cache/queue + offline banner. | Justified (native app has no service-worker shell). |
| AAB signing | No `android/key.properties` → release AAB/APK are **debug-signed** (`CN=Android Debug`). | Must not be uploaded; create the upload keystore before Play submission. |
| AAB post-build check | `cmdline-tools` is missing, so `flutter build appbundle` exits 1 **after** writing a valid, already-stripped AAB (`Release app bundle failed to strip debug symbols…`). `jarsigner -verify` passes. | Cosmetic/tooling; install cmdline-tools for a clean exit 0 + `apkanalyzer` confirmation. |
| iOS | Not built; Android `.aab` is the submission target. | Deferred by plan §7.1. |
| Tooling warning (resolved) | `flutter_image_compress_common` applied its own Kotlin Gradle Plugin; the plugin was removed in favour of pure-Dart `image`-package compression (`core/utils/image_compression.dart`), eliminating the forward-compat warning and native surface. | None — resolved + covered by `image_compression_test.dart`. |

### 9.5 Follow-ups

1. **Release signing:** generate the upload keystore **outside the repo**, copy `android/key.properties.example` → `android/key.properties`, rebuild the AAB, and confirm the signer is the upload certificate (not `CN=Android Debug`).
2. **Clean AAB build:** install Android `cmdline-tools`, accept SDK licenses (`flutter doctor --android-licenses`), and re-run `flutter build appbundle --release` to exit 0; verify BUNDLE-METADATA symbols with `apkanalyzer`.
3. **Play Console:** bump `version:` `+N` monotonically, upload to internal testing, attach `mapping.txt`, complete Data safety (use `RELEASE.md` §7), content rating, target audience, and privacy-policy URL.
4. **PIN persistence decision:** either encrypt PINs at rest in the owner-scoped queue or force an online re-scan after cold start; align Flutter with web/RN.
5. **Offline teacher cockpit:** port the `session_activation` queue + offline manual overrides if in-class activation without connectivity is required.
6. **Parity polish:** expose global search to teachers (or document web-only), gate assistant entries with `shouldShowAssistantEntry`, and consider local signature verification in the scanner.
7. **Post-MVP:** FCM push, OS background sync, iOS pass, and physical-device smoke (login, in-person + online scan, offline save → reconnect drain, ID card, cockpit QR, assistant, maintenance).

