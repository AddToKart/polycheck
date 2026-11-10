# Polycheck "Defense-Winning Wow Factor" Suite — Implementation Blueprint

**Status:** IMPLEMENTED (W1–W10 executed in backend/shared waves B1–B3 + four parallel UI waves + an E2E wave; all suites green; Docker stack rebuilt and the 8 E2E journeys pass live — see the implementation notes at the end)
**Scope:** `@polycheck/shared`, `backend` (NestJS + Prisma + Redis + Socket.IO), `frontend` (Next.js), `android` (Expo RN).
**Evaluation axes served:** (1) Academic/SUC governance — F4, F5 · (2) Cybersecurity/forensics/RA 10173 — F3, F6, F8, F9 · (3) Live showstoppers — F1, F2, F7.
**Compatibility bar:** zero regressions across the current suites — shared **122**, backend **845 / 75**, web **304 / 48**, Android **335 / 27**, Chromium E2E **122 passed / 3 skipped** — plus the offline sync engine (`/sync/attendance/batches` + receipt polling, SQLite `sync_queue_v2`, web IndexedDB `queue_v2`) which must remain untouched at its contract level.

---

## 0. Grounding — what this suite builds on (verified in code)

| Existing system | File(s) | What the suite reuses |
|---|---|---|
| Socket.IO gateway, session rooms, `attendance:updated` | `backend/src/realtime/attendance.gateway.ts` | Kiosk ticker, radar live pins, reconcile toasts. Rooms `session:<id>`, `auth:user:<id>`; handshake authenticates every socket. |
| Session cockpit (QR, countdown, roster, per-leg badges) | `frontend/src/app/faculty/sessions/[id]/page.tsx`, `android/app/(faculty)/sessions/[id].tsx` | Kiosk mounts as a sibling route fed by the same state; radar mounts as a cockpit modal. |
| MapLibre wrapper + geofence circle + campus polygons | `frontend/src/components/ui/map.tsx`, `CampusMap.tsx`, `GeofenceCircle.tsx`, `shared/src/map` (`pupSantaMaria`) | Radar modal renders building polygons + geofence circle + pins. |
| Scan attempts with full telemetry | `backend/prisma/schema.prisma` (`ScanAttempt`: `timestamp`, `clientScannedAt`, `receivedAt`, `lat/lng`, `accuracyMeters`, `mocked`, `inputChannel`, `checkpoint`, `pinVerified`, `deviceId`, `offline`, `distanceMeters`, `geofenceRadiusMeters`, `riskSignals`, outcome, `acceptedAttendanceRecord`), `backend/src/attendance/attendance.service.ts::findAttempts` (already joins student name/number; **no ApiClient binding exists yet**) | Radar anomaly pins, blackbox timeline, forensic distances. |
| PDF/DOCX generation with PUP branding | `backend/src/docs/docs.service.ts` + `docs.controller.ts` (pdfkit, `PUP_MAROON`, signature blocks, `GeneratedDocument { filename, contentType, body }`, streaming attachment) | Class record PDF (F4), CHED notice (F5), DPO summary (F6) — server-authoritative, zero new client PDF deps. |
| At-risk engine | `backend/src/attendance/attendance-at-risk.service.ts` (`attendanceRate`, `absencesBeforeBelowThreshold`, `below_threshold`), `/faculty/at-risk` (web + android) | CHED notice trigger + referral routing. |
| Offline sync engine (untouchable contract) | `backend/src/sync/sync.service.ts` (BullMQ, `queued: true, receiptId: jobId`, `GET /sync/attendance/batches/:receiptId`), `android/services/offline-store.ts` (`sync_queue_v2`), `frontend/src/lib/offline/*` (`queue_v2`) | Outage simulator drives these existing paths; hash chain attaches at server commit. |
| Signed QR tokens (tweetnacl) | `shared/src/utils/token.ts` (`signQRToken`, `verifyQRToken`, `decodeTokenPayload`, `issuedAt`) | Blackbox "signature generated" event, kiosk authenticity talking point. |
| Settings subsystem + tabs | `backend/src/settings/*`, `frontend/.../settings/settings-config.ts`, `android/lib/institution-settings.ts` (tabs: institution/sessions/accounts/ai/system) | New `privacy` tab (F6) + `geolocation_retention_days` key. |
| Cron pruning pattern | `backend/src/common/services/maintenance.service.ts` (Redis-locked jobs) | Telemetry shredding job (F6). |
| Audit ledger | `AuditLog` model, `AuditInterceptor`, `audit-logs` page/screen | Hash-chain verify button + `ledger.*` audit actions. |
| Digital ID cards | `frontend/src/components/student/StudentDigitalId.tsx`, `frontend/src/app/faculty/students/[id]/page.tsx` (flip card), `android/app/(tabs)/id-card.tsx`, `android/components/IdCardModal.tsx`, `android/app/profile.tsx` | Hologram overlay (F3) on all four surfaces. |
| Realtime server metrics pattern (subscribe/idle) | `backend/src/realtime/server-status.service.ts` | Reuse the subscribe/idle discipline for kiosk room presence. |

---

## 1. Locked Decisions

