# Offline-First Web (PWA) — Plan

> **Status:** Implemented (M1–M4). Addendum below records deviations from this plan.
> Sequenced **before** bulk import
> (see [`bulk-import-plan.md`](./bulk-import-plan.md)). Companion to the mobile offline
> architecture described in [`sync-plan.md`](./sync-plan.md).

---

## 1. Goal

Make the Next.js web dashboard work **without internet in the classroom**, exactly like the
Expo mobile app, so iOS students (who cannot install the Android app) can scan QR codes,
validate geofences locally, and check in offline — no more "tell the teacher to add me
manually". Faculty session activation (QR generation, manual attendance, end session) also
works offline on laptops in no-WiFi rooms.

**Primary personas:** iPhone student (scan offline), teacher with laptop (activate/QR/manual attendance offline).

## 2. Non-Goals

- No background/OS-scheduled sync on web (iOS Safari has no Background Sync API — same
  opportunistic-while-active model the mobile app already accepts; see §14).
- No offline support for super-admin pages (users, reports, audit logs, institution
  settings, **bulk import**) — online-only by design, mirroring mobile.
- No backend changes required for the core flows (the sync contract already exists).
- No push notifications in this plan (possible later for installed PWAs, iOS 16.4+).

## 3. Verified Current State (facts)

| Fact | Evidence |
|---|---|
| Web has **zero** offline infrastructure: no manifest, no service worker, no IndexedDB, no `navigator.online` usage | repo-wide grep on `frontend/src` |
| Teacher signing key machinery **already exists** on web | `frontend/src/lib/signing-key.ts` (`getOrCreateTeacherSigningKey`) |
| Student/faculty pages are `'use client'` + `api.*` fetches — the exact shape that survives offline | `frontend/src/app/student/**`, `frontend/src/app/faculty/**` |
| Student camera scan already works on iOS Safari (online): `BarcodeDetector` → ZXing video fallback | `frontend/src/components/scan-qr/useQrCamera.ts`, `ScanQrModal.tsx` |
| Backend sync contract, built for mobile, is reusable as-is | `backend/src/sync/sync.controller.ts` — `POST /sync/attendance` (inline), `POST /sync/attendance/batches` (202 + receipt), `GET /sync/attendance/batches/:receiptId` |
| Server-side offline activation is already enforced at sync time | `backend/src/attendance/attendance.service.ts:412` (`ensureOfflineActivation`) |
| `/health` returns server `timestamp` — trusted clock source for both clients | consumed by mobile `getTrustedTimestamp` (`android/services/api-client.ts:803`) |
| Mobile offline reference implementation to port | `android/services/offline-store.ts` (owner-scoped encrypted caches, `sync_queue_v2`), queue kinds: `attendance_scan` / `scan_attempt` / `session_activation` / `session_end` |
| Mobile sync drain algorithm to port | `android/services/api-client.ts:735-796` — enqueue → receipt polling → 409 reconciliation |
| Session restore already tolerates network failures; only authoritative `401/403` clear the cached user | `frontend/src/lib/api-client.ts` (`restoreSession`, `isAuthRejection` — 2026-08 audit remediation) |
| Shared crypto/validation utilities are ready and must not be reimplemented | `@polycheck/shared` — `haversineDistance`, `isTokenInValidityWindow`, `decodeTokenPayload` |

## 4. Architecture Overview

```
Browser (installed PWA, standalone on iOS home screen)
┌───────────────────────────────────────────────────────────────┐
│  UI ('use client' pages — unchanged component structure)      │
│    scan modal · student dashboard · faculty session cockpit   │
│            │ read/write                                       │
│  api-client.ts (rewritten: cache-aware facade)                │
│    ├─ reads:  memory → IndexedDB cache → network → update cache│
│    └─ writes: authoritative first; on net-failure → queue +   │
│                optimistic result (mirrors mobile semantics)   │
│            │                                                  │
│  Offline store (IndexedDB, AES-GCM encrypted, per-account)    │
│    user · sessions · sections · roster · records ·            │
│    sync_queue_v2 · meta (clock offset, lastSync)              │
│            │ drain triggers: online event, visibilitychange,  │
│              post-action, 30s timer while app open            │
│  Sync engine (port of android/services/api-client drain)      │
│    POST /sync/attendance/batches → receipt → poll → reconcile  │
│            │                                                  │
│  Service worker (precache shell · offline fallback ·          │
│    GET stale-while-revalidate · NEVER cache POST/queue ops)   │
└───────────────────────────────────────────────────────────────┘
        │ unchanged HTTPS API (no backend changes for M1–M4)
        ▼
   NestJS /sync · /attendance · /sessions · /auth
```

