# Flutter Client (`polycheck_mobile/`) vs RN (`android/`) + Web (`frontend/`) — Defense & Parity Gap Report

Audit date: 2026-11-10. Read-only. Exact evidence citations: `path:line`.
Flutter scan pipeline = `polycheck_mobile/lib/src/features/student/data/student_scan_service.dart` ("F-scan") and `.../presentation/scan/student_scan_screen.dart` ("F-screen").

---

## 1. Scanner pipeline defenses (RN `android/app/(tabs)/scan.tsx` + RN libs + web modal)

### a. Location accuracy gate — **THRESHOLD DRIFT**
- RN android: offline pre-check rejects fixes worse than **50 m** before queueing — `android/services/api-client.ts:1334-1337` (`(evidence?.accuracyMeters ?? 0) > 50` → `"Location accuracy is too poor to verify attendance"`). Live path sends `accuracyMeters` as-is (`android/app/(tabs)/scan.tsx:261`).
- Web: identical 50 m gate — `frontend/src/lib/api-client.ts:1329-1332`.
- Server truth: mobile cap `MAX_LOCATION_ACCURACY_METERS = 50`, web cap `MAX_WEB_LOCATION_ACCURACY_METERS = 500` — `backend/src/attendance/types.ts:7-8`; enforced `backend/src/attendance/scan-validator.service.ts:261-267` → disputed `poor_location_accuracy`.
- Flutter: **100 m** live gate — `student_scan_service.dart:66-70` (`position.accuracy > 100` → `"GPS accuracy is too low (N m). Move to an open area and try again."`).
- Consequence: a 50–100 m fix passes Flutter locally, then the server disputes it (`poor_location_accuracy`) — user sees "verified" locally then a flagged record. No Flutter offline re-check.
- Fix: set Flutter live gate to `> 50` (mobile parity) and keep a queue-side accuracy ≤ 50 assertion before enqueue (mirror RN's pre-check in `submitToken`, reject before `attendanceApi.submitScan`), or make the constants shared.

### b. Location staleness/age — **MISSING in Flutter**
- RN: derives capture time client-side — `locationCapturedAt = new Date(new Date(scannedAt).getTime() - locationAgeMs).toISOString()` (`android/app/(tabs)/scan.tsx:255-258`), and the offline pre-check rejects `|capturedAt - locationCapturedAt| > 2 min` — `android/services/api-client.ts:1338-1349` (`"Location fix is stale. Acquire a fresh location and try again."`). Web identical — `frontend/src/lib/api-client.ts:1333-1344`.
- Server truth: `MAX_LOCATION_AGE_MS = 2 * 60_000` — `backend/src/attendance/types.ts:6`; enforced `scan-validator.service.ts:237-243` (with −30 s tolerance).
- Flutter: no staleness gate; sends GNSS `position.timestamp` as `locationCapturedAt` — `student_scan_service.dart:76,249,267`.
- Fix: reject when `trustedNow - capturedAt > 2 min` (±30 s) before submit, and use a trusted-clock-derived `locationCapturedAt` (see k).

### c. Best-accuracy acquisition — **PARITY (with a small delta)**
- RN: `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })` — `android/app/(tabs)/scan.tsx:251-253` (no timeout/watch). Web: `navigator.geolocation` + `±Nm` accuracy toast — `frontend/src/components/ScanQrModal.tsx:195-221`.
- Flutter: `LocationAccuracy.bestForNavigation` + `timeLimit: 20 s` — `student_scan_service.dart:60-65`.
- Delta: Flutter's 20 s timeout can yield *no fix* (currently falls to generic "Your location could not be verified" `:80-84`) where expo waits indefinitely. Acceptable; keep the timeout, but surface "GPS was slow — step outside and retry" on timeout for UX parity.

### d. Mocked GPS — **PARITY**
- RN: offline reject `"Mocked locations are not accepted"` — `android/services/api-client.ts:1312-1313`; sends `mocked` flag (`scan.tsx:262`); server disputes `mocked_location` — `backend/src/attendance/scan-validator.service.ts:283-284`.
- Flutter: rejects earlier client-side `"Mock location detected. Turn off any location-spoofing app and try again."` — `student_scan_service.dart:222-226`; persists `isMocked` on the queue row (`:313`) and sends `mocked: true` when true (`sync_engine.dart:153`).
- No gap.

### e. Geofence rejection copy + accuracy intersection — **PARITY (cosmetic copy drift)**
- `isWithinGeofence` = `distance <= radius` in the shared util; accuracy is NEVER intersected client-side on RN/web/Flutter: `shared/src/utils/haversine.ts:28-37`. Server-side accuracy interaction (the suspicious-radius signal `distance + accuracy > radius`) lives in `scan-validator.service.ts:270-272` — Flutter inherits it for free by sending `accuracyMeters`.
- RN android offline copy: `"You are outside the session geofence"` — `android/services/api-client.ts:1331-1333`.
- Web copy (richer): `"You are outside the session geofence (X m away, allowed Y m)."` — `frontend/src/lib/api-client.ts:1324-1327`.
- Flutter copy: `"You are X m from the class location (Y m geofence). Move closer and try again."` — `student_scan_service.dart:237-241` — equivalent semantics.
- No functional gap.

### f. Duplicate-scan guards — **PARTIAL**
- RN android: `scannedRef` + `scanOpRef` (>400 scan-op generations) + blur reset via `resetScannerOnBlur` (`android/app/(tabs)/scan.tsx:111-113,158-176,379-381`; camera scan suppressed while a modal/result is open `:504-507`).
- RN web (browser-only extra): before queueing, checks cached records and refuses a second enrollment — `frontend/src/lib/api-client.ts:1353-1368` (`"Attendance for this session was already saved on this device."`).
- Flutter: camera gate `_processing || _promptOpen || _analyzing || _outcome != null` (`student_scan_screen.dart:57-63`); generation counter `_generation` + dispose invalidation (`:32,45-54,144`); idempotent `clientAttemptId` → unique queue key (`sync_engine.dart:140`) and server first-arrival-wins duplicate → `DISPUTED_DUPLICATE` retention (`sync_engine.dart:180-184,396-403`).
- Missing in Flutter (and in RN android): the web-style local "already saved on this device" guard before POST/queue. Fix: consult `database.cachedAttendance` for `(sessionId, studentId)` before submit; short-circuit with a "Already checked in" outcome.
- No "already-submitted toast" exists in any client (server duplicate → disputed/queued) — none needs to be invented, but the web guard above would create one.

### g. Trusted clock for window checks — **PARITY**
- RN: `scannedAt = await api.getTrustedTimestamp()` (`android/app/(tabs)/scan.tsx:230`); offset cached with 7-day TTL (`frontend/src/lib/offline/store.ts:103-105`); window math reads signed `issuedAt`/validity from the payload (RN `api-client.ts:1304-1311`).
- Flutter: `isTokenInValidityWindow(payload, trustedClock.nowMs(...))` (`student_scan_service.dart:165-168`) and trusted `scannedAt` (`:252-255`); offset persisted + 5-min refresh (`providers/trusted_clock.dart`, incl. midpoint math; refresh interval at `:57`).
- No gap.

### h. Local Ed25519 signature verification — **MISSING in Flutter (definitive)**
- RN: verifies the scanned teacher token against the cached `teacherPublicKey` on the **offline path** — `android/services/api-client.ts:1295-1299` (`verifyQRToken(...)` → `"QR token signature is invalid"`); same in `checkAttendance` offline (`:1433-1446`) and on web (`frontend/src/lib/api-client.ts:1291-1295`). Online submissions rely on server verification.
- Flutter: `decodeTokenPayload` only (`student_scan_service.dart:158-163`); `token_crypto.dart:126-138` decodes without any signature step. A `verifyToken` helper exists — `features/faculty/data/teacher_signing_key.dart:201` — but has **zero call sites** (rg confirms; dead code).
- Consequence: an offline-tampered token is queued in Flutter (later rejected server-side as terminal evidence), while RN fails fast with a clear reason.
- Fix: in `submitToken`'s offline branch, call `verifyToken(token, cached.transport?.teacherPublicKey ?? session.teacherPublicKey)` and refuse to queue on failure, mirroring `api-client.ts:1295`.

### i. Server rejection-reason labels the scanner sheet can render — **FULL COVERAGE**
Full `DisputeReason` union (7 student + 12 system incl. `concurrent_session_conflict`) is defined in `polycheck_mobile/lib/src/core/models/attendance.dart:131-151` and labeled/iconed completely in `features/faculty/data/faculty_logic.dart:41-61` (labels) and `:63-83` (icons). All 12 system reasons present: `Outside Geofence / Expired Token / Duplicate Submission / Invalid Signature / Device Mismatch / Suspicious GPS / Other / Delayed Offline Sync / Invalid Timestamp / QR Token Mismatch / Inactive Session / Not Enrolled / QR Expired / Rate Limited / Mock GPS · Fake Location / Rooted · Jailbroken Device / Hooking Tool Detected / Android Emulator Detected / Concurrent Session`. RN android map: `android/app/(faculty)/disputes.tsx:19-37`. Web only has a dedicated badge component for 4 security reasons (`frontend/src/app/faculty/disputes/security-dispute-badge.tsx:12-37`); the rest are generic rows.
- **No Flutter label is missing.** Note: label *copies* differ from RN android (e.g. Flutter `Rooted / Jailbroken Device` = RN copy ✓; Flutter `Hooking Tool Detected` vs RN `Hooking tool detected` — casing only; Flutter `Android Emulator Detected` vs RN `Android emulator detected`). Cosmetic.

### j. Offline queue semantics — **3 behavioral gaps + 1 intentional divergence**
- RN android queue: SQLite `sync_queue_v2` (`android/services/offline-store.ts:57-61`), encrypted at rest (nacl secretbox; key `polycheck.offline-encryption-key.v1` in SecureStore — `offline-crypto.ts:5-45`), idempotent `INSERT OR IGNORE` keyed `kind:clientAttemptId` (`offline-store.ts:341-354`), drain selects FIFO 100 skipping `terminal:` rows (`:365-369`), result classification `synced/pending/retryable/terminal` (`:7-11,387-408`), single receipt GET after the batch post (`android/services/api-client.ts:1938-1949`; pending stays queued), **30 s periodic drain** + AppState-active trigger (`android/app/_layout.tsx:190,191-193`), pending count excludes terminal rows (`offline-store.ts:427-438`), manual `retryOfflineOperation(id)` preserving original evidence (`:485-487`), terminal cleanup deletes the optimistic/phantom record (`api-client.ts:1966-1973`).
- Web panel: `frontend/src/components/OfflineSyncPanel.tsx` (see §4) + per-row Retry (`:172-181`).
- Flutter queue: drift `offline_attendance_queue` with `pinHash` only (`core/database/app_database.dart:192-217`, pinHash at `:199`); **cache is not encrypted at rest** (`attendance_pin_vault.dart:3-11`); batch ≤ 25 (`sync_engine.dart:213`; server cap 100 at `:19`); receipts polled 400 ms × 30 max (`:211,442-452`); backoff 5 s → 5 min cap (`:22-25,104-111`); terminal errors keep the row forever with `terminal:` prefix + `DISPUTED_DUPLICATE` flag (`:118,396-412`); 4xx non-terminal class → terminal immediately (`:482-495`); triggers = cold-start/resume/connectivity-regain/session-start + manual Sync now (`sync_lifecycle_binder.dart:43-95`; no periodic timer).
- Gaps to close for parity:
  1. **PIN persistence**: RN persists the plaintext PIN **inside the encrypted queue payload** (`enqueueOfflineOperation('attendance_scan', payload)` where payload includes `pin` — `android/services/api-client.ts:1274-1283,1358`; encrypted via `encryptOfflineValue` — `offline-store.ts:346-354`). Flutter keeps it in the process-lifetime `AttendancePinVault` only (`attendance_pin_vault.dart:3-37`), so a cold start turns a PIN-protected offline scan into a terminal `pin_required`. Fix (pick one): persist the PIN **encrypted** in the queue row (drift + dart `cryptography`/age-encrypted table — RN-parity path), or keep the vault but re-prompt for the PIN on drain after cold start when `pinRequired && pinHash` present (server-parity path; current behavior loses the scan's credit silently → terminal evidence only).
  2. **Periodic foreground drain**: RN drains every 30 s while the app is open; Flutter drains only on lifecycle events. Fix: add a 30 s `Timer.periodic` in `SyncLifecycleBinder` (or drive it from `syncControllerProvider`), guarded by the existing in-flight future.
  3. **Per-row manual retry**: web has row-level Retry with the original attempt id (`OfflineSyncPanel.tsx:172-181`; RN `retryOfflineOperation` — `android/services/offline-store.ts:485-487`). Flutter dashboard has only a global "Sync now" — `student_dashboard_screen.dart:243-314`. Fix: expose per-row retry for `failed` rows (reuse `markQueuePending` + `drainNow`), keeping the same `clientReceiptId`.
  - Terminal retention + first-arrival-wins + optimistic-record cleanup: **at parity** (Flutter keeps terminal rows; RN deletes the phantom cached row while keeping the queue row for evidence — Flutter's optimistic rows are virtual (`isSynced:false` readers), equivalent).

### k. `locationCapturedAt` placement — **SENT BY ALL; value-source drift**
- Backend DTO accepts client-supplied `locationCapturedAt` (IsDateString) alongside `accuracyMeters`, `mocked`, `inputChannel` (`camera|image|manual`), `pin`, `deviceSecurity` — `backend/src/attendance/dto/attendance.dto.ts:25-33`; scan body `ScanAttendanceDto` = `sessionId, lat, lon, deviceId, qrToken, scannedAt` (`:45-52`).
- RN: sends it, computed from **trusted** `scannedAt` minus GNSS-fix age (`android/app/(tabs)/scan.tsx:255-258`).
- Flutter: sends it (`student_scan_service.dart:267` → `ScanEvidenceInput.toJson` `'locationCapturedAt'` in `core/api/api_models.dart`) but the value is raw `position.timestamp` (GNSS device clock — `student_scan_service.dart:76`). For clock-drift parity, derive it from relevant trusted time: Flutter should mimic RN (trusted scannedAt − (trustedNow − capturedAt)).

### Extra scan-pipeline gap: **deviceSecurity (root/hook/emulator) is never captured in Flutter**
- RN: `getDeviceSecuritySnapshot()` probes su/Magisk paths, Frida/Xposed globals, and emulator fingerprints (`android/services/device-security.ts:8-146`), sent as `deviceSecurity.evidence…` (`api-client.ts:1360-1377`) and `scan.tsx:232,285`. Server uses it to dispute: rooted → `rooted_device`, hook → `hook_detected`, emulator → `emulator_detected` (`scan-validator.service.ts:295-297`; DTO `attendance.dto.ts:19-23,32`); the RN offline path also pre-disputes the optimistic record (`api-client.ts:1359-1379`).
- Flutter: `DeviceSecurityEvidence` DTO exists (`core/api/api_models.dart:483-523`) but **nothing populates or sends it** — `ScanEvidenceInput` built at `student_scan_service.dart:264-270` omits it; there is no equivalent detection module anywhere in `polycheck_mobile/lib` (rg: no `frida|xposed|magisk|su-path` code). Verdict: the entire client-attestation anti-cheat layer is inert for Flutter users.
- Fix: port `device-security.ts` to Dart (path probes via `Directory(...).existsSync()` for the KNOWN_ROOT_PATHS list, `Platform` version/fingerprint heuristics for emulator), wire into `ScanEvidenceInput.deviceSecurity`, and mark queued rows disputed when flagged — mirror `api-client.ts:1359-1379`.

---

## 2. Session / device defenses beyond login gates

| Defense | RN (android / web) | Flutter | Verdict |
|---|---|---|---|
| `auth:session-replaced` termination monitor | `android/services/realtime.ts:138-152` subscribes; `android/app/_layout.tsx:150-166` runs `shouldTerminateForReplacedSession` (`android/lib/session-replacement.ts:23-34`) = skip-while-own-login-in-flight + `restoreSession()` probe; toast `"Your session was replaced or revoked. Please sign in again."` + `api.logout()` | **No listener anywhere** (rg `session-replaced|session_replaced` in `polycheck_mobile/lib` → 0 hits). Flutter `SessionApi` has no `/auth/me` probe hook (only `me()` for refresh) | **GAP** — security revocations (password reset, role/status change, force-rotation) only reach Flutter via the next 401 instead of instantly. Fix: join the user room in a root Riverpod service; on `auth:session-replaced`, keep in-flight-login stamp (`dio_client` knows login start), run `sessionApi.me()` probe, terminate + clear local state on confirmed null |
| Device cooldown login gate UI | RN android: generic error only (no countdown) — known LI4 gap; Web: full gate — ticking countdown + Try-again (`frontend/src/components/auth/StudentLoginDeviceGate.tsx`, `:210`) | Countdown panel + explainer + Try-again — `auth/presentation/widgets/device_gate_panels.dart:103-250` (cooldown chip `:219`, Try-again `:242`, zero-copy `:250`) | **PARITY (Flutter ≥ RN android; = web minus nothing material)** |
| Per-screen role gates | `android/hooks/use-auth-gate.ts:26-51` (roles[], `allow` predicate, must-change-password, sign-out stamp) | Guard ladder in `core/router/router_decision.dart:109-210` + designation subsets (`:35-74`: IT → server-status/system-reports/settings; registrar → users), shared paths, admin enforcement | **PARITY (structural)** |
| Forced password rotation interlock | `android/app/change-password.tsx` + `useAuthGate` mustChangePassword → replace (`android/hooks/use-auth-gate.ts:42-43`) | `auth/presentation/force_password_change_screen.dart` + ladder `router_decision.dart:158-164` (redirects everything incl. maintenance handling) | **PARITY** |
| Teacher signing provisioning guard | `"Connect to the internet once to register this device before generating offline QR codes."` typed fail-closed 4xx — `android/services/api-client.ts:549` (+ tests `android/__tests__/api-client-bindings.test.ts:1479,1607`) | Same copy, typed `ApiRequestError(status: 400)` fail-closed — `features/faculty/data/teacher_signing_key.dart:251-259` | **PARITY** |
| Privacy consent gate | `android/components/PrivacyConsentGate.tsx:20` (`"Connect to the internet to review and accept the privacy notice."`) + `acceptPrivacyConsent` | `auth/presentation/widgets/privacy_consent_gate.dart:203` (same copy) + `session_api.dart` `acceptPrivacyConsent`/`getPrivacyNotice`; ladder "shared paths" hold | **PARITY** |
| Offline PIN persistence | **Encrypted at rest** in `sync_queue_v2.payload` (secretbox, SecureStore key `polycheck.offline-encryption-key.v1`): `android/services/offline-store.ts:336-354` + `offline-crypto.ts:5-45`; PIN survives cold start | Process-memory only (`attendance_pin_vault.dart:3-37`); drift stores `pinHash` (not plaintext) but never the PIN (`app_database.dart:199,946-953`) | **DIVERGENCE** (RN more functional; Flutter safer). RN-parity requires an encrypted queue column. See §1.j fix |
| Scan-window validation uses signed `issuedAt` | RN `api-client.ts:1304-1311,1351-1357` | Flutter `token_crypto.dart:142-159` via `isTokenInValidityWindow(payload, trustedNowMs)` (also +30 s issued-tolerance parity: RN `1353`, Flutter uses payload math only — tolerance not ported; cosmetic) | **PARITY (minor)** |

---

## 3. Method parity: `android/services/api-client.ts` (≈118 methods) vs `polycheck_mobile/lib/src/core/api/*.dart`

Covered (verified present, same paths/payload shapes): `acceptPrivacyConsent`, `addAttendanceRecord`, `assignSectionRole`, `changePassword`, `changeUserRole`, `checkAttendance`, `checkSessionPermission`, `createAdmin/BulkSessions/Section/Session/Student/Subject/SystemReport/Teacher`, `decideExcuse`, `deleteAiThread`→`deleteThread`, `deleteProofOfClass`, `disableEnrollmentCode`, `downloadAssistantFile`→`docs_api._download` + surface card, `emergencyReleaseDevice`, `endSession`, `enrollByCode`, `enrollStudent`, `enrollViaCode`, `exportAttendanceCsv`, `generateAtRiskReferral`, `generateCheckpointQrCode`→`activateCheckpoint`/`activateSession` (+ local Ed25519 signing), `getActiveSessionPermissions`, `getAdminOverview`, `getAiCapabilities/getAiThread/…Threads`, `getAtRiskReferrals`, `getAtRiskStudents`, `getAttendanceForStudent`, `getAttendanceRecords`, `getAttendanceReport`, `getAttendanceSummaries` (`attendance_api.dart:33-49`), `getAuditLogs`, `getCalendarEvents`, `getDashboardOverview`, `getDisputedRecords` *functionally* (Flutter derives the rail from attendance records — `faculty_disputes_screen.dart:87-96`), `getEnrollments`, `getMaintenanceStatus`, `getMyAttendance`, `getMyStanding`, `getMySystemReports`, `getNotifications`, `getPrivacyCenter/Notice`, `getProofsOfClass`, `getRecordTimeline`, `getReportScreenshotDataUrl`→`getReportScreenshot`, `getScanAttempts`, `getSection/Roles/Sections/SectionSessions/SectionStudents/ServerStatus/Session/Sessions/Settings/Student/…`, `getStudentAttendanceForSection`, `getStudentImportJob`, `getStudentRoles`, `getStudentSections`, `getStudentsForSection`, `getSystemReport(s|Stats)`, `getTeacher(s)`, `getUnreadNotificationCount`, `getMySubjects` (via `getStudentSections`+`getEnrollments`), `grant/revokeSessionPermission`, `importSectionEnrollments`, `importStudents`, `listAiThreads`→`listThreads`, `listExcuses`, `loginFaculty/loginStudent` (both send `deviceId` — `session_provider.dart:187-216`), `logout` (sends `deviceId` + `armDeviceCooldown: true` — better than RN android — `session_provider.dart:231-238`, `session_api.dart:60-66`), `markNotificationsRead`, `previewEnrollImport`, `resetEnrollmentCode`, `resetUserPassword`, `resolveDispute`, `revokeSessionPermission`, `search`, `sendAiChatMessage` (streaming via `openThreadStream`), `setSetting`, `setUserStatus`, `submitDispute`, `submitScan`, `syncOfflineQueue`→`drainNow`, `teacherResetStudentPassword`, `unregisterDevice`, `updateAtRiskReferral`, `updateAttendanceStatus`, `updateContacts`, `updateSystemReportStatus`, `updateUser`, `uploadProofOfClass`, `verifyLedger`. `getUsers` carries the same `role/q/department/status/limit/offset` query (`users_api.dart:33-40`, admin filters verified).

Real gaps / drift in the API & store layer:

| # | Item | RN | Flutter | Fix |
|---|---|---|---|---|
| M1 | Push token registration | full Expo flow + `registerPushToken` (`android/services/push-notifications.ts`, `POST` wired in `_layout.tsx:228+`) | `notifications_api.dart:38` exists, **zero call sites** (no FCM/expo equivalent) | Register on sign-in once a Flutter push plugin ships (backend contract already consumed); until then leave stub + documented deferral |
| M2 | Offline session activation / end | queue kinds `session_activation`, `session_end` — `android/services/offline-store.ts:7`; web M4 offline cockpit | **No queue** — cockpit writes are network-only (documented deferral). Teacher offline activation/end impossible | Port the two-row pattern onto a drift `cockpit_queue` table reusing `SyncEngine` conventions; out-of-scope for scan hardening wave |
| M3 | Manual/scan `session_activation` optimistic-row behavior | `api-client.ts` caches optimistic activation state | Flutter routes don't queue; same as M2 | — |
| M4 | `preSyncOfflineData` | RN/web: drain + subject/section/session/attendance cache + clock-offset refresh, called at boot + 30 s (`_layout.tsx:180-190`; web `frontend/src/lib/api-client.ts:2106-2131`) | No equivalent orchestrator; Flutter caches per-screen + trusted-clock 5-min refresh; no readiness state | Build `prepareOfflineData()` (drain + fetch subjects/enrolled sections/sessions/my-attendance + clock refresh, then `CachedMeta.lastPreparedAt`) — powers §4 offline-preparation control |
| M5 | Cache store table coverage | RN: subjects/sections/sessions(+section idx)/attendance(student idx)/queue/metadata + legacy-drop migration (`offline-store.ts:28-96`) | Flutter drift has a superset incl. `cachedSchedules`, `cachedRosters`, `notificationsInbox`, `systemReportQueue`, `excuseQueue`, `cachedMeta` (`app_database.dart:101-292`) | Node needed; Flutter is a superset. Note: RN schedule cache merges sessions; Flutter has dedicated schedule cache — keep |
| M6 | Queue encryption at rest | secretbox per `offline-crypto.ts` | none (plain drift) | Optional: encrypt payloads of `OfflineAttendanceQueue` (esp. if M-PIN persistence (§1.j) lands) |

`registerPushToken` is the only method truly absent-with-no-substitute; everything else is present or has a functional equivalent.

---

## 4. UX basics & functionality the owner called out

### 4.1 Back affordances
- Flutter `CampusHeader` is an `AppBar` with `automaticallyImplyLeading: true` default (`core/widgets/campus_header.dart:14,56-57`) — every pushed screen using it shows a system back arrow: profile/assistant/notifications/privacy/id-card/student session+section detail (all opened via `context.push` — `faculty_shell.dart:47-57`, `student_app_bar_actions.dart:15-25`, subject/section detail navigations push — `faculty_dashboard_screen.dart:219,221,308`).
- **The admin console explicitly suppresses back**: `AdminScaffold` hardcodes `automaticallyImplyLeading: false` — `features/admin/presentation/widgets/admin_common.dart:44,62` — and all section navigation uses `context.go` (`admin_common.dart:70`; `admin_dashboard_screen.dart:240,362`), so server-status/system-reports/settings/audit-logs/users/search never show a back button; notification deep links land there via `SurfaceNavigation.open` → `router.go` (`surface/data/surface_navigation.dart:44`).
- Stack-replacing nav also wipes the stack elsewhere (`context.go('/faculty/subjects')` from quick links — `faculty_dashboard_screen.dart:156-186,346-361`) though those are tab roots (no back expected).
- **Fix targets** (owner complaint #1 generalizes to admin console):
  1. `admin_common.dart:44,62` — change to `automaticallyImplyLeading: true` (or a `canBack` flag) so pushed/deep-linked admin screens get a back arrow.
  2. Where `AdminScaffold` section switching uses `context.go(next.route)` (`admin_common.dart:70`), use `context.push` when the target is a different branch so the source stays in the stack — or leave tabs-only replacing.
  3. `surface_navigation.dart:44` — accept an optional `push: true` for console targets (system-reports deep link) so back returns to the notification origin.
  4. Fallback guarantee: add `BackButton(onPressed: () => context.go(<role home>))` as explicit `leading` for root-level console pages so "sweep back" is never the only affordance.

### 4.2 Web offline-preparation UX (target to replicate) — `frontend`
Hosted on `/student/dashboard`: `OfflineReadinessChip` + `OfflineSyncPanel` — `frontend/src/app/student/dashboard/page.tsx:18-19,260-262`.

`OfflineReadinessChip` (`frontend/src/components/offline/OfflineReadinessChip.tsx`):
- States: `checking` (hidden `:68`), `ready` → `"Ready for offline class"` pill w/ ShieldCheck (`:70-80`), `needs-sync` → button `"Prepare for offline class"` / preparing `"Preparing offline data…"` (`:82-93`).
- Readiness predicate: cached sessions containing **today or tomorrow**, enrolled section ids > 0, clock offset present — `:31-47`.
- Action: `api.preSyncOfflineData()` → re-evaluate (`:56-66`). Scope of `preSyncOfflineData` (`frontend/src/lib/api-client.ts:2106-2131`): initialize owner store → `/health` clock-midpoint offset → drain queue → fetch subjects + (student: enrolled sections) + sessions + my-attendance → persist.
- 7-day offset TTL — `frontend/src/lib/offline/store.ts:103-105`.

`OfflineSyncPanel` (`frontend/src/components/OfflineSyncPanel.tsx`):
- Last-sync display `"Last sync HH:MM"` / `"Not synced yet"` (`:16-21,137`); pending count sentence `"All attendance evidence is synced."` / `"N saved item(s) waiting to sync."` + `"X need attention."` (`:151-155`); Sync button (disabled while syncing/offline/empty, spinner `:138-148`); issue rows (max 3) with kind label ("Check-in", "Manual attendance", "QR activation", "Session end" `:23-36`) + color-coded failure and per-row Retry (`:158-186`); low-storage warning (<50 MB) `role=alert` (`:103-115,188-192`); auto-drain triggers: state event, request event, online event, visibility, 30 s interval (`:75-101`).
- Flutter today: only `_PendingSyncChip` ("N saved on device · pending sync", "Sync now", drain-toast with `syncDrainMessage`) — `student_dashboard_screen.dart:98,243-314` (+ binder triggers `sync_lifecycle_binder.dart`).
- **Build checklist for Flutter (dashboard, student first):**
  1. `StudentOfflineReadinessChip` — evaluate: cachedSessions contains today/tomorrow (reuse `readCachedSessions` + `studentCache.date`), enrolled sections non-empty, `TrustedClock` offset persisted in `CachedMeta`. States/copy exactly as web. Action: `prepareOfflineData()` (§3-M4).
  2. Extend `_PendingSyncChip` into a small panel: show last sync (`CachedMeta.lastSyncAt` — new persisted record in `markQueueConfirmed`), failure rows from the queue table with per-row Retry (queued row `serverError`, same kindLabel mapping), and reuse `syncDrainMessage`.
  3. No low-storage equivalent required on Android (drift cache is bounded); skip unless the encrypted-store parity item (§3-M6) changes storage.

### 4.3 Student schedule — **month view missing in Flutter**
- RN android student schedule has Month + Week views with `StudentMonthCalendar`/`StudentWeekCalendar` and per-day drilldown — `android/app/(tabs)/schedule.tsx:18-19,33,76-162`; web student schedule is weekly-only but the faculty calendar is month+week (`frontend/src/app/faculty/schedule/page.tsx`, student calendar util in `shared/src/utils/calendar.ts`).
- Flutter `student_schedule_screen.dart` renders only a week carousel (only `getMonthName` for the week header — `:34,104`).
- Fix: add a Month tab to the Flutter student schedule screen using `getMonthDays` parity (`core/utils/calendar_utils.dart`) and reuse `StudentCalendarViews`-style day dots + detail modal; parity desired by owner.

### 4.4 Sign-out + copy diffs
- RN: `confirmSignOut()` destructive confirm, copy `"Sign out?" / "You will need to sign in again to use Polycheck."`, sign-out stamp to dodge gate races — `android/lib/sign-out.ts:15-77`; **10 affordances** route through it.
- Flutter: faculty More menu confirms with `"Sign out?" / "You will need your credentials to sign back in on this device."` (`faculty_shell.dart:64-72`); forced-rotation escape (`force_password_change_screen.dart`) and privacy gate have sign-out paths; **students have no sign-out affordance at all** (rg: `logout` referenced only from faculty shell + those two files) — the profile screen has none (`profile_screen.dart` — no `logout` match), student dashboard/history/ID none.
- Fix: add a confirmed "Sign out" control to the Flutter `/profile` screen (mirroring RN's post-unregister confirm) and to the student More/dashboard menu; reuse a shared `confirmSignOut` helper with the current + RN-amended copy; keep `armDeviceCooldown: true` semantics (`session_provider.dart:231`).

### 4.5 Offline queue chip copy drift (scanner result)
- RN: pending outcome title `SAVED ON DEVICE`, message `"Check-in saved offline and queued for sync. Confirmation may require instructor review. Open the dashboard to check sync status."` (`android/app/(tabs)/scan.tsx:55-87,340-355`).
- Flutter: title `SAVED ON DEVICE`, message `"Offline — Pending Sync. Check-in saved securely on this device and will sync when you reconnect."` (`student_scan_service.dart:328-333`, `:367-373`).
- Difference: RN's wording promises instructor-review semantics for offline evidence; Flutter's promises auto-sync. If terminal-evidence wording parity matters, adopt RN's sentence (it matches the reconciliation reality incl. receipts; Flutter's "will sync when you reconnect" is also true). Optional.

### 4.6 Manual-override audit chip — **PARITY**
- Flutter renders `manuallySet` on roster rows and student detail (`session_cockpit_screen.dart:997`, `student_detail_screen.dart:600`; optimistic stamps `:135,164,493,533`; CSV export badge `faculty_csv.dart:61`). RN/web equivalent exists. No gap.

### 4.7 Radar overlay / finale banner — **PARTIAL**
- Finale banner: Flutter cockpit consumes `session:finale` and renders `SESSION FINALE` counts — `features/faculty/data/cockpit_realtime.dart:63`, `session_cockpit_screen.dart:103-107,736-760`. **Parity present.**
- Anomaly stream: consumed as a toast + `_deniedCount` only — `cockpit_realtime.dart:53`, `session_cockpit_screen.dart:93-101`. RN android maintains a shaped radar overlay (record pins + red denied pins + live anomalies + attempts refetch) on the session map — `android/app/(faculty)/sessions/[id].tsx:40-43,159-161,277-287,692`; web has the full `GeofenceRadarModal` (`frontend/src/components/radar/GeofenceRadarModal.tsx`). Flutter has **no denied-attempt log/pins**; `getScanAttempts` is fetched only for the dispute timeline (`faculty_disputes_screen.dart:356`), never the cockpit radar.
- Fix: fetch `getScanAttempts(sessionId: …)` + `shapeRadarOverlay`-equivalent in the cockpit; render a collapsible "Denied attempts" list (already has `deniedCount`) and optional map pins — reuse `officer_geofence_map` primitives.

---

## TABLE A — Defense matrix

| # | Defense | Android/web (RN) evidence | Flutter status | Required change in `polycheck_mobile` |
|---|---|---|---|---|
| A-a | Accuracy gate | `android/services/api-client.ts:1334-1337` (50 m offline); `frontend/.../api-client.ts:1329-1332`; server 50/500 m `backend/.../types.ts:7-8` | **partial** — 100 m live only (`student_scan_service.dart:66-70`), no offline gate | Align live gate to 50 m; add queue-side ≤50 m assertion; match server copies |
| A-b | Staleness gate | `android/.../api-client.ts:1338-1349` (2 min); web `:1333-1344`; server `types.ts:6` | **missing** | Reject `trustedNow − capturedAt > 2 min` pre-submit |
| A-c | GPS acquisition | `android/.../scan.tsx:251-253`; web `ScanQrModal.tsx:195-221` | **present** (`:60-65`, best 20 s) | Keep; add timeout-flavor error copy |
| A-d | Mocked GPS | `android/.../api-client.ts:1312-1313`; server `scan-validator.service.ts:283-284` | **present** (`:222-226`, sends flag) | none |
| A-e | Geofence check + copy | `android/.../api-client.ts:1319-1333`; web richer copy `:1324-1327`; `shared/.../haversine.ts:28-37` (no accuracy intersection client-side) | **present** (`:228-243`) | none (copy optional) |
| A-f | Duplicate guards | op-gen + ref-gating (`scan.tsx:111-113,379-381`); web already-saved guard (`frontend/.../api-client.ts:1353-1368`) | **partial** (screen gate + clientAttemptId + `DISPUTED_DUPLICATE`) | Add cached-record already-saved short-circuit pre-POST |
| A-g | Trusted clock | `scan.tsx:230`; TTL'd offset `frontend/.../store.ts:103-105` | **present** (`:165-168,252-255`; 5-min refresh) | none |
| A-h | Local Ed25519 verify (offline) | `android/.../api-client.ts:1295-1299`; `:1433-1446`; web `:1291-1295` | **missing** (decode-only; `verifyToken` dead — `teacher_signing_key.dart:201`) | Call `verifyToken` offline before enqueue; reject `QR token signature is invalid` |
| A-i | Dispute labels | `android/.../disputes.tsx:19-37`; web badge subset `security-dispute-badge.tsx:12-37` | **present (superset)** (`faculty_logic.dart:41-83`) | align casing only (optional) |
| A-j | Offline queue semantics | `offline-store.ts:7-11,336-425,427-438,485-487`; 30 s drain `_layout.tsx:190`; receipt `api-client.ts:1938-1954`; PIN encrypted via `offline-crypto.ts:5-45` | **partial** — receipt 400 ms×30, backoff 5 s–5 min, terminal retention, lifecycle drains (`sync_engine.dart`, `sync_lifecycle_binder.dart`); **no periodic drain, no per-row retry, PIN memory-only** | (1) encrypted PIN persistence or drain-time re-prompt; (2) 30 s foreground timer; (3) per-row Retry |
| A-k | `locationCapturedAt` | DTO `attendance.dto.ts:28`; RN sends trusted-derived value (`scan.tsx:255-258`) | **present but device-clock value** (`:76,249,267`) | derive from trusted scannedAt − fix age |
| A-x | `deviceSecurity` root/hook/emulator | `android/services/device-security.ts:8-146`; sent `scan.tsx:232,285`; server disputes `scan-validator.service.ts:295-297` | **missing** (DTO exists, nothing populates — `api_models.dart:483-523`, `student_scan_service.dart:264-270`) | Port detector to Dart; wire `ScanEvidenceInput.deviceSecurity`; disputed when flagged (incl. optimistic row) |

## TABLE B — Function / UX matrix

| # | Source | Flutter status | Fix target |
|---|---|---|---|
| B-1 | Session-replacement monitor (`realtime.ts:152`, `_layout.tsx:150-166`) | **missing** | Root socket listener + in-flight skip + `me()` probe + terminate |
| B-2 | Cooldown gate UI | present, tick + Try-again (`device_gate_panels.dart:103-250`) | none |
| B-3 | Role gates | present (ladder `router_decision.dart:109-210`) | none |
| B-4 | Forced password change | present (screen + ladder `:158-164`) | none |
| B-5 | Provisioning guard | present, same copy, typed 4xx (`teacher_signing_key.dart:251-259`) | none |
| B-6 | Privacy consent | present (`privacy_consent_gate.dart:203`) | none |
| B-7 | Offline PIN persistence | memory-only (`attendance_pin_vault.dart:3-37`) | encrypted persistence or drain re-prompt (see A-j) |
| B-8 | `registerPushToken` flow | method only; no call site | wire once a push plugin ships (deferral documented) |
| B-9 | Offline session activation/end queue | network-only cockpit (deferral) | `cockpit_queue` drift table + reuse SyncEngine conventions |
| B-10 | `preSyncOfflineData` | none | `prepareOfflineData()` orchestrator (drain + caches + clock) |
| B-11 | Offline readiness chip | none | build chip (§4.2 states/copy/action) on student dashboard |
| B-12 | Sync panel (last sync, issues, per-row retry) | partial (`_PendingSyncChip` + Sync now only) | extend chip → panel with issues + per-row retry + lastSync |
| B-13 | Admin back affordances | **suppressed everywhere** (`admin_common.dart:44,62,70`) + `go()` nav | enable imply-leading for pushed admin routes + explicit BackButton fallback |
| B-14 | Student month schedule view | week-only (`student_schedule_screen.dart`) | add Month tab with day dots + drilldown (parity with `android/app/(tabs)/schedule.tsx`) |
| B-15 | Student sign-out affordance | **absent** (no `logout` in student/profile surfaces) | add confirmed sign-out on `/profile` + student More/dashboard; shared confirm helper |
| B-16 | Manual-override chip | present (`session_cockpit_screen.dart:997`) | none |
| B-17 | Radar overlay / finale | finale present; **denied-attempt radar/log missing** (toast only — `session_cockpit_screen.dart:93-101`) | attempts + denied-log list (optionally map pins) in cockpit |
| B-18 | API method surface | essentially complete (verified list in §3); `registerPushToken` stubbed; disputes rail derived; store cache superset | none besides B-8/B-10 |

## TABLE C — Priorities

**(1) Release blockers (defense parity, student anti-cheat):**
1. A-x — device security capture (root/hook/emulator) sent with every scan — currently invisible to the server for Flutter users.
2. A-h — offline local signature verification before queueing (plus A-a/A-b threshold alignment 50 m / 2 min: cheap and removes the "verified locally → disputed server-side" mismatch).
3. A-j/B-7 — PIN-handling decision for offline PIN-protected scans (encrypted persistence RN-parity **or** explicit re-prompt): current cold-start path silently converts a valid offline check-in to terminal `pin_required` evidence.
4. B-1 — `auth:session-replaced` monitor (revocation enforcement latency).

**(2) Parity gaps (function):**
5. A-f — cached already-saved guard (dup deflection).
6. A-k — trusted-clock-derived `locationCapturedAt`.
7. B-10/B-11 — offline preparation orchestrator + readiness chip (pre-scan confidence before class).
8. B-12 — sync panel: lastSync, issue rows, per-row retry.
9. A-j-2 — 30 s foreground drain timer.
10. B-9 — teacher offline activation/end queue (teacher parity; larger task, can follow).
11. B-8 — push registration wiring (needs plugin pick; documented deferral).

**(3) Polish (UX):**
12. B-13 — admin console back buttons.
13. B-15 — student/profile sign-out affordance + confirm helper (single confirm copy).
14. B-14 — student month schedule tab.
15. B-17 — cockpit denied-attempt list (radar-lite; map pins optional).
16. A-c timeout error copy; A-i label casing; B-4.x scan "SAVED ON DEVICE" wording alignment (B-4.5).

---

## Suggested 2-wave split (parallel, no file conflicts)

**Wave 1 — Defense hardening agent** (scanner + session trust):
- Owns: `features/student/data/student_scan_service.dart`, `core/utils/token_crypto.dart` (add verify call-through re-export; `features/faculty/data/teacher_signing_key.dart` only to export `verifyToken`), `core/sync/sync_engine.dart` (PIN handling + payload field), `core/sync/sync_lifecycle_binder.dart` (30 s timer) **only touching drain trigger code**, new `core/utils/device_security.dart` + its hook into `features/student/data/student_scan_service.dart` + `core/api/api_models.dart` (already has DTO), `core/providers/session_provider.dart` (logout flows unchanged) + new `core/network/session_replacement.dart` + `core/stream/` socket service files, `features/student/presentation/scan/student_scan_screen.dart` only for already-saved/accuracy copy.
- Tests: `test/**` under `core/sync`, `core/utils`, `features/student/data` (774 existing tests stay green; mirrors RN `api-client-bindings` copy checks).

**Wave 2 — UX parity agent** (shell/navigation + dashboard surfaces):
- Owns: `features/admin/presentation/widgets/admin_common.dart` (+ each admin screen's header flags), `features/surface/presentation/profile_screen.dart`, `student_history_screen.dart`, `student_shell.dart` `faculty_shell.dart` confirm helper (new `core/widgets/confirm_sign_out.dart`), `features/student/presentation/schedule/student_schedule_screen.dart`, new `features/student/presentation/dashboard/` widgets (`offline_readiness_chip.dart`, offline panel), `features/student/data/student_dashboard_data.dart` (readiness eval) + `core/database/app_database.dart` additions confined to a **new** `prepareOfflineData` provider file (no schema change needed for readiness; lastSync via `CachedMeta` row), `features/faculty/presentation/session_cockpit_screen.dart` (denied-attempts list section only; realtime hook untouched).
- File-conflict boundary: Wave 1 never touches `presentation/widgets/` or the dashboard; Wave 2 never edits `student_scan_service.dart`, `sync_engine.dart`, `session_provider.dart`, or socket files. Shared-only seam: a one-file contract `core/sync/readiness.dart` (pure predicate) can be authored in Wave 1 and *consumed* in Wave 2.

## 5. Resolution status (post-harden waves W1/W2 — 2026-11-10)

| Report item | Status | Implementation |
|---|---|---|
| A-a accuracy gate (50 m) | **FIXED** | `student_scan_service.dart` live gate 50 m + queue-side assertion + server copy |
| A-b staleness gate (2 min ±30 s) | **FIXED** | `isLocationFixStale` + pre-submit rejection (RN copy) |
| A-f cached already-saved guard | **FIXED** | `features/student/data/scan_cache.dart` short-circuit (web semantics: in-person any / online per-leg) |
| A-h local Ed25519 verify | **FIXED** | `verifyToken` in `token_crypto.dart`; offline branch rejects "QR token signature is invalid" |
| A-j PIN persistence | **FIXED (RN-parity)** | drift schema v2 `pinEncrypted` (AES-256-GCM, key `polycheck.offline-encryption-key.v1`), cold-start drain decrypts, cleared on terminal |
| A-j-2 30 s foreground drain | **FIXED** | `SyncForegroundDrainTimer` (lifecycle-aware) |
| A-j-3 per-row retry | **FIXED** | `SyncController.retryOne(receiptId)` + dashboard panel rows |
| A-k trusted `locationCapturedAt` | **FIXED** | trusted scan moment − device-fix age |
| A-x deviceSecurity (root/hook/emulator) | **FIXED** | `core/utils/device_security.dart` port; sent on live scans + replayed batches; flagged copy + review note |
| B-1 `auth:session-replaced` monitor | **FIXED** | `core/network/session_replacement.dart` (socket + in-flight skip + `/auth/me` probe + termination, RN copy) |
| B-10/B-11 offline prep + readiness chip | **FIXED** | `features/student/data/offline_readiness.dart` + `offline_readiness_chip.dart` (web parity states/copy) |
| B-12 sync panel (lastSync/issues/retry) | **FIXED** | `offline_sync_panel.dart`; `lastSyncAt` now written on confirmed drains (`sync_engine._finish`) |
| B-13 admin back buttons | **FIXED** | `admin_common.dart` leading honored + fallback BackButton → console landing |
| B-14 student month schedule | **FIXED** | Month/Week toggle + day dots + drilldown sheet |
| B-15 student/profile sign-out | **FIXED** | `core/widgets/confirm_sign_out.dart` + profile + dashboard + faculty copy alignment |
| B-17 cockpit denied-attempt log | **FIXED** | collapsible denied list (scan attempts + `attendance:anomaly` refresh); map pins deferred |
| B-9 offline session activation/end queue | **DEFERRED** | cockpit writes stay network-only (same as RN) |
| B-8 push token registration | **DEFERRED** | no FCM plugin yet (documented) |
| A-c timeout copy / label casing / §4.5 wording | **FIXED/ALIGNED** | scan timeout copy; dashboard + scan-sheet adopt RN instructor-review wording |

Verification at close: `flutter analyze` 0 issues · **570/570 tests** · debug APK builds · `git status -- android` clean.