| # | Decision |
|---|---|
| WF-LD1 | **All API contracts originate in `@polycheck/shared`** — new types, zod schemas, Socket.IO event-name constants, and `ApiClient` methods (`getScanAttempts`, `getRecordTimeline`, `verifyLedger`, `getAtRiskNotice`, `getClassRecordUrl`, `generateAtRiskReferral`) land in shared first. Realtime payload extensions are strictly additive (`studentName?`, `checkpoint?` on `attendance:updated`; new events `session:finale`, `attendance:anomaly`) so every existing listener keeps working unchanged. |
| WF-LD2 | **No new client PDF dependency.** `jspdf`/`@react-pdf/renderer` are rejected: the server-side pdfkit pipeline in `backend/src/docs` is already the PUP-branded single source of truth (master list, session attendance). F4/F5/F6 documents are generated server-side and downloaded (web: `Content-Disposition` attachment; mobile: authenticated `GET` → bytes → `expo-sharing` via the existing `file-sharing.ts`/screenshot-fetch pattern). Client-side generation is limited to "print this view" conveniences, never the official copy. |
| WF-LD3 | **Kiosk is a nested cockpit route** (`/faculty/sessions/[id]/kiosk`), not a new data surface: it consumes the same `getSession` + session-room socket events, adds a kiosk-specific `kiosk:join` presence handshake (server tracks kiosk viewers to idle the finale state like `server:subscribe`), and a `session:finale` broadcast emitted by `end()`/the auto-end cron. **Parity justification (Feature Parity Gate):** web-only by nature (overhead projector/Smart TV); the mobile faculty session detail already provides the live roster on a phone — recorded as the PR justification instead of shipping a second kiosk. |
| WF-LD4 | **Radar reuses MapLibre, adds no new map dependency.** The cockpit modal renders `pupSantaMaria` building polygons (existing `CampusBuildingsLayer`), the geofence circle (`GeofenceCircle`), pulsing green markers for accepted check-ins (CSS-animated `MarkerContent`), and blinking red markers for denied/out-of-bounds `ScanAttempt`s with copy built from the stored `distanceMeters`/`geofenceRadiusMeters` (fallback: shared `haversineDistance`). Data = `GET /attendance/attempts?sessionId=` joined with the roster; live updates ride `attendance:updated` + the new `attendance:anomaly` event emitted when the scan validator denies an attempt. **Mobile parity:** the existing Leaflet-WebView session map on Android gains the same denied-attempt overlay (same data, native map). |
| WF-LD5 | **Hologram is CSS-first with graceful sensor enhancement.** A diagonal golden/maroon gradient sweep (pure CSS keyframes, `prefers-reduced-motion` → static sheen) + a live UTC watermark ticked every second from `Date.now() + serverClockOffset` (the trusted-clock rule) + a masked device chip (`DEVICE-BOUND •·•·<last4>` from `boundDeviceId`). Mobile adds optional `expo-sensors` Accelerometer parallax guarded by availability + E2E mode; it degrades to the sweep only. The watermark sits as a diagonal repeating overlay so screenshots carry a verifiable timestamp while the card stays readable. |
| WF-LD6 | **Class Record = new docs builder, not a new module.** `GET /docs/class-record/:sectionId?format=pdf|docx` (owning teacher; academic-oversight heads department-pinned; super admins scoped) renders: Republic of the Philippines header + PUP seal + campus/college lines, alphabetical roster (student number, name, program, section, course code), an **18-week grid** whose columns are calendar weeks (Mon–Sun) derived from the section's semester start, symbols `P / L / A / E (excused) / I (incomplete) / – (no session)`, per-row totals + rate, and the formal sign-off block (Instructor / Department Chairperson endorsement / Dean's office stamp box). Weekly aggregation uses the existing report service scoping (`AttendanceScopeService`) — one implementation point. |
| WF-LD7 | **CHED "Notice of Impending Drop" = referral workflow + document.** New `AtRiskReferral` model (migration) created by `POST /attendance/at-risk/referrals` (teacher for own sections; department head for their department) with a server-rendered notice PDF (`GET /docs/at-risk-notice/:referralId`) citing CHED CMO No. 40 / Article V / the PUP Student Handbook as the directive specifies. Referrals surface in a **Guidance/Chair queue** on `/faculty/at-risk` (visible to academic-oversight designees + super admins) with statuses `generated → acknowledged → counseling_scheduled → resolved`, notifications to the section teacher + generating actor, and `attendance.referral_created` audits. The slip is only generatable when the student's deterministic standing says `below_threshold`/`at_risk` (no teacher discretion gaming the threshold). |
| WF-LD8 | **RA 10173 Center is honest, not aspirational.** Today in-person check-ins persist coordinates; the center therefore ships *ephemeral by policy*: new setting `geolocation_retention_days` (integer, default 30, clamp 7–90, editable by institution super admins in the System tab) enforced by a new Redis-locked shredding job in the existing `MaintenanceService` that nulls `AttendanceRecord.latitude/longitude` + `ScanAttempt` coordinates past retention (dispute-relevant metadata like distance/outcome is kept; nothing attendance-decisional is destroyed). The tab (web + Android settings mirror) shows: retention config + live "coordinates older than N days: 0" attestation computed at request time, the shredding cron's last-run, the **consent ledger** (`User.privacyConsentVersion/At` coverage % + per-consent audit rows), the data inventory (what is stored where and why), and **DPO Summary PDF** (`GET /docs/dpo-summary`) — super admin + IT coordinators only. Tab visibility follows the System-tab suite gate. |
| WF-LD9 | **Outage simulator is a client-side killswitch, engine untouched.** A dev/demo-only toggle (web: `NEXT_PUBLIC_ENABLE_OUTAGE_SIMULATOR === 'true'` in the lib; mobile: `EXPO_PUBLIC_ENABLE_OUTAGE_SIMULATOR`; default off, enabled in local compose/E2E builds only) arms an interceptor in both API clients: every request rejects with a simulated `NetworkError`, so **writes naturally flow into the existing encrypted queues** (web IndexedDB `queue_v2`, mobile SQLite `sync_queue_v2`) with zero engine changes. The demo surface shows `OFFLINE MODE (LOCAL ENCRYPTED QUEUE)` + a local receipt sequence (`Receipt #<n>` = queue position + id prefix), and Resume disarms, drains (`drainOfflineQueue`), refreshes the trusted clock offset (`/health` → `setServerClockOffset`), and the teacher's cockpit reconciles through the existing `attendance:updated` broadcast (a reconcile toast is rendered from that event — no new server code). |
| WF-LD10 | **Blackbox timeline is derived, never stored.** `GET /attendance/records/:id/timeline` (owner teacher / department head in dept / super admin) assembles an ordered event list from existing truth: session activation (`qrGeneratedAt`/checkpoint tokens), `ScanAttempt` rows (`clientScannedAt`, `distanceMeters`/radius, `mocked`, `pinVerified`, `offline`, `inputChannel`, masked `deviceId`), the token's signed `issuedAt` (decoded from `tokenSnapshot`), record `createdAt` (server arrival = batch sync time for offline rows), `syncedAt`, dispute raise/review stamps. The **recommendation chip is deterministic** — signature valid ∧ inside geofence ∧ inside window ∧ not duplicate ⇒ `ACCEPT — cryptographic proof confirms presence at HH:MM:SS`; mocked/outside/duplicate ⇒ `REVIEW`/`REJECT` with the specific reason. No new tables; rendered in the web dispute review drawer + Android dispute sheet. |
| WF-LD11 | **Hash chain is per-session, salted, and externally anchored.** Additive `AttendanceRecord` columns `prevHash`, `recordHash` (+ migration + backfill). `recordHash = SHA-256(prevHash ‖ studentId ‖ timestamp.toISOString() ‖ sessionId ‖ salt)` with a per-record random 32-hex `salt` column; chains are ordered by `(timestamp, id)` per session and stamped inside the same transaction that commits the record (offline batches chain in server-arrival order — arrival order is itself forensic truth). **Tamper-evidence against a DBA:** a daily anchor job writes the day's last `recordHash` into an `InstitutionSetting` row *and* an `ledger.anchored` audit row, so rewriting history breaks the published anchor. `POST /audit-logs/ledger/verify` (super admin) rescans chains (+ anchors) and returns `{ verified, recordsChecked, sessionsChecked, brokenAt? }`, writing a `ledger.verified` audit row with the outcome; the button lives on web + Android audit-logs surfaces. Verification is idempotent and read-only. |
| WF-LD12 | **Zero-regression discipline:** every phase ends with the standing gates green (`pnpm lint`, per-package typecheck/test, `pnpm build`); the offline sync contract (`/sync/attendance/batches` + receipts + terminal/retryable classification) is not modified by this suite; the only schema changes are the two additive migrations in F5/F9; new env flags default to off in production (simulator, kiosk presence is flag-free). |

---

## 2. Feature Blueprints

> Per feature: **A.** Architecture & data flow · **B.** File paths · **C.** UI/UX breakdown · **D.** 20-second panel pitch · **E.** Phasing.

---

### F1 — Classroom Projector "Kiosk Mode"

**Route:** `/faculty/sessions/[id]/kiosk` (nested under the cockpit page folder).

**A. Architecture & data flow**
- Page fetches `getSession(id)` + roster (same as cockpit), joins the `/attendance` namespace session room, and listens: `attendance:updated` (additive `studentName`, `checkpoint`), `session:state` (`ended`), `attendance:anomaly` (F2, for an optional marquee strip).
- New shared event constants: `KIOSK_JOIN_EVENT = 'kiosk:join'`, `SESSION_FINALE_EVENT = 'session:finale'`. Gateway: `kiosk:join` (session-scoped access check reusing `assertSessionAccess`) tracks presence to idle finale state; `session:finale` is emitted by `SessionsService.end()` and the `autoEndAt` cron with `{ sessionId, endedAt, summary }` (summary = per-status counts computed from the resolution matrix).
- Server enriches `attendance:updated` with `studentName` (additive; existing consumers ignore it).
- QR payload re-rendered from the cockpit's existing token; validity countdown uses `validitySeconds`/`qrValidityMinutes` + `qrGeneratedAt` (trusted clock offset applied).