## 5. Mobile → Web Primitive Mapping

| Mobile (source of truth) | Web target | Notes |
|---|---|---|
| SQLite via `expo-sqlite` (`android/services/offline-store.ts`) | IndexedDB via `idb` | Same table/store shapes; serialized transactions not available → rely on single-writer async queue |
| SecureStore / `expo-crypto` key material | WebCrypto `AES-GCM` with a **non-extractable `CryptoKey`** persisted in IndexedDB | Same owner-scoping rule: encrypt per logged-in user id |
| `/health` clock offset (`getServerClockOffset`) | Identical `/health` fetch, offset cached in `meta` store | `issuedAt` stays inside the signed token; device clock irrelevant |
| Teacher keypair in SecureStore (`android/services/signing-key.ts`) | **Already exists** — `frontend/src/lib/signing-key.ts` | Verify it stores the same ECDSA P-256 key format consumed by the backend `teacherPublicKey` |
| `classifySyncError` (android test-covered) | **Promote to `@polycheck/shared`** so both clients share one implementation | Move + re-export; android keeps its existing tests passing |
| `OfflineSyncPanel`, scan result states ("saved on device") | Web `OfflineSyncPanel` + equivalent scan banner states | Reuse copy/semantics |
| Maestro offline flow | Playwright **offline emulation** contexts (CDP `Network.emulateNetworkConditions`) | §16 |
| Opportunistic drain while active | `online` event + `visibilitychange` + post-action + 30s interval | §14 constraint |

## 6. New Dependencies (web only)

| Package | Purpose | Notes |
|---|---|---|
| `idb` | IndexedDB wrapper | Tiny, promise-based; used for cache + queue |
| `@serwist/next` | Service worker generation for App Router | Bake only the allowlist of GET routes into `runtimeCaching` (§8). Plain hand-written `public/sw.js` is the accepted fallback if Serwist fights the Next 16 build |
| `@serwist/workbox-window` | SW registration + update toast | Lightweight; no other purpose |
| — (no new state lib) | Queue/cache are non-React plain modules | Keeps hooks/order rules intact |

## 7. Storage Layer Design

Port `offline-store.ts` shapes 1:1 (store names may differ; semantics must not):

```ts
// frontend/src/lib/offline/store.ts
stores: {
  meta:      { key: string;            value: unknown }            // clockOffsetMs, lastSyncAt, consentVersionCheck
  user:      { key: 'current';         value: CachedUserSnapshot } // profile + role + session-validity snapshot
  sessions:  { key: sessionId;         value: Session }            // full session incl. geofence + teacherPublicKey
  sections:  { key: sectionId;         value: Section }
  roster:    { key: `${sectionId}:${studentId}`; value: RosterEntry } // per-section student list (teacher cockpit)
  records:   { key: recordId;          value: AttendanceRecord }   // includes local optimistic records
  queue_v2:  { key: idempotencyKey;    value: QueuedOp }           // kind ∈ attendance_scan | scan_attempt |
                                                                   //   session_activation | session_end |
                                                                   //   attendance_manual | attendance_status
}
```

Rules locked from mobile:

- **Owner-scoped encryption**: every store except `meta` is AES-GCM encrypted with a key derived/scoped to the logged-in user; logging out wipes all stores (same as android).
- **Queue entry shape mirrors mobile**: `{ kind, payload, clientAttemptId, createdAt, attempts, lastError }`.
- **clientAttemptId** (`crypto.randomUUID()`) travels with every scan; server-side `@@unique([studentId, clientAttemptId])` on `ScanAttempt` makes retries idempotent.
- **Write-ahead rule**: a queued op is inserted before any UI shows success; UI optimistic state is derived from `queue_v2` + local `records`, not from memory.
- **Storage persistence**: after the privacy consent gate passes an online session, call `navigator.storage.persist()`; show a tiny storage-quota warning in the offline panel if `estimate()` shows < 50 MB free.
- **Eviction**: on logout → `indexedDB.deleteDatabase` and non-extractable key dies with it.