**B. Files**
- `shared/src/types/session.ts` — `SessionFinaleSummary`, event constants.
- `shared/src/types/api.ts` — `attendance:updated` payload type gains `studentName?`.
- `backend/src/realtime/attendance.gateway.ts` — kiosk presence, `session:finale` emit helper.
- `backend/src/sessions/sessions.service.ts` + auto-end cron — emit `session:finale` on `end()`/cron (payload from the resolver's outcome counts).
- `frontend/src/app/faculty/sessions/[id]/kiosk/page.tsx` (new) + `frontend/src/components/kiosk/{KioskQrRing,KioskTicker,KioskCapacityRing,KioskFinale}.tsx` (new).
- `frontend/src/app/faculty/sessions/[id]/page.tsx` — "Projector view" button.
- Tests: `backend/src/realtime/attendance.gateway.spec.ts` (kiosk join/finale), `frontend/src/components/kiosk/*.test.tsx`.

**C. UI/UX breakdown**
- Layout: full-viewport maroon (`bg-maroon`) stage; top strip = Lora `subject · section · room`; center = 40vmin QR in a white card with a 6px golden ring; the SVG countdown ring (golden → maroon under 20%) wraps the QR and animates `stroke-dashoffset` from the validity window; below = capacity ring (`38 / 42 · 90%`) in DM Sans bold with golden progress.
- Ticker: bottom-third horizontal marquee of recent chips `✓ Maria Santos · 08:01:14` (max 5 visible, spring-in from right, auto-expire 12s); late check-ins get `LATE` chip styling; anomalies render maroon/red chips (from `attendance:anomaly`).
- Finale: on `session:finale` — QR freezes to a lock glyph, CSS confetti (gold/maroon rectangles, `prefers-reduced-motion` → static breakdown), and a centered breakdown card (P/L/A/E/I counts + rate) with the PUP seal.
- Contrast: cinema-grade (white/golden on maroon ≥ 4.5:1); no hover-dependent UI; Esc/back returns to cockpit; `f` toggles fullscreen (Fullscreen API).
- Accessibility: `aria-live="polite"` ticker summary; rings carry `role="img"` labels.

**D. Panel pitch (20s)**
"This projector view is the classroom's live heartbeat: the QR re-keys itself on a cryptographic countdown, every scan lands as a signed event over WebSockets within a second, and the capacity ring reconciles against the official roster in real time. When class ends, the system freezes, celebrates, and prints the final attendance — the same data the registrar will see. Nothing here is a mock; it is the production pipeline with a cinema-grade face."

**E. Phasing**
- F1.0 shared event/payload types → F1.1 gateway presence + `session:finale` emission (+ specs) → F1.2 kiosk page + components (+ component tests) → F1.3 cockpit entry button + E2E journey (`e2e/kiosk.spec.ts`: activate → simulated scans → finale) → F1.4 gates + Docker smoke.

---

### F2 — Live Geofence Satellite Radar

**Surface:** cockpit modal (`Radar` button) on web; existing Android session map gains the anomaly overlay.

**A. Architecture & data flow**
- Data: `GET /attendance/attempts?sessionId=` (already joins student name/number) + roster records with coordinates; client computes missing distances via shared `haversineDistance` (stored `distanceMeters` preferred).
- Live: `attendance:updated` moves/creates green pins; **new** `attendance:anomaly` event emitted by `ScanValidatorService` when a scan is denied (payload: `{ sessionId, studentId, studentName, studentNumber?, latitude, longitude, distanceMeters, geofenceRadiusMeters, reason, timestamp }`) powers blinking red pins without polling.
- Rendering: MapLibre map with campus polygons + `GeofenceCircle`; green markers pulse (CSS `animate-ping` under `MarkerContent`); red markers blink (alternating opacity keyframes) with a popup `Student 2021-00042: 124m away · 74m outside geofence`.
- Authorization: existing attempts scoping (teacher owns session; heads/super admins via `sessionScope`) — no new policy.

**B. Files**
- `shared/src/types/attendance.ts` — `ScanAttemptView` (id, student info, coordinates nullable, distance/radius, outcome, reason, `clientScannedAt`, `receivedAt`, `checkpoint`, `mocked`), `AttendanceAnomalyEvent`.
- `shared/src/types/api.ts` — `getScanAttempts(sessionId?: string): Promise<ScanAttemptView[]>` + client impls (web `frontend/src/lib/api-client.ts`, android `android/services/api-client.ts` — **binding currently missing**).
- `shared/src/types/session.ts` — `ATTENDANCE_ANOMALY_EVENT` constant.
- `backend/src/attendance/scan-validator.service.ts` — publish anomaly via the gateway (inject `AttendanceGateway` or an event `attendance.scan-denied` → gateway listener; keep validation pure).
- `backend/src/attendance/attendance.service.ts` — `findAttempts` presentation → `ScanAttemptView` (add student number + outcome if missing).
- `frontend/src/components/radar/{GeofenceRadarModal,RadarPins}.tsx` (new); `frontend/src/app/faculty/sessions/[id]/page.tsx` — Radar button + modal + live listeners.
- `android/app/(faculty)/sessions/[id].tsx` — denied-attempt overlay on the existing Leaflet map (+ `lib/colors.ts` parity).
- Tests: validator-emits-anomaly spec, gateway broadcast spec, `GeofenceRadarModal.test.tsx` (pin classes by outcome/distance copy), android jest for the overlay data shaping.

**C. UI/UX breakdown**
- Modal ≤92vw/≤92vh, deep-maroon chrome, Lora title "Live geofence radar", DM Sans legend (green = verified inside, red = denied, gray = no GPS), distance chips in DM Sans mono for numbers.
- The geofence circle uses the existing golden/maroon stroke tokens; campus polygons keep their existing fills; the radar "sweep" is a subtle rotating conic-gradient overlay (`prefers-reduced-motion` → off) — decoration is confined to the modal, never the map data.
- Pin popups: student number + name, distance copy exactly `124m away · 74m outside geofence`, timestamp, channel icon (camera/manual/screenshot).
- Live counters in the modal header: `Inside: 30 · Denied: 2`.

**D. Panel pitch (20s)**
"Cheaters think in screenshots; we think in geometry. This radar plots every verified check-in as a pulsing pin inside the classroom's geofence and every rejected attempt as a blinking marker with the exact Haversine math — 124 meters away, 74 meters outside — computed and re-validated server-side. Anti-cheat isn't a claim in our documentation; it is a live, observable system."

**E. Phasing**
- F2.0 shared types + ApiClient bindings (both clients) → F2.1 anomaly event emission (+ specs) → F2.2 web radar modal + live pins (+ tests) → F2.3 Android map overlay (+ jest) → F2.4 E2E journey (denied attempt appears as red pin) → gates.

---

### F3 — Anti-Screenshot Hologram on the Digital ID

**Surfaces:** `StudentDigitalId.tsx` (student dashboard), faculty student-detail flip card, Android `(tabs)/id-card.tsx` + `IdCardModal.tsx` + profile ID.

**A. Architecture & data flow**
- Pure client feature. A `HologramOverlay` component renders (1) a diagonal gradient sweep animated via CSS keyframes (gold → transparent → maroon tint), (2) a live UTC watermark line, (3) a device-bound chip.
- Watermark clock: `Date.now() + getServerClockOffset()` (web offline store; android `getServerClockOffset`) — "LIVE UTC" is *trusted*, which is itself a defense point. Ticks 1 Hz; `tabular-nums` so digits don't jiggle.
- Device chip: last 4 of `boundDeviceId` (web may show `WEB-SESSION`); never the full id.
- Mobile parallax: `expo-sensors` Accelerometer (optional dependency — guarded install + `expo-go` availability check) tilts the sheen ±6°; disabled in E2E mode + reduced motion.

**B. Files**
- `shared/src/utils/id-hologram.ts` (new, pure) — `formatLiveUtcStamp(nowMs, offsetMs)`, `maskDeviceChip(deviceId)`, `hologramSweepStyle()` constants; + `id-hologram.test.ts` (shared suite).
- `frontend/src/components/student/HologramOverlay.tsx` (new) + usage in `StudentDigitalId.tsx`, `frontend/src/app/faculty/students/[id]/page.tsx`.
- `android/components/HologramOverlay.tsx` (new, NativeWind + `Animated` from RN; `useAccelerometer()` hook) + usage in `IdCardModal.tsx`, `(tabs)/id-card.tsx`, `app/profile.tsx`.
- Tests: shared util tests; web component test (watermark renders, chip masked, reduced-motion class); android jest for `formatLiveUtcStamp` parity (mock parity file updated).

**C. UI/UX breakdown**
- Overlay is a `pointer-events-none absolute inset-0` layer: 22° sweep band ~34% width, `mix-blend-screen` on light faces / `soft-light` in dark; opacity ≤ 0.35 so the photo/QR stays dominant.
- Watermark: 10px DM Sans bold, uppercase tracking-widest, repeated diagonally every 140px, `PUP-ID-VERIFIED • LIVE UTC: 2026-11-02 08:01:14 • DEVICE-BOUND •·•·4F2A`, color `golden/70` on maroon faces, `maroon/50` on white.
- The holo layer renders above the QR but below buttons; screenshots of the card visibly embed the timestamp (proxy replay neutralization), and the device chip ties the card to the bound installation.

**D. Panel pitch (20s)**
"A borrowed screenshot dies on inspection: every digital ID carries a live, server-clock-correct UTC watermark and a device-binding chip that re-renders every second. A static image can't tick, and its device chip won't match the guard's scanner. This is a forensic deterrent implemented in fifty lines of CSS — the kind of adversarial thinking that separates a demo from a system."

**E. Phasing**
- F3.0 shared util + tests → F3.1 web overlay + integration (+ tests) → F3.2 Android overlay (+ optional accelerometer, jest) → F3.3 screenshot-evidence captures (visual-capture additions) → gates.

---

### F4 — 1-Click Official PUP Class Record / DTR Export

**A. Architecture & data flow**
- New docs builder `classRecord(section, weeks)` extending `docs.service.ts`: input = section + roster + per-student weekly aggregation from the report service (18 columns = ISO weeks across the semester; cells = dominant symbol P/L/A/E/I/–, computed from `AttendanceRecord` grouped by `(studentId, week)`), row totals + rate, sign-off block.
- Endpoint `GET /docs/class-record/:sectionId?format=pdf|docx` — roles: owning teacher, academic-oversight head (department-pinned via `AttendanceScopeService`), super admin (scoped). Streams `GeneratedDocument` like existing docs.
- Clients: web buttons on section detail + reports ("Download Class Record (PUP)"); Android share sheet on section detail via authenticated bytes → `expo-sharing` (existing pattern).

**B. Files**
- `shared/src/types/api.ts` — `getClassRecordUrl(sectionId, format)` helper or `downloadClassRecord` returning metadata; add to `ApiClient` + both clients.
- `shared/src/validation` — format/weeks query schema (reuse docs patterns).
- `backend/src/docs/docs.service.ts` (+ spec) — `CLASS_RECORD_*` column constants, weekly aggregation query (Prisma `groupBy` on `date` weeks), pdf/docx renderers, filename `PUP-ClassRecord-<code>-<section>-<sem>.pdf`.
- `backend/src/docs/docs.controller.ts` — route + roles + department pinning.
- `frontend/src/app/faculty/sections/[id]/page.tsx` + `frontend/src/app/faculty/reports/page.tsx` — export buttons (loading/disabled states, notification toasts).
- `android/app/(faculty)/sections/[id].tsx` — share action via `services/file-sharing.ts`.
- Tests: docs.service spec (18-column math, symbol mapping incl. `excused`/`incomplete`, sign-off block present, scope denials), controller role specs.

**C. UI/UX breakdown**
- Document: A4 landscape; header block = "Republic of the Philippines" (Lora small caps), PUP seal (existing asset), "Polytechnic University of the Philippines — Santa Maria Campus", College/Department line, Course code + section + semester + instructor; body = 8pt DM Sans grid, zebra rows, golden header rule `#FFDF00` on maroon `#7B1113`; footer = three signature blocks (Instructor / Program Chair endorsement / Dean's stamp box with "Received by / Date").
- Web UX: one button, one toast, one file. No wizard. The PDF is server-identical for every teacher — template fidelity is the feature.

**D. Panel pitch (20s)**
"Registrars reject systems that export CSVs and call it a class record. Ours renders the official PUP grading sheet — seal, 18-week grid, excused/incomplete symbols, and the three signature blocks — pixel-faithful, generated from the same scoped queries that drive the dashboards. One click, zero retyping, audit-backed: adoption-ready on day one."

**E. Phasing**
- F4.0 shared contract → F4.1 backend builder + endpoint (+ specs incl. scope matrix) → F4.2 web buttons + download UX → F4.3 Android share → F4.4 E2E (download fires; file name assertion via `page.waitForEvent('download')`) → gates.

---

### F5 — CHED CMO No. 40 "Notice of Impending Drop" Slip

**A. Architecture & data flow**
- Trigger surface: `/faculty/at-risk` rows where `status ∈ {below_threshold, at_risk}` (the deterministic engine already computes `absencesBeforeBelowThreshold`).
- New model `AtRiskReferral` (migration `2026_______wow_at_risk_referrals`): `id, studentId, sectionId, generatedById, status ('generated'|'acknowledged'|'counseling_scheduled'|'resolved'), note?, createdAt, updatedAt` + indexes `(sectionId)`, `(status)`; relations to `User` (student, generator) and `Section`.
- Endpoints: `POST /attendance/at-risk/referrals` `{ studentId, sectionId, note? }` (teacher owns section / head in dept), `GET /attendance/at-risk/referrals?status=&sectionId=` (generator + heads + super admin), `PATCH /attendance/at-risk/referrals/:id` (status transition; head/super admin), `GET /docs/at-risk-notice/:referralId?format=pdf|docx` (parties above).
- Notice document cites **CHED CMO No. 40, Article V, Section 21** and the **PUP Student Handbook** per the directive; body includes the absence ledger (dates + statuses of the counting absences), the 20% rule computation, and action checkboxes (Guidance counseling / Chair consultation / Parental contact).
- Routing: creating a referral notifies the department head(s) of the section teacher's department (`notifications:new` + bell) and surfaces in the new "Referrals" tab on `/faculty/at-risk` (heads see all in dept; teachers see their own).

**B. Files**
- `shared/src/types/at-risk.ts` — `AtRiskReferral`, `ReferralStatus`, labels; `shared/src/types/api.ts` — `generateAtRiskReferral`, `getAtRiskReferrals`, `updateAtRiskReferral`; zod in `shared/src/validation`.
- `backend/prisma/schema.prisma` + migration + seed untouched elsewhere.
- `backend/src/attendance/attendance-at-risk.service.ts` (+ spec) — referral CRUD + scope + notifications + audit `attendance.referral_created/updated`.
- `backend/src/docs/{docs.service,docs.controller}.ts` (+ spec) — notice builder (reuses PUP header kit; cites CHED Article V §21 + Handbook).
- `frontend/src/app/faculty/at-risk/page.tsx` — "Issue CHED notice" action on eligible rows; new Referrals tab with status pills + transition buttons.
- `android/app/(faculty)/at-risk.tsx` — same action + referral sheet; `services/file-sharing.ts` for the PDF.
- Tests: service specs (threshold gating, scope, transitions, notifications), docs builder spec (citation lines present, absence ledger rows), web/android component tests, E2E journey (issue → head queue → resolve).

**C. UI/UX breakdown**
- At-risk rows gain a golden "Impending drop" chip when `absencesBeforeBelowThreshold === 0` (the CHED trigger); the action opens a confirm sheet (note textarea ≤500) then downloads the notice.
- Referral cards: student + section + generated-by + status pill (`generated` golden, `acknowledged` maroon/white, `counseling_scheduled` maroon-dark/golden border, `resolved` green) + timeline of transitions.
- Notice layout: A4 portrait, PUP header kit, "NOTICE OF IMPENDING DROP (CHED CMO No. 40, Art. V §21)" title, student block, absence table, computation line, action checkboxes, signature lines (Advisor / Guidance / Chair), handbook excerpt footer in 8pt.

**D. Panel pitch (20s)**
"The 20% absence rule usually lives in a spreadsheet until week sixteen — too late. Polycheck detects the threshold the morning it is crossed, generates the official CHED-compliant warning with the exact absence ledger, and routes it to the chair and guidance queue with one click. Early-warning becomes early-action, and every step is audited."

**E. Phasing**
- F5.0 shared contract + zod → F5.1 migration + service/controller (+ specs) → F5.2 notice builder → F5.3 web at-risk integration → F5.4 Android → F5.5 E2E journey → gates.

---

### F6 — RA 10173 Compliance & Transparency Center

**Surface:** `/faculty/settings?tab=privacy` (web) + Android settings Privacy section; DPO summary PDF.

**A. Architecture & data flow**
- New setting `geolocation_retention_days` (integer 7–90, default 30) added to `SettingsService` kinds + seeded idempotently; editable by institution super admins (System tab), displayed in the privacy tab.
- Shredding: new Redis-locked daily job in `MaintenanceService` — for records older than retention: `AttendanceRecord.latitude/longitude = null`, `ScanAttempt.latitude/longitude/accuracyMeters/riskSignals = null` (keep outcome/distance decisional metadata + dispute evidence pointers); logs counts; last-run stamp in a setting row `privacy_shred_last_run` (display-only).
- Transparency data endpoint `GET /settings/privacy-center` (super admin + IT coordinators): retention config, last shred run + counts (7/30-day), consent coverage (`COUNT(users) with privacyConsentVersion = current / total actives`), recent consent audit rows, storage inventory (static manifest from shared constants), breach log (always "none recorded" until a real incident surface exists).
- DPO Summary: `GET /docs/dpo-summary?format=pdf` — one-pager: data inventory table, retention attestation ("0 coordinate rows older than N days — verified <timestamp>"), consent coverage %, lawful-basis statement (RA 10173 §12/§13 legitimate educational interests + consent), retention schedule, DPO contact block.
- Tab visibility: super admin + IT coordinators (System-suite gate), matching the maintenance tab pattern.

**B. Files**
- `shared/src/types/privacy.ts` (new) — `PrivacyCenterSnapshot`, data-inventory constants, DPO block; `shared/src/types/maintenance.ts` — add `MAINTENANCE_SETTINGS_CHANGED_EVENT`-style `PRIVACY_SETTINGS_CHANGED_EVENT`? (reuse settings invalidation pattern); `shared/src/types/api.ts` — `getPrivacyCenter()`.
- `backend/src/settings/settings.service.ts` (+ spec) — new integer key + `getPrivacyCenterSnapshot()`.
- `backend/src/common/services/maintenance.service.ts` (+ spec) — `shredEphemeralTelemetry()` job.
- `backend/src/settings/settings.controller.ts` — privacy-center read route; `backend/src/docs/*` — DPO builder (+ spec).
- `frontend/src/app/faculty/settings/settings-config.ts` + `page.tsx` — `privacy` tab (read-only dashboard + retention field mirrored into System tab) — keep IT-only visibility rules intact.
- `android/lib/institution-settings.ts` + `android/app/(faculty)/settings.tsx` — mirrored privacy section.
- Tests: settings spec (key clamps), shredding spec (retention boundary, dispute-window safety, fail-open), snapshot spec, docs spec (attestation line renders live counts), web/android tab tests.

**C. UI/UX breakdown**
- Web tab: three cards — "What we store" (inventory rows: data → purpose → lawful basis → lifetime), "Ephemeral telemetry" (big golden number `0` = rows beyond retention, last-shred timestamp, retention field), "Consent ledger" (coverage ring + recent consents table with onboarding timestamps). DPO PDF button (maroon, top-right).
- Tone: legal-readable, not dashboard-soup — Lora headings, DM Sans body, tabular numerals; every claim on the page is computed from the same tables the auditors will query.
- Android: condensed section with the same three groups; DPO summary via share sheet.

**D. Panel pitch (20s)**
"Privacy statements are usually PDFs of promises. Ours is a live attestation: the exact retention window enforced by a nightly shredder, a consent ledger with onboarding timestamps, and a one-click DPO summary whose numbers are queried from production at render time. RA 10173 compliance you can verify, not just assert."

**E. Phasing**
- F6.0 shared contract → F6.1 setting + shredding job (+ specs) → F6.2 snapshot endpoint + DPO doc → F6.3 web tab → F6.4 Android mirror → F6.5 E2E (tab renders, attestation `0`, PDF downloads) → gates.

---

### F7 — "Drop-The-Mic" Offline Outage Replay Simulator

**Surfaces:** web dev-tools popover (cockpit + dashboard footer, `?simulator=1` also) + Android More-sheet item; both flag-gated.

**A. Architecture & data flow**
- Arming: `outage-simulator.ts` module (web + android twins) exposes `armOutage()/disarmOutage()/isArmed()`; the API clients' fetch wrapper checks it first and rejects with `SimulatedNetworkError` — identical shape to a real network failure so every existing path (queue enqueue, `isNetworkFailure`, sync classification, UI banners) behaves exactly as in a real outage.
- Demo script: arm → scan QR → UI enters `OFFLINE MODE (LOCAL ENCRYPTED QUEUE)`; the queue panel shows `Receipt #<sequence>` (local sequence + first 8 chars of the queued operation id — e.g. `Receipt #104 · a1b2c3d4`); records land in the encrypted store (web IndexedDB AES-GCM, mobile SQLite) and the online-mode cockpit shows the preservation notice.
- Resume: disarm → drain (`drainOfflineQueue`) → batches hit `/sync/attendance/batches` → receipts poll to completion → server emits existing `attendance:updated` → teacher cockpit toasts "Reconciled N offline check-ins" (rendered from the event; count tracked client-side during drain) → clock offset refresh via `/health` (`setServerClockOffset`) happens in the existing post-sync tick.
- No backend changes at all; the simulator is honest evidence that the offline engine is real.

**B. Files**
- `shared/src/utils/outage-simulator.ts` (pure flag store, platform-agnostic; test file) — used by both clients.
- `frontend/src/lib/api-client.ts` — check `isOutageArmed()` in `fetchWithTimeout` (one guard, one throw).
- `frontend/src/components/dev/OutageSimulator.tsx` (new; floating tool, `role="region"`), mounted in the cockpit + faculty dashboard when `process.env.NEXT_PUBLIC_ENABLE_OUTAGE_SIMULATOR === 'true'` (documented in `frontend/.env.example` + compose local).
- `frontend/src/lib/offline/store.ts` — expose `queueSequence()` (count + last id) for the receipt display (read-only helper; queue schema untouched).
- `android/services/api-client.ts` — same guard; `android/lib/outage-simulator.ts` if the shared util needs a RN store variant (prefer shared).
- `android/components/OutageSimulatorSheet.tsx` (new) + More-sheet item gated by `EXPO_PUBLIC_ENABLE_OUTAGE_SIMULATOR === 'true'`.
- Tests: shared util tests; web api-client test (armed → throws SimulatedNetworkError; writes enqueue; disarm → drain flushes — reuse the existing sync-engine test harness); android jest mirror; E2E `e2e/outage-simulator.spec.ts` (Chromium, flag enabled in the Playwright env): arm → scan → receipt chip → resume → record appears in cockpit roster + reconcile toast.

**C. UI/UX breakdown**
- Simulator tool: maroon pill with a golden bolt icon and `OFFLINE`/`LIVE` state; arming asks for confirmation (it is a demo killswitch, double-tap safe); while armed, an amber `OFFLINE MODE — LOCAL ENCRYPTED QUEUE` banner replaces online indicators and the queue chip shows `Receipt #104`.
- Resume: same pill turns green `RESTORE & REPLAY`; during drain, a progress line counts `Syncing 2/3…`; completion toasts `3 offline check-ins reconciled` on both teacher surfaces.
- Everything is visibly token-styled (maroon/golden) — the simulator is presentable on a projector, not a dev-only eyesore.

**D. Panel pitch (20s)**
"Watch me cut the campus internet mid-class." (arm) "Attendance keeps working — signed, geotagged, encrypted into a local queue with a numbered receipt." (scan → `Receipt #104`) "Now restore." (drain) "The queue drained itself, the backend reconciled every record, and the teacher's dashboard updated live. That is offline-first as an architecture, not a slogan — and we can reproduce it on demand."

**E. Phasing**
- F7.0 shared flag store + tests → F7.1 web client guard + queue-sequence helper + simulator UI (+ tests) → F7.2 Android guard + sheet (+ jest) → F7.3 env plumbing (compose local + Playwright env; prod defaults off) → F7.4 E2E journey → gates.

---

### F8 — "Blackbox Flight Recorder" Dispute Telemetry Timeline

**Surfaces:** `/faculty/disputes` review drawer (web) + Android dispute review sheet.

**A. Architecture & data flow**
- `GET /attendance/records/:id/timeline` → shared `RecordTimelineEvent[]`: `{ kind: 'activation'|'scan'|'signature'|'queue'|'network'|'sync'|'dispute'|'decision'|'excuse', at: string, label: string, detail?: { distanceMeters?, radiusMeters?, insideGeofence?, mocked?, pinVerified?, channel?, deviceIdMasked?, receiptId? }, source: 'session'|'scan_attempt'|'token'|'record'|'audit' }` — assembled by a new `attendance-forensics.service.ts` from: session activation fields, `ScanAttempt` rows (already telemetry-complete), `tokenSnapshot` → `decodeTokenPayload(token).issuedAt` (signature event), record `createdAt`/`syncedAt` (server arrival / batch sync), dispute/excuse stamps; sorted by `at` and de-duplicated.
- Recommendation chip computed server-side (deterministic, unit-tested): `ACCEPT` when signature valid ∧ attempt inside geofence ∧ inside window ∧ no duplicate-conflict; `REVIEW` when signals conflict (e.g. `mocked: true`, accuracy > threshold, offline+stale); `REJECT` when duplicate/`concurrent_session_conflict`. Rationale string is human-readable and cites the exact evidence (`Cryptographic proof confirms student presence at 08:02:15`).
- Authorization: record owner teacher / department head (dept) / super admin — the standard record scope.

**B. Files**
- `shared/src/types/attendance.ts` — `RecordTimelineEvent`, `RecordTimeline`, `DisputeRecommendation` (+ label maps).
- `shared/src/types/api.ts` — `getRecordTimeline(recordId)` + both client impls.
- `backend/src/attendance/attendance-forensics.service.ts` (new, + spec) — assembly + recommendation; `attendance.controller.ts` — `GET records/:id/timeline`; `attendance.module.ts` wiring.
- `frontend/src/app/faculty/disputes/page.tsx` — expandable timeline in the review drawer (`components/disputes/DisputeTimeline.tsx` new + test); recommendation chip drives a pre-filled decision (teacher can still override — the chip is advisory).
- `android/app/(faculty)/disputes.tsx` — same timeline in the review sheet (shared render logic kept thin).
- Tests: forensics spec (ordering, dedupe, offline batch grouping, recommendation matrix incl. mocked/outside/duplicate), controller scope spec, web/android component tests, E2E (offline-path record shows queue→sync events + ACCEPT chip).

**C. UI/UX breakdown**
- Vertical rail: golden nodes for verified events, maroon for anomalies, zinc for informational; each row = time (DM Sans mono, tabular) + kind icon + label + evidence chips (`21m inside geofence`, `ED25519 signature verified`, `offline · queued`, `Receipt a1b2c3d4`).
- The recommendation chip sits pinned at the top: `[RECOMMENDATION: ACCEPT DISPUTE — Cryptographic proof confirms student presence at 08:02:15]` in golden-on-maroon; `REVIEW`/`REJECT` variants use the semantic badge palette.
- Expand/collapse per record; timestamps use the trusted clock where client-sourced (`clientScannedAt`) and are labeled `device clock (offset-corrected)` — honest about provenance.

**D. Panel pitch (20s)**
"When a student disputes, we don't argue — we replay the blackbox: activation, the exact scan second, the signature the phone itself minted, the offline queue window, the sync arrival, all ordered and source-labeled. The system then recommends a decision from cryptographic evidence, and the teacher decides with one click. Dispute resolution becomes forensics, not memory."

**E. Phasing**
- F8.0 shared types + client binding → F8.1 forensics service + endpoint (+ recommendation matrix specs) → F8.2 web timeline component + disputes integration → F8.3 Android sheet → F8.4 E2E journey (offline dispute → timeline → accept) → gates.

---

### F9 — Cryptographic Attendance Hash Chain Ledger

**A. Architecture & data flow**
- Schema (additive migration): `AttendanceRecord.prevHash String?`, `recordHash String?`, `salt String?` + index `(sessionId, timestamp)` (exists via session index? add composite if missing) — nullable so the migration backfills without locking writes.
- Chain write: inside the same transaction that creates the record (scan path, manual path, offline batch path — three call sites share one `appendLedger(tx, record)` helper): read the session's current head (last row by `(timestamp, id)`), compute `recordHash = SHA-256(prevHash ‖ studentId ‖ timestamp.toISOString() ‖ sessionId ‖ salt)`, persist. A per-session advisory lock (`pg_advisory_xact_lock(hashtext(sessionId))`) serializes concurrent classroom bursts; the Redis head cache is *not* used (DB is authoritative; classroom contention is small).
- Daily anchor: cron in `MaintenanceService` writes `{ date, lastRecordHash, recordsCounted }` into an `InstitutionSetting` row `ledger_anchor_<date>` **and** an `ledger.anchored` AuditLog row — an append-only external checkpoint (a DBA rewriting attendance breaks the published anchor; the audit row is itself hashed by the existing audit trail conventions).
- Verify: `POST /audit-logs/ledger/verify` (super admin) streams sessions, recomputes each hash, checks `prevHash` linkage + anchors; returns `{ verified, recordsChecked, sessionsChecked, brokenAt?, firstMismatch? }`; writes `ledger.verified` audit row (outcome + counts). Verification is read-only and idempotent; backfilled historical rows verify under the same math.
- Determinism rule: the hashed timestamp is the record's `timestamp` (scan moment), not arrival time; offline batches chain in server-arrival order but hash their own scan timestamps — the chain therefore records *both* truths (order of arrival is the linkage order).

**B. Files**
- `shared/src/utils/ledger.ts` (new + tests) — `computeRecordHash({ prevHash, studentId, timestamp, sessionId, salt })`, `LedgerVerifyResult` types (shared crypto via `node:crypto` on the server only — keep the pure math here with injected hash fn or a WebCrypto-compatible implementation).
- `shared/src/types/api.ts` — `verifyLedger(): Promise<LedgerVerifyResult>`.
- `backend/prisma/schema.prisma` + migration `2026_______wow_attendance_hash_chain` (+ idempotent backfill SQL in the repo's self-healing style).
- `backend/src/attendance/ledger.service.ts` (new, + spec) — `appendLedger`, `verifyChain`, anchor helpers; wired into `attendance.service.ts` create/manual/sync commit paths (one call each) and `backend/src/sync/sync.service.ts` batch commit.
- `backend/src/common/services/maintenance.service.ts` (+ spec) — daily anchor job.
- `backend/src/audit-logs/audit-logs.controller.ts` (+ spec) — verify endpoint.
- `frontend/src/app/faculty/audit-logs/page.tsx` — "Verify Ledger Integrity" button + result banner (verified ✓ emerald / broken ✗ red with `brokenAt`).
- `android/app/(faculty)/audit-logs.tsx` — same button/result.
- Tests: ledger unit (hash math, chain order, tamper detection by mutating a row in a test double), service specs (three write paths append; advisory lock; offline arrival order), verify spec (clean + tampered + anchor-mismatch), audit rows, E2E journey (verify button → verified banner; tamper via SQL in a dev-only E2E hook is out of scope — unit-level tamper proof instead).

**C. UI/UX breakdown**
- Button: outline maroon, shield icon, `Verify Ledger Integrity`; while scanning shows `Scanning N records…`; result banner: emerald `✓ Ledger intact — 1,204 records across 42 sessions verified · last anchor 2026-11-01` or red `✗ Chain broken at <recordId> — investigate session <id>` with a link to the record.
- Each disputed/tampered record in the cockpit/audit views can later display its `recordHash` prefix (8 chars, mono) as a fingerprint chip — a small, powerful visual for the defense.
- Copy discipline: "tamper-evident" (not "tamper-proof") everywhere; anchors are explained in a tooltip (`Daily chain heads are published to the audit trail`).

**D. Panel pitch (20s)**
"Every check-in is hashed into the previous one — change a single grade-book row and the chain breaks visibly. Each night the chain's head is published to the append-only audit trail, so even a database administrator rewriting history cannot repaint the past without detection. It is the same principle that secures blockchains, applied with a salt and an anchor — auditability with cryptographic teeth."

**E. Phasing**
- F9.0 shared hash util + types (+ tests) → F9.1 migration + backfill → F9.2 `ledger.service` + wiring into the three commit paths (+ specs) → F9.3 anchor cron → F9.4 verify endpoint + audit rows → F9.5 web + Android verify UI (+ component tests) → F9.6 E2E journey → gates.

---

## 3. Cross-Cutting Contracts Summary (shared-first checklist)

| Addition | Kind | Where |
|---|---|---|
| `studentName?`, `checkpoint?` on `attendance:updated`; `ATTENDANCE_ANOMALY_EVENT`, `KIOSK_JOIN_EVENT`, `SESSION_FINALE_EVENT` | realtime payloads/constants | `shared/src/types/{api,session,attendance}.ts` |
| `SessionFinaleSummary`, `AttendanceAnomalyEvent`, `ScanAttemptView` | types | `shared/src/types/{session,attendance}.ts` |
| `RecordTimeline(Event)`, `DisputeRecommendation` | types | `shared/src/types/attendance.ts` |
| `AtRiskReferral`, `ReferralStatus` + zod | types/validation | `shared/src/types/at-risk.ts`, `shared/src/validation` |
| `PrivacyCenterSnapshot`, data inventory constants | types | `shared/src/types/privacy.ts` |
| `computeRecordHash`, outage-simulator flag store, `formatLiveUtcStamp`/`maskDeviceChip` | pure utils | `shared/src/utils/{ledger,outage-simulator,id-hologram}.ts` |
| `getScanAttempts`, `getRecordTimeline`, `verifyLedger`, `generateAtRiskReferral`, `getAtRiskReferrals`, `updateAtRiskReferral`, `getPrivacyCenter`, class-record/DPO/notice download bindings | ApiClient methods | `shared/src/types/api.ts` + both clients |

**Migrations (2):** `…wow_at_risk_referrals` (F5), `…wow_attendance_hash_chain` (F9 — columns + backfill + composite index). **Env flags (2):** `NEXT_PUBLIC_ENABLE_OUTAGE_SIMULATOR` / `EXPO_PUBLIC_ENABLE_OUTAGE_SIMULATOR` (default off; local compose + Playwright env on). **Settings keys (2):** `geolocation_retention_days`, `privacy_shred_last_run` (+ per-day `ledger_anchor_<date>` rows).

---

## 4. Global Implementation Sequence (each phase ships green)

Demo-critical order vs. build-risk order differ; the build order below de-risks (backend-first, read-only before write-path, visuals last) while keeping every feature independently testable:

1. **W1 — F9 ledger** (backend + audit UI): foundational forensic story; touches write paths once, early, with the full suite green around it.
2. **W2 — F8 blackbox** (read-only forensics on top of F9's fingerprints + attempts): pure additive reads.
3. **W3 — F6 privacy center** (settings + cron + doc): independent; installs the shredding policy cited by the DPO story.
4. **W4 — F4 class record PDF** (docs pipeline, read-only): independent of the others.
5. **W5 — F5 CHED slip** (first write-path feature: referrals): builds on at-risk + docs + notifications patterns already proven by W4.
6. **W6 — F2 radar** (read + realtime additive event): unlocks the cockpit's live-visual layer.
7. **W7 — F3 hologram** (pure client): zero backend risk; screenshot evidence pass.
8. **W8 — F7 outage simulator** (client killswitch + E2E flag): best rehearsed once radar/kiosk exist so the demo arc is complete.
9. **W9 — F1 kiosk** (the finale): consumes `attendance:updated` + `attendance:anomaly` + finale broadcast — all landed by W6/W8.
10. **W10 — Defense rehearsal & evidence**: `visual-capture` additions for kiosk/radar/hologram, demo script run-through (arm outage → scans → radar → finale → exports), plan addendum + AGENTS.md entry.

**Per-phase gate (every W\*):** shared → backend (+ specs) → web → android → E2E journey → `pnpm lint` / typechecks / package tests / `pnpm build` / Docker rebuild + smoke. Regression budget: the full Chromium suite must remain **0 failed**; unit counts only grow (est. +150–200 across packages by W10).

---

## 5. Verification Matrix (suite-level DoD)

| Layer | Gate |
|---|---|
| Shared | new utils/types fully tested (`ledger`, `outage-simulator`, `id-hologram`, referral zod) |
| Backend | ledger append/verify/tamper specs; forensics recommendation matrix; shredding retention boundary; docs builders (class record 18-week math, CHED citations, DPO attestation); gateway kiosk/finale/anomaly specs; scope denials for every new endpoint |
| Web | component tests (kiosk rings/ticker, radar modal pins, hologram watermark, dispute timeline, referral queue, privacy tab, ledger banner) |
| Android | jest parity (stores, classification, overlay shaping, referral/verify UI logic) |
| E2E (Chromium) | new journeys: kiosk finale, radar red-pin, outage replay + reconcile, dispute timeline accept, ledger verify, exports download, CHED referral → head queue |
| Live smoke | Docker stack rebuilt; demo script executed end-to-end against seeded data; zero backend 5xx |

---

## 6. Risks, Open Questions & Pre-written Answers

| Risk / question | Disposition |
|---|---|
| Ledger write-path contention during 200-student bursts | Per-session advisory lock + small classroom sizes; the load-simulation harness (LT waves) is the regression gate; chain order is arrival-order truth. |
| "Zero raw GPS saved" is not true today | F6 reframes the claim as *ephemeral retention* (default 30 days, shredder-enforced, live-attested) — the honest, defensible position; panel copy uses the attestation, not an absolute. |
| Kiosk/finale events on multi-instance Socket.IO | Redis adapter already broadcasts across instances; finale emission is idempotent (end() + cron share the resolution outcome, `session:finale` carries `endedAt` so clients dedupe). |
| Simulator leaking into production | Default-off env flags, absent from the EAS production profile and prod compose; E2E env enables it explicitly; the simulator also no-ops unless armed at runtime. |
| pdfkit layout fragility for the 18-week grid | Reuse the existing docs kit's measured-column approach; golden tests assert row/column math from data (not pixels); docx fallback shares the same aggregation. |
| `expo-sensors` native rebuild concern | The accelerometer parallax is optional and guarded; the CSS sweep is the baseline, so no rebuild is required for the feature to ship. |
| Anomaly events disclosing coordinates to other viewers | Radar/anomaly payloads are teacher/head/super-admin scoped by the existing session access checks; students never receive them. |
| Hash-chain backfill on large historical data | Backfill runs per-session in the migration's self-healing style, batched; nullable columns keep the migration online. |
| Recommendation chip overruling teacher judgment | The chip is advisory UI; `decideExcuse`/dispute resolution APIs are unchanged; audits record the human decision. |

---

## 7. Implementation Notes (W1–W10 closed)

Executed in three backend/shared waves (B1: F9+F8 · B2: F6+F4 · B3: F5+F2+F1) followed by four parallel UI waves (web ×2, android ×2) and an E2E wave. Final verification, all green:

| Suite | Before | After |
|---|---|---|
| `@polycheck/shared` | 122 | **176 / 14 files** (+54: ledger math, outage store, id-hologram, referral zod, event constants, privacy inventory) |
| backend | 845 / 75 | **993 / 82 suites** (+148: ledger append/verify/tamper, forensics matrix, shredder, docs builders, referral state machine, gateway kiosk/finale/anomaly, scope denials); lint + format clean; **coverage thresholds pass** |
| web | 304 / 48 | **397 / 59 files** (+93: kiosk suite, radar modal, outage simulator, dispute timeline, ledger banner, referral queue, privacy tab, exports); lint + tsc + `next build` clean |
| android | 335 / 27 | **654 / 35 suites** (+319, incl. a 190-test bindings suite); tsc clean; **coverage 92.1% stmts / 79.7% branches / 96.9% funcs / 97.6% lines — all CI thresholds pass with margin** |
| Chromium E2E | 122 / 3 / 0 | **130 passed / 3 skipped / 0 failed** — new `e2e/wow-suite.spec.ts` runs all 8 journeys live against the rebuilt Docker stack (ledger verified **3,145 records / 189 sessions** after backfill; kiosk finale; radar counters; class-record + CHED-notice + DPO downloads; outage arm→receipt→reconcile; privacy attestation) |

### Deviations from the blueprint (all recorded)

1. **Ledger**: linkage is *arrival-order* (`prevHash` references the previously committed row, wherever its timestamp sits) — strict timestamp adjacency would false-flag offline batches; verification also checks the per-day `ledger.anchored` audit rows (head hash still present in that day's chain + the day's chained count never shrank). The `InstitutionSetting` anchor mirror was dropped — the append-only `AuditLog` row is the anchor of record. Seed-placeholder roster rows are intentionally unchained (overwritten by the accepted commit); `verifyLedger` treats `recordHash IS NULL` rows as off-chain. Backfill runs via `prisma/backfills/ledger-backfill.ts`, compiled into the image's `dist-seed` (`Dockerfile.backend`) and executed once (189 sessions / 3,145 rows).
2. **Chain immutability refinement**: the manual-attendance re-mark no longer rewrites `timestamp` (chain nodes are immutable; recency remains visible via `updatedAt`).
3. **F2**: the scan validator stays pure — anomaly emission lives in `attendance.service`'s denial funnel; PIN failures and online (zero-GPS) attempts never emit; `concurrent_session_conflict` is a disputed record, not an anomaly.
4. **F1**: kiosk is a full-stage fixed overlay (chrome-free) with a scoped `:has()` rule that hides the assistant bubble while mounted; per-room socket factories are co-located in the radar modal/kiosk page (mirroring `lib/realtime.ts`'s handshake) because the shared helper lacked the new events.
5. **F3**: blend modes remapped to the physically sensible pair (`multiply` on light faces, `screen` on dark) with mode-aware `dark:` variants; **accelerometer parallax is dormant by design** — `expo-sensors` is not installed, the guarded dynamic require degrades to the CSS/RN sweep, and adding the dependency is a native-rebuild fast-follow.
6. **F5**: the `/faculty/at-risk` page gate widened from oversight-only to all faculty (teachers file for their own sections — backend scope was already teacher-scoped; heads keep department-wide oversight + referral transitions). Notice downloads use a fixed client filename (`downloadAssistantFile` returns a blob without `Content-Disposition` — same trade-off as existing attachment cards).
7. **F6**: the privacy tab is strictly read-only; `geolocation_retention_days` is edited from the **System** tab (added to both platform configs, mirrored key sets, defaults `30`); the shred summary rides a Redis snapshot (`privacy:shred:last`, 48 h TTL) with an in-memory fallback instead of a settings row (no whitelist pollution).
8. **F7**: the outage guard is a single `isOutageArmed()` check at the top of both clients' fetch wrappers; reconcile toasts are computed from real pending-count deltas (never fake success); the More-sheet item + floating pill are strict `=== 'true'` env-gated and the EAS production profile pins `EXPO_PUBLIC_ENABLE_OUTAGE_SIMULATOR=false`.
9. **Pre-existing bug fixed en route (both clients)**: the "Connect to the internet once…" provisioning guard threw a plain `Error`, which the outer offline-activation catch classified as a network failure — first-time devices silently activated offline with scans destined to fail server-side signature verification. Both sites now throw a typed `4xx` (`ApiHttpError`/`ApiRequestError`) that escapes the offline fallback (fail-closed), with tests asserting the block.
10. **E2E hygiene**: `users-admin.spec.ts` was retitled-dialog copy drift (`Edit profile` → `Edit Account Profile`) — one-line test fix; the wow-suite referral journey cleans up after itself (resolved referrals never block re-filing) and the outage journey always disarms in `finally`.