## 8. Service Worker & Caching Policy

Precache: app shell (`/login`, `/student/dashboard`, `/faculty`, `_next/static/*`), offline fallback route (`/offline`), icons.

`@serwist/next` config — explicit allowlist only:

| Route class | Strategy | Rationale |
|---|---|---|
| `/api/*` GET for reads (sessions, sections, Subjects, students, roster, health) | **Network-first, 60s timeout → cache fallback**, cache updated in background | Pre-session sync freshness; offline serves last-known |
| `/api/*` POST/PATCH/DELETE | **Never cached, never intercepted** | Writes go through api-client queue; SW stays out of the transactional path |
| `/api/auth/*` | Never cached (cookie + 401 semantics must stay authoritative) | Offline auth handled in app layer (§10) |
| `/_next/static/*`, icons, fonts | Cache-first (immutable) | Shell speed |
| Socket.IO (`/socket.io/*` incl. WebSocket upgrade) | Bypass entirely | Realtime degrades to polling/offline silently |

Non-negotiables:

- SW must **never** hold or observe credentials/tokens; it caches opaque responses only.
- Bump version on every deploy; stale SW update → "App updated — reload" toast (reuse `useNotifications`).
- Initial page load while never-registered SW downloads in background (no navigation delay on first visit).

## 9. PWA Manifest & iOS Install

`frontend/src/app/manifest.ts` (Next App Router native):

- `name: "Polycheck"`, `short_name: "Polycheck"`, `display: "standalone"`,
  `background_color: "#0A0A0A"`, `theme_color: "#7B1113"` (matches maroon token),
  icons: 192/512 maskable from `assets/`, plus `apple-touch-icon`.
- Add `<meta name="apple-mobile-web-app-capable" content="yes">` and a standalone install guide:
  an **"Add Polycheck to your Home Screen"** callout card rendered once for iOS students
  (standalone detection via `window.matchMedia('(display-mode: standalone)')`),
  two-step instructions, one-time-dismissible (localStorage flag).
- iOS camera in standalone mode requires the HTTPS origin — already satisfied in production.

## 10. Auth & Session — Offline Behavior

- `restoreSession()` when offline: do **not** hit the network. Trust `user` store snapshot
  while the SW serves cached reads; the existing rule stands — only authoritative
  `401/403` (`isAuthRejection`) clears the cached user. Network/timeout errors keep the profile (already implemented; extend the branch to the offline fast-path).
- `SessionGuard`: add `offline: true` rendering mode — normal content, with a persistent slim offline banner (not a lock screen).
- `AuthSessionMonitor` + realtime `auth:session-replaced`: when offline, deferred — monitor resumes on reconnect and reconciles.
- **Consent gate**: shows as soon as the student is online with no consent; offline students who already consented in a prior online session keep working (consent version persisted in `meta`).

## 11. Time Discipline (unchanged contract, restated)

- Student UI validity checks read **signed `issuedAt`** from the token via
  `isTokenInValidityWindow(payload, serverTimeMs)` — `serverTimeMs` = `Date.now() + cachedClockOffsetMs` from `/health`.
- Teacher QR generation sets `issuedAt` from the same trusted clock (port of mobile
  `getTrustedTimestamp`), not raw `Date.now()`.
- Server clock stays the sole authoritative validator at sync time. Cached offset gaps
  degrade gracefully: if no offset cached, `inGrace` window widens client-side warnings but the server still decides.

## 12. Offline Flows

### F0 — Pre-Session Sync (student, online, one-time before class day)
Trigger: student dashboard mount while online.
Cache: `getSessions()` for today ± 1 day → `sessions` (with geofence, validity/grace, `teacherPublicKey`), enrolled `sections`, own recent `records`.
Readiness indicator: "Ready for offline class" chip on student dashboard when all three present; mirrors mobile pre-sync contract (student cannot scan offline without it — accepted constraint).

### F1 — Offline Scan (student)
Input channels unchanged: camera / upload image / manual token.
Pipeline (online): identical to today (server authoritative first).
Pipeline (offline):
1. Decode token → cached `sessions` lookup by `sessionId` claim (missing → hard stop: this session was not pre-synced — open the app once while online before class).
2. Local checks, mirrored to mobile exactly: geofence via `haversineDistance`
   (reject if outside; show measured distance/radius diagnostics like mobile), GPS accuracy
   gate (reject accuracy > 50 m fix), token window: `present` → `late` → `absent` with grace,
   duplicate token+student check against local `records` (screenshot-replay protection).
3. Persist optimistic record (`records`) + enqueue `attendance_scan`; UI banner states re-tuned from
   mobile copy: "verified" / "Late" / "outside geofence" / "queued — will sync" / "saved on device".
4. No `status:'pending'` ambiguity: status is computed client-side exactly as mobile does;
   server may still re-classify at sync (teacher sees disputed if mismatch).

### F2 — Offline Teacher Cockpit
Trigger: cockpit page mounts → cache `session` + geofence + roster subset.
- **Generate QR offline**: sign token with `signing-key.ts` keypair, `issuedAt` trusted, publish
  `session_activation` to queue **and** derive the same local activated state mobile derives
  (`ensureOfflineActivation` validates server-side at sync; add the mobile's "scan losing the
  activation lock waits & re-checks DB before proceeding" behavior — already present in backend).
- **End session offline** → `session_end` queue; web displays ended state from local data.
- **Manual attendance / tap-to-cycle offline** → client UUID (`crypto.randomUUID()`), optimistic row, `attendance_manual` / `attendance_status` queue kinds (backend `POST /attendance` already accepts these payloads; manual records are idempotent via `@@unique([sessionId, studentId])` reject-on-duplicate semantics + existing manual UUID convention).
- Realtime absent offline: cockpit polling + cached data silently; no error toasts —
  the `session-request-coordinator` already serializes refreshes; extend with offline guard.

### F3 — Sync Engine (both roles)
Port of android `drainOfflineQueue`:
1. Drains on: `online` event · `visibilitychange` visible · after any app action · 30s interval while app open.
2. Chunked: batch queue entries (`batches` of ≤ 25 records per request, mobile parity).
3. `POST /sync/attendance/batches` → `202 { receiptId }` → poll `GET .../:receiptId` with backoff
   → per-record outcomes (`accepted` / `duplicate_accepted` / `disputed` / `rejected(reason)`) →
   reconcile `records` (409 semantics ported verbatim — server/home-track definitive, client row
   re-classified or removed).
4. Session activation/end queue items similarly reconciled (server DB claim authoritative).
5. `classify-sync-error` **promoted to `@polycheck/shared`**: transient (retry with backoff, keeps entry) vs fatal (quarantined row visible in panel). No shared export exists today — this promotion is the only `shared/` change in the plan.
6. UI: `OfflineSyncPanel` (list, per-item retry, "saved on device", last sync time) — dock to
   both dashboards exactly as mobile does.

### F4 — Reads & Lists (offline)
- Faculty dashboard & student dashboard/schedule/subject lists: network-first SW cache + the IndexedDB
  store, so first paint shows cached data instantly and refreshes online. Coverage bounded to the
  entries in §8's allowlist — deliberately excludes admin/report pages.
- Any fetch failing while offline + no cache → existing `ErrorDisplay` states with "Offline —
  data available after reconnect" copy instead of generic error.

## 13. UI Additions (web)

| Component | Behavior |
|---|---|
| `OfflineBanner` | Slim persistent maroon/gold banner "Offline — changes will sync" on both roles' shells |
| `OfflineSyncPanel` | Queue list + retry + last-sync + storage estimate (parity with mobile panel) |
| Scan banner states | Reuse mobile copy: "verified", "Late (within grace)", "outside geofence (dist X/radius Y)", "duplicate — first wins on sync", "saved on device" |
| Install callout | iOS "Add to Home Screen" two-step card (one-time, dismissible) |
| SW update toast | "New version available — reload" |

## 14. iOS Safari Constraints (accepted, not open questions)

| Constraint | Impact | Mitigation / stance |
|---|---|---|
| No Background Sync API | Queue drains only while app open — same as mobile today | Document; drain aggressively on app open/visibility |
| IndexedDB eviction after ~7 days unused (unless installed) | Cache loss in dorm-bag scenario | Install mandate (device UX); `storage.persist()`; graceful full resync (F0 re-run), student sees "Re-sync needed" instead of silently wrong data |
| Web Push requires installed PWA (iOS 16.4+) | No reminders if not installed | Explicitly out of scope here (listed in Next Steps) |
| Camera needs HTTPS + user gesture | Deployed web already HTTPS | none |
| No `BarcodeDetector` on iOS Safari | — | already solved — ZXing fallback path exists in `useQrCamera` |
| SW unsupported in private browsing (legacy/some environments) | In-flight session may show offline errors | degrade to today's online-only behavior |

## 15. Security & Privacy

- IndexedDB data encrypted (AES-GCM non-extractable key), wiped on logout — the parity rule with the Android encrypted store.
- SW stores only HTTP response caches; never tokens, never future credentials.
- Offline-first scan still writes full evidence (GPS, device id, clientAttemptId, offline flag)
  — server-side risk plumbing (`ScanAttempt.offline`, geofence re-validate, dispute surfacing) is already in place.
- Sentry: nothing new captured from offline internals; existing body-stripping options preserved.
- Bulky artifacts (roster photos caches) out of scope; audit logging unchanged server-side.

## 16. Testing Strategy

| Layer | Approach |
|---|---|
| Unit | offline store round-trip per store (encrypted), queue drain (receipt ok / rejected / 409 reconcile / retry-on-network), clock-offset math, geofence/validity local checks (shared utils reused), SW rule unit via `serwist` config test |
| Integration (Jest) | api-client facade: mode matrix (online/offline), optimistic UI hydration from `records`+`queue_v2`, `restoreSession` offline path, consent gate offline |
| E2E (Playwright) | `context().setOffline(true)` + SW registered: student scan → queue → reopen online → receipt reconciles; teacher cockpit offline generate/manual/end → sync; disputes unaffected; family of assertions reusing e2e helpers |
| Cross-browser | Chromium E2E primary; WebKit for manifest/standalone-meta smoke; real-device manual matrix: iOS Safari + installed PWA (scan → airplane → sync), Android Chrome |
| Regression | Existing suites untouched in behavior; snapshot the `api-client` facade signatures |

## 17. Rollout

- Flag: `NEXT_PUBLIC_PWA_OFFLINE` (`true` locally/daily; staged enablement same as
  `NEXT_PUBLIC_ALLOW_QR_FALLBACKS` pattern — compose default `"true"` local, prod controlled).
- Stage 1: manifest + SW + banner (no queue) → pilot class.
- Stage 2: student offline scan → pilot.
- Stage 3: teacher offline cockpit → pilot.
- Stage 4: full. Telemetry: reuse `/metrics` counters — add `polycheck_offline_scan_queued_total`,
  `polycheck_offline_sync_batches_total{outcome}` server-side counters (already a metrics.service pattern).

## 18. Milestones (M1–M4)

| ID | Scope | Key files (new except where named) | Acceptance criteria |
|---|---|---|---|
| **M1 — PWA shell** | manifest, icons, Serwist SW + offline fallback page + allowlist caching, `NEXT_PUBLIC_PWA_OFFLINE`, offline banner, install callout | `app/manifest.ts`, `app/offline/page.tsx`, `lib/pwa/register-sw.ts`, sw config, `components/OfflineBanner.tsx` | Lighthouse PWA-checklist pass on `/student/dashboard`; GET reads serve from cache offline; POSTs unaffected; update toast on deploy |
| **M2 — Offline store + sync engine** | `idb` store (encrypted), queue_v2, drain + receipts + 409 reconcile, `classify-sync-error` shared promotion, `OfflineSyncPanel`, storage.persist | `lib/offline/*`, `lib/offline/sync-engine.ts`, `shared/src/utils/classify-sync-error.ts`, `components/OfflineSyncPanel.tsx` | unit + guaranteed reconciliation tests pass; parity suite vs android behaviors in tests mirrors 1:1 |
| **M3 — Offline student scan** | scan modal offline branch, pre-session sync + readiness chip, optimistic record + banners, trusted clock | `components/scan-qr/*` extensions, `lib/offline/presync.ts` | E2E: airplane-mode scan → queued → online → server record id matches; replay/duplicate provably rejected in E2E |
| **M4 — Offline teacher cockpit** | cached session/geofence/roster, offline QR generate + manual + end-session + queues, reconcile server-side | `lib/offline/teacher.ts`, `app/faculty/sessions/[id]/page.tsx` extensions | E2E: offline cockpit flow produces server-authoritative session states after sync; `ensureOfflineActivation` holds |

## 19. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Serwist vs Next 16 build conflicts | Accepted fallback: hand-rolled `public/sw.js` with a small build-time precache manifest — no shortcut in features |
| RSC flight-payload caching complexity | All PWA-relevant pages stay client-fetch (already true); SW never caches RSC payloads |
| Double validation divergence client vs server | Single source of truth: shared utils (haversine/token/classify) — no web-local reimplementation |
| 409 reconcile with concurrent stock-app edits | Server authoritative — client rows always re-classified (port of android semantics, already server-guaranteed) |
| Users never install on iOS | Install callout is one-time; enrollment section: teachers print instructions once; acceptable |
| Quota exceeded on low-end devices | `persist()` + `estimate()` warning; on pressure, evict read-only caches first — queue entries and attendance records are never evicted while the browser can protect them |

## 20. Decided vs Open

**Locked:**
- Web-first offline parity via PWA; backend stays untouched for M1–M4 (only optional `/metrics` counters in M2+).
- Client resources: `idb` + WebCrypto + Serwist-or-plain-SW; no state library gains.
- Opportunistic sync while app open (no background API reliance).
- Online writes remain authoritative-first; queue only on net-failure or intentional offline dispatch (mirrors mobile).
- `classify-sync-error` moves to `@polycheck/shared` (single implementation).
- bulk import (see [`bulk-import-plan.md`](./bulk-import-plan.md)) remains online-only and lands **after** this plan.

**Open (decide before M1 kickoff):**
1. SW tooling final call if Serwist misbehaves with Next 16 (time-box: 1 day spike).
2. Whether faculty schedule/calendar caches read-only online (nice-to-have, not required for scan integrity).
3. Telemetry counter set finalization before M2.

---

## 21. Implementation Addendum

- **SW tooling:** hand-rolled `frontend/public/sw.js` was chosen over Serwist (the plan's accepted
  fallback). It precaches `/offline` + icons, serves navigations network-first, caches immutable
  `/_next/static`/icons/fonts cache-first, and allowlists API GET reads. No build coupling.
- **Storage:** `idb` + WebCrypto AES-GCM; per-account key stored as a non-extractable `CryptoKey`
  (raw-key fallback only when a browser cannot structured-clone CryptoKey). Owner switch wipes
  user-scoped stores; logout clears all stores.
- **Sync:** one record per `/sync/attendance/batches` request (exact mobile parity) rather than
  25-record batches; receipt polling (4 attempts, backoff) and 409 activation/end reconciliation
  ported from mobile. Drains on online/visibility/post-action/30s.
- **API facade:** reads are network-first with IndexedDB fallback for subjects/sections/sessions/
  roster/student attendance; writes keep the authoritative-first rule with queued optimistic rows
  for scans, manual attendance, status taps, QR activation and session end.
- **Kill switch:** `NEXT_PUBLIC_PWA_OFFLINE=false` disables registration/banner/readiness UI.
- **Tests:** `frontend/src/lib/offline/store.test.ts` (encrypted round-trip, owner wipe, queue
  dedupe/terminal/retry) + `sync-engine.test.ts` (inline result, receipt polling, 409 reconciliation,
  terminal classification). Android keeps its own classification tests against the shared module.
- **Not exercised here:** Lighthouse PWA checklist and physical iOS/installed-PWA flows require a
  real HTTPS deployment/device; they remain a release-gate manual step.
- **First offline QR:** generating a QR while offline now requires the teacher signing key to
  have been registered once online (or to match the cached session `teacherPublicKey`). This
  prevents queuing an activation the server could never verify; subsequent offline sessions work
  fully offline.
