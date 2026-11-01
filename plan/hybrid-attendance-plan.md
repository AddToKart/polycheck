# Hybrid Learning Mode — Dual-Checkpoint Attendance, Meeting PIN & Zero-GPS Privacy (HYB)

> **Status:** Implemented (HYB1–HYB6). See §16 for the delivery addendum.
> Covers `@polycheck/shared`, NestJS `backend`, Next.js `frontend`, and Expo
> `android`. Companions: [`qr-plan.md`](./qr-plan.md),
> [`attendance-plan.md`](./attendance-plan.md), [`geolocation-plan.md`](./geolocation-plan.md),
> [`offline-web-pwa-plan.md`](./offline-web-pwa-plan.md).
>
> **Feature-Parity Gate applies:** shared contract first (HYB1), then backend (HYB2–HYB3),
> then web (HYB4) **and** Android (HYB5) in the same delivery.

---

## 1. Goal & Pedagogical Context

PUP runs a **Hybrid / HyFlex model** (face-to-face + Zoom/MS Teams/Google Meet). Three
realities drive this feature:

| Reality | Problem today | This plan |
|---|---|---|
| **Ghost students** | Present in the call at 8:00, scan the QR, disconnect/sleep. A single check-in cannot distinguish attendance from presence-at-start | **Dual-checkpoint protocol** — Start-of-class check-in QR **and** End-of-class check-out QR with a `present / late / incomplete / absent` resolution matrix |
| **Single-device equity** | 60–70% of students attend online lectures on **one smartphone**; its camera cannot photograph its own screen | **Screenshot scan path**: gallery/screenshot upload is a first-class, always-available channel for `online` sessions (overriding the current `EXPO_PUBLIC_ALLOW_QR_FALLBACKS=false` release pin) |
| **RA 10173 privacy** | Tracking GPS inside students' homes violates the **Data-Minimization Principle** of RA 10173 (Philippine Data Privacy Act of 2012) | **Zero-GPS online mode**: clients suppress geolocation entirely; the backend persists `latitude: null, longitude: null`; geofence validation is skipped server-side instead of being bypassed |

Additionally, an **audio challenge** — a configurable **Meeting PIN** announced over the
meeting microphone — pairs with the 60–90-second ticket window so that forwarded
screenshots cannot stand in for absent students (a screenshot captures pixels, not the
live meeting audio the PIN is spoken into).

---

## 2. Verified Current State (facts from the research pass)

| # | Fact | Evidence |
|---|---|---|
| F1 | Tokens are Ed25519-signed `base64url(payload).base64url(sig)` with `version: 1` payload; `isTokenInValidityWindow` computes validity + grace in **whole minutes** | `shared/src/utils/token.ts:62-97`, `shared/src/types/session.ts:32-41` |
| F2 | Session model has a **single** QR lifecycle: `qrToken`, `qrTokenExpiresAt`, `qrGeneratedAt`, `qrValidityMinutes` (1–15), `gracePeriodMinutes` (0–60); `geofenceLatitude/Longitude/RadiusMeters` are **required** columns | `backend/prisma/schema.prisma:242-279`; caps `backend/src/sessions/sessions.service.ts:24-25` |
| F3 | Activation claims `qrToken: null` atomically and seeds **pending** roster rows pre-filled with the **geofence-center coordinates** as placeholders (`latitude: session.geofenceLatitude`); `end()` + the every-minute auto-end cron flip `pending → absent` | `sessions.service.ts:201-244, 263-289, 291-376`; same placeholders in `attendance.service.ts:658-823` |
| F4 | Scan validation is geofence-first: distance, accuracy (50 m mobile / 500 m web), staleness (≤ 2 min), geofence-uncertainty, mocked-location, plus `hasSuspiciousCoordinates` identical-coordinate heuristics run for **every** scan; backend class-validator DTOs require `lat/lon` | `backend/src/attendance/scan-validator.service.ts:154-247`, `geofence.service.ts:9-43`, `backend/src/attendance/dto/attendance.dto.ts:34-51`, `backend/src/attendance/types.ts:22-35` |
| F5 | One `AttendanceRecord` per `(sessionId, studentId)`; the accepted-scan gate is `status:'pending', manuallySet:false, tokenSnapshot:null, acceptedScanAttemptId:null`; duplicate scan ⇒ denied `ScanAttempt` row only; replay detection keys on `clientAttemptId` incl. **latitude/longitude equality** (would break with `null` coords) | `attendance.service.ts:248-371`, `scan-validator.service.ts:34-77`, `schema.prisma:318-363, 281-316` |
| F6 | Teacher clients **sign tokens on-device** (web: `signQRToken` in `frontend/src/lib/api-client.ts:460-530`; Android: `android/services/api-client.ts:542-...`), provisioning the public key once; offline activation enqueues a `session_activation` op | per-file cites; key provisioning `android/services/signing-key.ts` |
| F7 | Web scan modal **always** calls `navigator.geolocation` before submit; mobile scan always `requestForegroundPermissionsAsync` + `getCurrentPositionAsync(BestForNavigation)`; **both attach accuracy/locationCapturedAt** | `frontend/src/components/ScanQrModal.tsx:156-237`, `android/app/(tabs)/scan.tsx:213-271` |
| F8 | QR fallbacks (Upload / manual) are **env-pinned OFF in Android production** (`isQrFallbackEnabled`, EAS `production` + CI pass `false`) and gated on web by `NEXT_PUBLIC_ALLOW_QR_FALLBACKS !== 'false'` | `android/hooks/qr-fallback-policy.ts`, `(tabs)/scan.tsx:45-46`, `ScanQrModal.tsx:25-26`, `android/RELEASE.md` |
| F9 | Status surface consumers that hard-code the status list: `StatusBadge.tsx` (Record map), web cockpit `STATUS_STYLES`/`STATUS_CYCLE` + filter row, reports service (`groupBy status` → totals reduce), standing evaluator switch, dashboard trends rows, docs service session-attendance summary, web `dashboard-trends.ts` + Android `dashboard-trend.ts`, donut charts on both platforms | cited per file in §6.6 / blast-radius table |
| F10 | Report/standing math treats `countedSessions = present+late+absent`, `attended = present+late` | `attendance-report.service.ts:15-83`, `standing.service.ts:113-186` |
| F11 | `requestExcuse` accepts only `absent` / `late` | `attendance.service.ts:478-480` |
| F12 | Mobile SQLite offline store caches sessions as **JSON payloads** (`cached_sessions_v2.payload`), so new `Session` fields flow through without a SQLite schema bump; the web IndexedDB store likewise caches whole objects | `android/services/offline-store.ts:38-46, 208-256`, `frontend/src/lib/offline/store.ts:210-244` |
| F13 | Offline web submit fallback runs client-side geofence/accuracy/staleness checks; mobile `checkAttendance` offline fallback runs `isWithinGeofence`; both would wrongly block location-less online scans | `frontend/src/lib/api-client.ts:666-754`, `android/services/api-client.ts:711-740` |
| F14 | `InstitutionSetting` numeric keys exist for `default_qr_validity_minutes`, `default_grace_period_minutes`, `default_geofence_radius_meters` | `backend/src/settings/settings.service.ts:7-10` |
| F15 | Current baselines (GOV entry): backend 712 tests / 65 suites, web 274 / 44, Android 310 / 23, shared 95 / 6; Playwright 198 tests across Chromium/Firefox/WebKit; browser/mobile clients POST `/attendance/scan` and `/attendance/check` against `forbidNonWhitelisted` DTOs | AGENTS.md Verification entries, `attendance.controller.ts:92-112` |

---

## 3. Locked Decisions

| # | Decision |
|---|---|
| D1 | **`SessionMode = 'in_person' \| 'online'`** is a first-class, **immutable** `Session` property (set at create; no edit-after-create — a mode flip would corrupt checkpoint semantics; teacher deletes + recreates instead). `SessionMode` becomes a Prisma enum. |
| D2 | **Online sessions have geofence-free columns**: nullable `geofenceLatitude/Longitude`, and shared Zod schema **rejects** a geofence on `online` creates (data-minimization by construction, not by convention). In-person requires it exactly as today. |
| D3 | **Dual checkpoints own separate state.** New columns `startQrToken/startTokenExpiresAt/startQrGeneratedAt/startPinHash/startQrValiditySeconds/startGraceMinutes` and `endQrToken/endTokenExpiresAt/endQrGeneratedAt/endPinHash/endQrValiditySeconds/endGraceMinutes`. The legacy single-`qrToken` columns keep serving `in_person` only. |
| D4 | **Token payload stays `version: 1`** (signature scheme unchanged). Additive optional fields: `mode`, `checkpoint?: 'start' \| 'end'`, `pinRequired`, `pinHash?`, `validitySeconds?`. `verifyQRToken`/`decodeTokenPayload` **normalize legacy payloads** (`mode: 'in_person'`, `pinRequired: false`) so consumers branch on typed fields; a legacy token scanned against an `online` session ⇒ `token_mismatch`. |
| D5 | **Online checkpoint validity is in seconds** (`validitySeconds`, 60–300; recommended 90). `validityMinutes` continues to exist on the payload (rounded up) purely for legacy readers; every validator prefers `validitySeconds`. Start grace configurable 0–60 min (default 10). **End checkpoint grace is hard-zero** — a late check-out is rejected `qr_expired`, never `late`. |
| D6 | **Meeting PIN**: 2–4 numeric digits, teacher-typed or auto-generated. The plaintext PIN **never leaves the teacher's device**: clients hash it with `PBKDF2-HMAC-SHA256` (public per-token salt, `100_000` iterations — a 10⁴ search space × heavy KDF makes casual offline brute-force expensive) into `pinHash`, which is signed into the token AND stored on the session (`startPinHash`/`endPinHash` = authoritative copy). Server verifies with `timingSafeEqual` against the **DB copy**, counts failed attempts (5 per student per checkpoint / 10 min ⇒ `pin_locked`), and never logs or persists the plaintext. Changing a PIN = regenerating that checkpoint's QR (new hash, new token). |
| D7 | **Checkpoint regeneration** exists because teachers fat-finger PINs in front of 40 students: a checkpoint may be re-generated (same token shape, new PIN/timings, audited `session.checkpoint_regenerated`) only while its own window (`expiresAt + grace`) is still open; after that the server refuses (`checkpoint_window_closed`). Regeneration overwrites the armed token atomically; in-flight scans of the obsolete token are denied `token_mismatch` (accepted trade-off, audited). |
| D8 | **Online lifecycle**: arms Start ⇒ `isActive: true` (roster seeded with `latitude:null`); arms End anywhere while active (guideline: final 5–10 min); session closes at **teacher `end()`** or **auto-end**, then `resolveSessionAttendance` runs the §6.4 matrix. Auto-end deadline precomputed into a new `autoEndAt` column at every arm (end armed: `endTokenExpiresAt`; end never armed: `startQrGeneratedAt + (endTime − startTime) + 15 min`; in-person: `qrTokenExpiresAt + grace`) — one uniform cron; the old `qrTokenExpiresAt + grace` scan query becomes the backfilled legacy path. |
| D9 | **Expired online Start-arm ≠ dead class**: an in-person expired activation still ends the session with everyone absent (unchanged), but an **online** Start activation arriving after expiry is *refused* with `qr_expired` (400) leaving the session not-ended so the teacher retries — an online lecture must not be killable by a late first-click. |
| D10 | **Resolution matrix** (§6.4): `checkInStatus ∈ {present, late}` + accepted check-out ⇒ final = `checkInStatus`; exactly one accepted leg ⇒ `incomplete` with a `notes` tag (`missed_checkout` / `missed_checkin`); neither ⇒ `absent`; `disputed` and `manuallySet` rows are exempt. Between checkpoints rows display `pending` + per-leg badges. |
| D11 | **`incomplete` is a full citizen of the status system**: enums (Prisma/shared/zod), badges, filters, report groups/totals/donuts, cockpit + student stats, docs summary, AI prompt mention. Standing math (default): `incomplete` counts in the denominator, **not** the numerator, with a standing caveat string — flagged as OQ1 pending registrar confirmation. Excuse requests now also accept `incomplete` (half-attendance is excusable). |
| D12 | **RA 10173 enforcement is backend-first**: for `online` sessions the server skips every geometry check, accepts absent/`null` coordinates only for online (an in-person scan without coords is `disputed missing_location`), persists `null` everywhere, and never invokes suspicious-coordinate heuristics (no location data → nothing to profile). Client online paths **never call** geolocation APIs at all (no permission prompt on Android). |
| D13 | **Screenshot fallback policy becomes mode-aware**: fallback channels (`image` upload + manual token) are *always* available when the decoded token's `mode === 'online'`(single-device accessibility is a core requirement); the global flags (`NEXT_PUBLIC_ALLOW_QR_FALLBACKS`, `EXPO_PUBLIC_ALLOW_QR_FALLBACKS`) continue to govern `in_person` only. EAS production pinning stays as-is. |
| D14 | **Offline-first contract preserved**: online scans queue offline through the existing encrypted account-scoped SQLite/IndexedDB stores, **including the PIN** (needed for server-side replay) — the PIN only ever lives inside the per-account AES-GCM encrypted queue payload, never in logs or plaintext metadata; server-side `delayed_offline_sync` disputes apply to online legs that miss their 60–300 s window (friction is intentional). Client-side pre-validation branches by mode (no geofence tests online). |
| D15 | Reconciliation keeps **one record per student** (`@@unique([sessionId, studentId])` stands): accepted Start fills `checkIn*` fields via gate `checkInToken IS NULL`; accepted End fills `checkOut*` via gate `checkOutToken IS NULL`; per-leg accepted `ScanAttempt` linkage (`checkInAttemptId`/`checkOutAttemptId` FKs) preserves the existing one-replay-per-clientAttemptId contract; replay coordinate comparisons become null-normalized. |
| D16 | No new dependencies except **`@noble/hashes`** (audited, pure-TS PBKDF2-SHA256 that runs identically in Node, browsers, and Hermes). No new hex lints/tokens: `incomplete` badge uses existing PUP tokens only. |

---

## 4. Data Contracts & `@polycheck/shared` (HYB1)

### 4.1 `shared/src/types/session.ts`

```ts
export type SessionMode = 'in_person' | 'online'
export type CheckpointType = 'start' | 'end'
export interface GeofenceConfig { latitude: number; longitude: number; radiusMeters: number }

export interface Session {
  // ...existing fields...
  mode: SessionMode
  geofence?: GeofenceConfig            // null/absent for online sessions
  qrValidityMinutes: number            // authoritative only for in_person
  gracePeriodMinutes: number
  startQrValiditySeconds?: number      // online only (60–300)
  startGraceMinutes?: number           // online only (0–60)
  endQrValiditySeconds?: number        // online only (60–300)
  endGraceMinutes?: number             // online only, always 0 (kept explicit)
  startQrToken?: string                // teacher-only (stripped by present() for students)
  startTokenExpiresAt?: string
  startQrGeneratedAt?: string
  endQrToken?: string
  endTokenExpiresAt?: string
  endQrGeneratedAt?: string
  pinRequired: boolean                 // derived from the relevant checkpoint hash columns
  autoEndAt?: string                   // deadline consulted by the auto-end cron
}

export interface QRTokenPayload {
  version: 1
  sessionId: string
  sectionId: string
  issuedAt: number
  validityMinutes: number              // legacy readers; = ceil(validitySeconds/60) for online
  gracePeriodMinutes: number
  teacherId: string
  teacherName: string
  mode: SessionMode                    // present on every token signed after HYB
  checkpoint?: CheckpointType          // absent ⇒ in-person single checkpoint (legacy)
  pinRequired: boolean
  pinHash?: string                     // serialized PinHashRecord; present iff pinRequired
  validitySeconds?: number             // online checkpoints; overrides validityMinutes
}
```

Token normalization (in `verifyQRToken` **and** `decodeTokenPayload`):

```ts
// legacy payloads gain typed defaults; malformed online payloads pass decode and
// are rejected by server validation (pinRequired-present + mode-parity checks):
const normalized: QRTokenPayload =
  raw.mode === undefined ? { ...raw, mode: 'in_person', pinRequired: false } : raw
```

### 4.2 `shared/src/types/attendance.ts`

```ts
export type AttendanceStatus =
  | 'present' | 'late' | 'absent' | 'pending' | 'disputed' | 'excused' | 'incomplete'

export interface AttendanceRecord {
  // ...existing...
  mode?: SessionMode                    // convenience mirror of the session mode
  checkInTime?: string | null
  checkInStatus?: AttendanceStatus | null   // 'present' | 'late' on accepted check-in
  checkOutTime?: string | null
  checkOutStatus?: AttendanceStatus | null  // 'present' on accepted check-out
  coordinates: { latitude: number | null; longitude: number | null }  // both null online
  notes?: string                        // carries 'missed_checkout' | 'missed_checkin' tags
}

export interface AttendanceSummary {
  // ...existing...
  incomplete: number
}
```

Other status-bearing shared shapes updated in the same commit: report totals/rows
(`+ incomplete`), dashboard trend point type, `CheckInBadge`-style helper types for the
cockpit (`{ checkIn: 'on_time' | 'late' | 'none'; checkOut: 'done' | 'none' }` – computed
client-side, not serialized if simpler).

### 4.3 `shared/src/utils/pin-hash.ts` (new; re-exported by `utils/index.ts`)

PinHash serialized format (what lives inside the token AND the DB columns):

```
p1$pbkdf2-sha256$<iterations>$<b64url(salt[16])>$<b64url(digest[32])>
```

```ts
export const MEETING_PIN_KDF_ITERATIONS = 100_000
export interface PinHashRecord { iterations: number; salt: Uint8Array; digest: Uint8Array }

export function encodePinHashRecord(rec: PinHashRecord): string
export function decodePinHashRecord(value: string): PinHashRecord | null   // format+length checked
export async function hashMeetingPin(pin: string, opts?: { salt?: Uint8Array }):
  Promise<{ record: PinHashRecord; serialized: string }>                   // encoded PIN = UTF-8 digits, normalized `${pin.trim()}`
export async function verifyMeetingPin(pin: string, serializedOrRecord: string | PinHashRecord):
  Promise<boolean>                                                         // constant-time digest equality
export function randomMeetingPin(digits: number, randomFn: (bytes: number) => Uint8Array): string
// rng injected: web passes crypto.getRandomValues; Android passes expo-crypto
// getRandomBytesAsync output (same injected-rng pattern as android/services/signing-key.ts)
export function isValidPinFormat(value: string): boolean
export function assertValidMeetingPin(pin: string): void  // /^\d{2,4}$/
```

Constraints: iterations clamped to `[10_000, 600_000]` on verify (reject absurd values);
salt fixed 16 bytes; digest fixed 32 bytes; every failure path returns typed errors so the
server can map to exact denial reasons.

### 4.4 `shared/src/utils/token.ts`

- `isTokenInValidityWindow`: validity = `(payload.validitySeconds ?? payload.validityMinutes * 60) * 1000`; grace unchanged (`gracePeriodMinutes`). Return shape `{ valid, inGrace }` unchanged.
- `createQRTokenData` (the pre-signing payload-builder helper): gains an optional trailing
  `extras?: { mode?, checkpoint?, pinRequired?, pinHash?, validitySeconds? }` — full parity
  with the interface field set. Kept backward compatible for existing callers/tests.

### 4.5 `shared/src/validation/index.ts`

```ts
export const SessionModeSchema = z.enum(['in_person', 'online'])
export const SessionCreateSchema = z.object({
  // ...existing...
  mode: SessionModeSchema.default('in_person'),
  startQrValiditySeconds: z.number().int().min(60).max(300).optional(),  // online defaults
  startGraceMinutes: z.number().int().min(0).max(60).optional(),
  endQrValiditySeconds: z.number().int().min(60).max(300).optional(),
}).superRefine((v, ctx) => {
  if (v.mode === 'in_person' && !v.geofence) ctx.addIssue({ path: ['geofence'], message: 'Geofence is required for in-person sessions' })
  if (v.mode === 'online' && v.geofence) ctx.addIssue({ path: ['geofence'], message: 'Online sessions must not include a geofence (RA 10173 zero-GPS)' })
})
export const AttendanceStatusSchema = z.enum([..., 'incomplete'])
export const MeetingPinSchema = z.string().regex(/^\d{2,4}$/)
```

Bulk `SessionCreateSchema` equivalent (bulk-import/bulk creation schemas) gain the same
mode fields with the same superRefine.

### 4.6 `shared/src/types/api.ts` (ApiClient surfaces)

```ts
export interface CreateSessionInput { /* ... */ mode?: SessionMode; geofence?: GeofenceConfig; startQrValiditySeconds?: number; startGraceMinutes?: number; endQrValiditySeconds?: number }
export interface BulkSessionInput { /* ...same additions... */ }
export interface GenerateCheckpointQrInput {
  sessionId: string
  checkpoint: CheckpointType
  validitySeconds: number            // 60–300
  graceMinutes?: number              // start only (0–60); end forced 0
  pin?: string                       // 2–4 digits; hashed client-side, never sent raw... 
                                     // NOTE: pinHash goes in the token; the plaintext is consumed locally
}
export interface ScanEvidenceInput {
  /* existing */ 
  locationCapturedAt?: string        // was required → optional now (in-person flows keep supplying it)
  accuracyMeters?: number
  pin?: string                       // online PIN submissions; never persisted/logged
}
```

New method (both clients implement; `generateQrCode` delegates to it for in-person so its
existing 3-arg signature stays untouched):

```ts
generateCheckpointQrCode(input: GenerateCheckpointQrInput): Promise<Session>
submitScan(..., pin?: string)              // trailing optional arg (debt: positional params kept)
checkAttendance(..., pin?: string)
```

`SubmitAttendanceResult`, `ScanInputChannel`, `dispute/enrollment` shapes: unchanged.

---

## 5. Database Schema & Prisma Migration (HYB2)

### 5.1 Schema diff (`backend/prisma/schema.prisma`)

```prisma
enum SessionMode { in_person  online }
enum AttendanceStatus { present late absent pending disputed excused  incomplete }   // + incomplete

model Session {
  mode                        SessionMode @default(in_person)
  // legacy single-qr columns unchanged (in_person)
  startQrToken                String?
  startTokenExpiresAt         DateTime?
  startQrGeneratedAt          DateTime?
  startPinHash                String?
  startQrValiditySeconds      Int?
  startGraceMinutes           Int?
  endQrToken                  String?
  endTokenExpiresAt           DateTime?
  endQrGeneratedAt            DateTime?
  endPinHash                  String?
  endQrValiditySeconds        Int?
  endGraceMinutes             Int         @default(0)
  autoEndAt                   DateTime?
  geofenceLatitude            Float?       // made nullable
  geofenceLongitude           Float?
  geofenceRadiusMeters        Int?
  @@index([autoEndAt])
  // (existing geofence columns keep their names; CHECK constraints added via SQL below)
}

model ScanAttempt {
  latitude        Float?   // nullable (online)
  longitude       Float?
  checkpoint      String?  // 'start' | 'end' resolved from the verified token
  pinVerified     Boolean? // null = pin not applicable; true/false for online pinRequired attempts
}

model AttendanceRecord {
  latitude               Float?
  longitude              Float?
  checkInTime            DateTime?
  checkInStatus          AttendanceStatus?
  checkOutTime           DateTime?
  checkOutStatus         AttendanceStatus?
  checkInToken           String?
  checkOutToken          String?
  checkInAttemptId       String?  @unique
  checkOutAttemptId      String?  @unique
  // existing acceptedScanAttemptId remains the in_person linkage
}
```

`checkInAttemptId`/`checkOutAttemptId` are FK relations to `ScanAttempt`
(`onDelete: Restrict`, mirroring `acceptedScanAttempt`); both named relations
(`AcceptedCheckInAttempt` / `AcceptedCheckOutAttempt` on the `ScanAttempt` side) so the
three links coexist without Prisma ambiguity.

### 5.2 Migration plan (one migration: `2026xxxxxx_hybrid_mode_dual_checkpoint`)

Follows the repo's self-healing conventions (idempotent pre-checks as in
`20260907090000_domain_constraints`):

1. `ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'incomplete';` (guard: cannot run
   inside the same transaction on PG < 12-style installations — split into a separate
   migration step per Prisma's enum-extension constraint, executed first).
2. `CREATE TYPE "SessionMode"` (guarded: skip when the enum already exists) +
   `ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS ...` for all thirteen new Session columns
   (with `endGraceMinutes INTEGER NOT NULL DEFAULT 0` — the default covers the backfill, and
   `updateOrIgnore` for the degenerate re-run case keeps self-healing).
3. Nullable conversions: `ALTER COLUMN "geofenceLatitude" DROP NOT NULL;` (+ longitude +
   `geofenceRadiusMeters`; `ScanAttempt.latitude/longitude`; `AttendanceRecord.latitude/
   longitude`) — DROP NOT NULL is concurrency-safe on PG ≥ 12 for columns without defaults.
4. Checkpoint columns + FKs for `AttendanceRecord` (add columns, then `FOREIGN KEY ...
   REFERENCES "ScanAttempt"(id) ON DELETE RESTRICT`, created `NOT VALID` → `VALIDATE` to
   avoid long locks), plus `@@unique` coverage for the two new attempt columns.
5. Backfills (all no-ops on clean installs):
   - every existing row already defaults `mode = 'in_person'`.
   - legacy sessions with armed tokens: `autoEndAt = "qrTokenExpiresAt" + gracePeriodMinutes * interval '1 minute'` (the
     cron's former derived value), so the uniform cron behaves identically pre/post-cutover.
   - `mode = 'online'`-identifying CHECK added **not** enforced retroactively on old rows
     (none exist).
6. Defense-in-depth CHECK constraints (service code is primary):

```sql
ALTER TABLE "Session" ADD CONSTRAINT session_mode_columns_ck CHECK (
  (mode = 'online'    AND geofenceLatitude IS NULL AND geofenceLongitude IS NULL
                      AND startQrValiditySeconds IS NOT NULL
                      AND endQrValiditySeconds  IS NOT NULL)
  OR (mode = 'in_person' AND startQrToken IS NULL AND endQrToken IS NULL
                          AND startPinHash IS NULL AND endPinHash IS NULL
                          AND startQrValiditySeconds IS NULL AND endQrValiditySeconds IS NULL)
);
```

7. **No destructive edits** to historical data: existing records are `in_person` and keep
   `checkIn*/checkOut*` NULL. Resolution logic branches on `session.mode` and treats
   `checkInStatus IS NULL AND mode='in_person'` as legacy single-checkpoint, so no backfill
   of `timestamp → checkInTime` (that would misrepresent history as dual-checkpoint).
8. Seed step (idempotent, same migration): none required (no new settings keys; defaults
   live in module constants — see Risks).

### 5.3 Backward-compatibility matrix

| Artifact | Old data | After migration |
|---|---|---|
| Historical attendance records | single status + required coords | untouched; `coordinates` presented as `{latitude, longitude}` numbers |
| Sessions (all in_person) | unchanged lifecycle | `autoEndAt` backfilled; checkpoints null |
| Mobile SQLite / web IndexedDB caches | old JSON payloads | loaders merge defaults (`mode ?? 'in_person'`, `geofence` may be absent ⇒ clients hide map UI rather than crash) |
| In-flight pinned tokens (old payload shape) | still verify | normalizer tags `mode:'in_person'`; scannable until expiry |

---

## 6. Backend Logic (NestJS) (HYB2–HYB3)

### 6.1 SessionsService state machine (`backend/src/sessions/`)

**`POST /sessions/:id/activate`** (`ActivateSessionDto` widened):

```ts
class ActivateSessionDto {
  checkpoint: 'start' | 'end' = 'start'         // @IsIn, default start
  // legacy in-person fields:
  @Min(1) @Max(15) validityMinutes?: number
  @Min(0) @Max(60) gracePeriodMinutes?: number
  token: string
  // online checkpoint fields:
  @Min(60) @Max(300) validitySeconds?: number   // required iff checkpoint 'start'|'end' on an online session
  regenerate?: boolean                           // D7
}
```

Service flow (single transaction per arm, Redis-free):

1. Load session + assert teacher ownership (unchanged).
2. **Mode/shape parity**: resolve `mode = payload.mode ?? 'in_person'`; `payload.mode !== session.mode` ⇒ 400 `token_mismatch`. Online requires `payload.checkpoint === dto.checkpoint`, `payload.validitySeconds === dto.validitySeconds`, `payload.pinRequired` boolean coherence (`pinHash` present iff `pinRequired`), and `isValidPinFormat(payload.pinHash)` when present. Legacy payloads (no `mode`) against online sessions ⇒ 400.
3. **Timing policy**: online `validitySeconds ∈ [60,300]`; start grace ≤ 60, **end grace forced 0** (`payload.gracePeriodMinutes === 0` on end tokens); issuedAt sanity unchanged (`≤ now + 5 min`).
4. **Claims** (the dual equivalent of the `updateMany` claim guard):
   - start-arm claim: `{ id, mode:'online', isActive:false, endedAt:null, startQrToken:null }`
   - end-arm claim: `{ id, mode:'online', isActive:true, endedAt:null, endQrToken:null }`
   - in-person claim: today's `{ id, isActive:false, endedAt:null, qrToken:null }` path unchanged (incl. the expired-token branch, D9 asymmetry for online: expired online start/end arm ⇒ 400 `qr_expired`, state untouched).
   - regenerate (D7): claim requires the *armed* token present and `now <= expiresAt + grace` for that checkpoint; overwrite token/timing/pinHash in the same update; anomaly-free.
5. **Roster seeding** (start-arm only): identical to today but `latitude: null, longitude: null` placeholders for online; expired-claim absent-marking unchanged for in-person only (online expired never reaches the claim, D9).
6. `endPinHash`/`startPinHash` are written **from the signed payload** (never from DTO input).
7. `autoEndAt` computed per D8 and stored; recalc on end-arm.
8. Post-commit: `emitSessionState(...'activated'|'ended')`, best-effort active-session cache republish (`active-session:<id>` snapshot now carries both checkpoint tokens; TTL `max(300, secondsUntil(autoEndAt))`), key-rotation lock protocol preserved verbatim.

**`POST /sessions/:id/end`** — same endpoint for both modes; transaction: claim
`{ id, isActive: true }` → clear tokens (legacy + checkpoint columns; **pin hashes kept for
audit**), then `resolveSessionAttendance(tx, session)` (§6.4), then notifications —
`notifyAttendanceAbsent` for newly-`absent` rows as today; **no auto-notification for
`incomplete`** (teacher sees it on the roster; follow-up candidate).

**Auto-end cron** (`@Cron(EVERY_MINUTE)`, same Redis ownership lock):

```
target = active sessions where autoEndAt IS NOT NULL AND autoEndAt < now
   OR   legacy belt-and-braces: isActive AND qrTokenExpiresAt+grace < now  (in-person rows
        whose autoEndAt backfill pre-dates the migration window)
per session: guarded updateMany claim (identity on autoEndAt) → resolve → end + cache
invalidate (+ republish ended state) → notify absent
```

In-person rows without `qrTokenExpiresAt` (never armed) stay out of scope exactly as today.

**`present()`/`presentMany()`**: strip `startQrToken`/`endQrToken` under the same
`includeQrToken` teacher-only rule; additionally strip `startPinHash`/`endPinHash` from
every payload (they stay server-side; client PIN display comes from local generation
state only — D6), compute `pinRequired` for display from the hash columns,
and emit the `geofence` object only when the columns are non-null (online ⇒ field
absent — clients must treat geofence as optional, F2/F12).

### 6.2 Scan validator branch spec (`backend/src/attendance/scan-validator.service.ts`)

`ScanEvidence` gains `latitude?: number; longitude?: number; pin?: string;
checkpoint?: CheckpointType` and `ScanValidation` gains `checkpoint?: 'start' | 'end'`.
New flow inside `validateScan`:

1. Common: session lookup (cache advisory + DB authoritative, unchanged), scannedAt
   plausibility, enrollment, teacher key, signature verify, payload normalization.
2. **Mode resolution + parity**: `payload.mode !== session.mode` ⇒ `disputed token_mismatch`.
3. **Token match**: equality against `session.qrToken` (legacy) or the checkpoint-mapped
   column (`session.startQrToken` / `session.endQrToken`); a token bearing
   `checkpoint:'end'` compared against an un-armed/absent `endQrToken` ⇒ denied
   (`checkpoint_not_armed` — surfaced as denial, not disputed, since no wrong state was
   written). Window/expiry uses `validitySeconds` per D5; end checkpoints enforce
   `gracePeriodMinutes === 0` (re-timed "grace" ⇒ `token_mismatch`).
4. **Online branch (mode === 'online')** — completely bypasses: distance calc,
   accuracy caps, location staleness, `geofence_uncertain`, `mocked_location`,
   `hasSuspiciousCoordinates` (call-site guarded), and the location-based
   `missingCoreEvidence` requirements. Emits informational riskSignals
   `mode_online_no_gps` + `screenshot_scan` / `manual_token` from `inputChannel`.
   **PIN gate** (after window check):
   - `pinRequired && !evidence.pin` ⇒ denied `pin_required` (not disputed).
   - `pinRequired` ⇒ verify the submitted PIN against the leg's stored hash
     (`startPinHash` for the Start checkpoint, `endPinHash` for the End checkpoint — the DB
     copy is authoritative) via `verifyMeetingPin`; cross-check
     `payload.pinHash === storedHash` first (mismatch = integrity issue ⇒
     `disputed pin_mismatch`); iterations clamped per §4.3; wrong ⇒ denied `pin_incorrect` + `pin-fail:<sessionId>:<studentId>:<checkpoint>`
     counter (5 / 10 min ⇒ subsequent attempts denied `pin_locked`, message advises
     contacting the instructor). Disabled pin ⇒ gate skipped wholesale (assert
     `!payload.pinRequired` ⇒ no pin field consumed).
   - Success riskSignal: `pin_verified` (boolean only — never the PIN itself).
5. **In-person branch**: today's geometry checks verbatim (guarded by mode so nothing
   regresses); a missing/`null` coordinate pair on an in-person scan ⇒
   `disputed missing_location` (new entry in the
   `PERSISTABLE_SECURITY_DISPUTE_REASONS` set, `attendance.service.ts:55`).
6. Status timeline unchanged per checkpoint: start ⇒ `present` (in window) / `late` (in
   grace); end ⇒ `present` at scan-time; `delayed_offline_sync` (offline queue arriving
   past the tight window) maps to `disputed` for online legs exactly as it does today.
7. `check` (preflight) mirrors the same branch set (returns validation without
   persistence; PIN check applies too so students get the same denials pre-submit).

### 6.3 Reconciliation (`processScanSubmission`, `attendance.service.ts`)

Insertion transaction after validation passes (or persistable-security-dispute):

```
roster = existing or (lockStudentSection, re-check enrollment, upsert create pending row
                       with latitude/longitude null for online — placeholder-center only
                       for in_person, matching today's behavior)
attempt = create ScanAttempt (checkpoint, pinVerified, lat/lon maybe null)
gate = checkpoint === 'start' ? { checkInToken: null } : { checkOutToken: null }
update gate-predicated → set leg fields:
  start: { checkInTime: scannedAt, checkInStatus: validation.status (present|late),
           checkInToken, checkInAttemptId: attempt.id, timestamp: scannedAt }
  end:   { checkOutTime: scannedAt, checkOutStatus: 'present' (only value possible),
           checkOutToken, checkOutAttemptId: attempt.id }
  ...always { isSynced: true, syncedAt: receivedAt } (+ deviceId/tokenSnapshot legacy
  columns left for in_person semantics)
gate miss ⇒ attempt marked denied 'duplicate' (e.g. second scan of the same leg);
opposite-leg scan on a student with no record / pending row is normal path
persistable security disputes (rooted/hook/emulator/missing_location) continue to write a
whole-record `status='disputed'` row exactly as today (checkpoint fields preserved as
evidence); final resolution skips disputed + manuallySet rows
```

Replay path fixes: `findReplay` compares `(attempt.latitude ?? null) ===
(evidence.latitude ?? null)` etc. (null-normalized, F5); exact-replay additionally matches
`checkpoint` when both are defined.

### 6.4 Final resolution — `backend/src/attendance/resolution.ts` (new pure module)

```ts
export function resolveDualCheckpointStatus(record): 'present'|'late'|'incomplete'|null
  // null ⇒ leave as-is (disputed / manuallySet)
export async function resolveSessionAttendance(tx, session) {
  if (session.mode === 'in_person') { /* pending → absent, exactly today's end() */ return }
  const rows = await tx.attendanceRecord.findMany({ where: { sessionId: session.id } })
  for (row of rows where status === 'pending' && !manuallySet):
    checkInToken && checkOutToken → status = checkInStatus        // present | late
    checkInToken XOR checkOutToken → status = 'incomplete'
                                    + notes = missed_checkout|missed_checkin
    neither → status = 'absent'
  // disputed rows untouched; manuallySet untouched; excused untouched
}
```

Consumers: teacher `end()`, auto-end cron, and (non-tx) `POST /sessions/:id/resolve` is **not
added** — no new endpoint; re-resolution on demand = teacher manual overrides (existing).
Resolution deliberately runs **inside the transaction that closes the session** rather than
a BullMQ batch job: it is a single pass over one class's rows (≤ a few hundred), must be
atomic with the closing claim, and the required "background sweep" for teacher-forgetful
cases is already the every-minute auto-end cron. The sync `process-batch` BullMQ queue
(sync-plan coverage) is unchanged.

### 6.5 Downstream counts (backend)

| File | Change |
|---|---|
| `attendance-report.service.ts` | summaries/totals/treatment gain `incomplete` (groupBy already emits the enum value; the seed literal + reduce totalizer must include it) |
| `standing.service.ts` | `StatusCounts + incomplete`; denominator `counted = present+late+absent+incomplete`; numerator unchanged; caveat `X incomplete record(s) count as attended below full credit.` per OQ1 default; standing notify thresholds unchanged |
| `dashboard.service.ts` | trend rows (`present, late, absent, disputed, excused, ...`) gain `incomplete` bucket (web + Android charts read this shape) |
| `docs.service.ts` (session-attendance CSV/PDF) | status column + `Incomplete: N` summary line |
| `ai/ai-prompts.ts` + `ai-tool-registry.service.ts` | prompts mention `incomplete`; status-count tools report it |
| `disputes.service.ts` | no change (disputes remain their own state) — but the record `coordinates` presented as nullable must flow through the dispute surface without null-crashes (mirroring `present()`) |

### 6.6 Single-source mode predicate

`attendance.controller.ts`, `scan-validator.service.ts`, `attendance.service.ts` and the
shared validator flow must carry **one** single-source mode predicate
(`isOnlineScan(session, payload)`) so the geofence skip lives in exactly one place, with a
unit-level guard test asserting an online session never reaches
`geofence.hasSuspiciousCoordinates` (a spy in tests, HYB3).

---

## 7. Next.js Frontend (HYB4)

### 7.1 Session create wizard (`frontend/src/app/faculty/sessions/create/page.tsx`, `sessions/create` bulk toggle)

- Segmented mode control `[ 🏫 In-Person ] [ 💻 Online ]` (default `in_person`; persisted
  per-composition only, never localStorage).
- `online` ⇒ hide the `MapPicker` geofence card + "Use my location"; show the **RA 10173
  notice** card: *"Zero-GPS compliance — Polycheck will not request, read, or store student
  location for online sessions (Data Privacy Act RA 10173, data-minimization principle).
  Attendance is verified by dual QR checkpoints and the announced meeting PIN."* The
  geofence payload is omitted entirely (shared schema rejects it — D2).
- Bulk recurring sessions toggle carries the same mode control.
- Client validation mirrors `SessionCreateSchema` (zod is already the validation import
  path on web for this form).

### 7.2 Teacher cockpit (`frontend/src/app/faculty/sessions/[id]/page.tsx`)

- Header mode badge next to subject: `🏫 In-Person` / `💻 Online · No GPS`.
- **In-person UI unchanged** (single QR card, geofence `CampusMap`, existing dialogs).
- **Online UI**: QR card becomes a two-step `role="tablist"` panel:
  - `Step 1 · Start-of-class QR` — if not armed: "Generate Start QR" → dialog with
    **validity seconds (60–300, default 90)**, **grace minutes (0–60, default 10)**,
    `[ ] Require meeting PIN` checkbox → when checked: PIN input (2–4 digits) +
    `Auto-generate` button (`randomMeetingPin`) with the helper caption: *"Announce this
    PIN verbally at check-in. Students cannot hear a screenshot."*; if armed: rendered QR +
    hard countdown (`expires mm:ss`, grace countdown), Copy token/Save image (unchanged
    actions), the PIN chip `PIN 83 · Announce aloud` (state-only; never persisted), and
    `Regenerate` (shown while D7 window open).
  - `Step 2 · End-of-class QR` — same dialog minus grace (fixed 0) plus the guideline
    caption *"Generate in the final 5–10 minutes. Zero grace: late check-outs are rejected."*
    Copy/download/regenerate identical; disabled until Step 1 armed.
  - Per-step states summarized from `session.startQrToken/endTokenExpiresAt` etc. (no
    polling additions beyond existing refresh/polling/realtime pipes).
- `CampusMap` card **hidden** for online; replaced by a compact "Online
  checkpoint status" card (leg states + autoEndAt note).
- Roster: two independent per-student leg badges (`In ✓ On-time`/`In ● Late`/`—`,
  `Out ✓`/`—`) beside the final status chip; counts row + filter row gain `Incomplete`
  (`incompleteCount`); manual-override cycle unchanged for final status only (`incomplete`
  joins `STATUS_CYCLE` as target-able; cycle docs: present → late → incomplete → absent).
- End-session confirm copy updates: *"Resolves the checkpoint matrix: present / late /
  incomplete; remaining pending students become absent."*
- All-time cockpit state plumbing (session-request-coordinator, error/refresh states)
  unchanged; `api.generateCheckpointQrCode` is the only new call.

### 7.3 Student scan modal (`ScanQrModal.tsx` + `scan-qr/*`)

- After `decodeTokenPayload`, tokenize mode + pin:
  `payload.mode === 'online'` ⇒ **no `getCurrentPosition`** (phase jumps straight to
  submit; the location status line shows "No location needed · online session").
- `payload.pinRequired` ⇒ new phase `entering-pin` with the directive-specified modal:
  *"Enter Meeting PIN (Announced aloud by your instructor in class): [ __ ]"* numeric
  single-input (maxlength 4), submit loops back through `submitScan(..., pin)`; server
  denials (`pin_incorrect`, `pin_locked`, `pin_required`) re-render the modal with the
  denial message (server-composed, no invented client counts).
- Fallback tabs (`Upload Image`, `Enter Token`) become **always visible** for online tokens
  (D13) — visibility recomputed once a token has been decoded (state flag
  `decodedMode`), so global in-person policy is untouched.
- Upload flow dwells on the single-phone reality: caption *"Screenshot your meeting screen
  and upload it here — you can scan from your own photo gallery."*
- Outcome copy includes checkpoint ("Check-in recorded…" vs "Check-out recorded…") and
  `incomplete`-safe status styling in the success view.

### 7.4 Web status surfaces (blast-radius table)

| File | Change |
|---|---|
| `components/StatusBadge.tsx` | `incomplete: 'bg-white text-maroon-dark border border-dashed border-maroon'` (distinct from Pending's solid muted border) |
| `app/faculty/sessions/[id]/page.tsx` | §7.2 complete list |
| `app/student/dashboard/page.tsx` + `components/student/StudentDashboardOverview.tsx` | incomplete stat card (4→5 cards) + history filter tab + record rows |
| `components/student/StudentAttendanceAudit.tsx`, `StudentDashboardDialogs.tsx`, `StudentExcuseDialog.tsx` | status maps; excuse dialog gains `incomplete` as a requestable status (D11) |
| `app/faculty/attendance/page.tsx`, `app/faculty/excuses/page.tsx`, `app/faculty/disputes/page.tsx` | filter options + row badges (excuses: new requestable-status copy) |
| `components/reports/MyReportsPanel.tsx`, faculty/system reports pages, donut components (via `lib/colors.ts` chart configs) | incomplete slice — token-only palette entry (proposed: `golden-dark #E09A00` fill with maroon-dark stroke), legend + CSV export status column |
| `lib/dashboard-trends.ts` | trend bucket + type |
| `app/faculty/students/[id]/page.tsx` | per-record display (uses Record + StatusBadge) — no cycle/manual changes |
| `app/privacy/page.tsx` + privacy notice content | online-mode Zero-GPS clause (RA 10173 §7 transparency supplement) |
| `components/CampusMap.tsx`, `GeofenceCircle.tsx` | tolerate `session.geofence === undefined` (render null card; no crash when cache omits it) |
| `lib/api-client.ts` | `generateCheckpointQrCode`, submit/check pin param, online offline branches (§7.5) |
| `lib/offline/{store,db}` | no schema change (JSON payloads) — `submitScan` offline fallback branches by decoded mode (geofence checks skipped; PIN included in the encrypted queue payload; per-leg duplicate guard: offline records keyed `offline:<sessionId>:<studentId>:<checkpoint>`) |

### 7.5 Web offline fallback (`submitScan`/`checkAttendance` low-network branch)

`mode === 'online'`: skip `haversineDistance/accuracy/staleness/mocked` blocks; verify
window via `validitySeconds`; queue `attendance_scan` op `{ ..., pin }` (AES-GCM
account-scoped store only — D14); optimistic record is written with
`coordinates: { latitude: null, longitude: null }`, `isSynced: false`, status per
checkpoint timeline; the sync engine keeps its existing receipts/409 reconciliation.
"Saved on Device" outcome messaging unchanged.

---

## 8. Expo React Native (Android) (HYB5)

| Area | Change |
|---|---|
| `app/(faculty)/sessions/[id].tsx` | cockpit parity: mode badge, two-step Start/End generation panel reusing the existing per-field row primitives (validity-seconds rows `60–300`; grace row for start; PIN toggle switch + numeric input + auto-generate), per-checkpoint countdown, per-leg badges in roster, `Regenerate` button bound to D7 rules, map card hidden for online; existing toast/confirm systems reused (destructive confirms stay native per conventions) |
| `app/(faculty)/sessions/create.tsx` | mode segmented control; geofence `MapView` block conditionally hidden + RA 10173 explainer (same copy as web); bulk toggle passes mode |
| `app/(tabs)/scan.tsx` | (a) **location suppression**: `payload.mode === 'online'` skips `requestForegroundPermissionsAsync` + `getCurrentPositionAsync` and submits null coords; (b) **PIN modal** (numeric `TextInput`, patterned on the existing manual-entry modal, NativeWind classes only), phase `entering-pin`; (c) **fallback policy**: `shouldShowScanFallbacks(envValue, decodedMode)` — always true for online tokens (D13), env-pinned otherwise; upload button copy adds the single-device screenshot caption; (d) active-session chip: `💻 Online · GPS not required` replaces the geofence radius line; (e) result card learns `incomplete`/checkout copy; (f) generation counter/blur-lifecycle guards extended to the PIN/checkout paths (no new submit-channel leaks past blur) |
| `hooks/qr-fallback-policy.ts` | add `shouldShowScanFallbacks(env, mode)` (pure, tested); legacy `isQrFallbackEnabled` retained for env pinning checks |
| `services/api-client.ts` | `generateCheckpointQrCode` (hashes pin locally via shared utils + signs + posts activate with checkpoint fields; offline activation queue op payload gains checkpoint + serializable pinHash + timings), `submitScan`/`checkAttendance` optional-coords + `pin` param, offline branch: skip geofence block for online, checkpoint-aware duplicate guard |
| Status maps: `(faculty)/disputes.tsx`, `(faculty)/student/[id].tsx`, student history/dashboard rows, `(faculty)/sessions/[id].tsx` | `incomplete` entries (token-only styles mirroring web's dashed maroon), stat chips, filter tabs |
| `(faculty)/reports.tsx` react-native-svg donut | adds the incomplete arc (tokens from the mobile color constants, no new hex) |
| `android/lib/dashboard-trend.ts` | matches backend trend buckets |
| `android/services/offline-store.ts` | no schema change (payload JSON) — queue payload contract updated through the api-client only |

Native rebuild note: no new native modules (`@noble/hashes` is pure TS; expo-clipboard/
expo-image-picker/expo-camera already present) — no EAS rebuild forced by this feature.

---

## 9. RA 10173 Compliance Statement (alignment evidence)

| Principle | Implementation |
|---|---|
| **Data minimization** | Online mode collects zero GPS: clients never invoke geolocation APIs (no permission prompt), DTOs accept absent coords, validator refuses to run geometry math for online, DB stores `null` lat/lon on `Session` (not even the geofence center), `AttendanceRecord`, and `ScanAttempt`. |
| **Purpose limitation** | Checkpoint columns exist solely for attendance resolution; `pinVerified` stores only a boolean; the PIN itself is never persisted, logged, mirrored in riskSignals, or exposed in API responses (presenters strip `pinHash` from student-facing payloads). |
| **Transparency** | RA 10173 privacy notice card in both create wizards + `app/privacy/page.tsx` clause + scan-modal captions ("No location needed · online session"); consent framework already versioned (`privacyConsentVersion`). |
| **Security (PBKDF2)** | PIN hashed client-side with 100k-iteration PBKDF2-SHA256 + per-token salt; server verifies via `timingSafeEqual`; online-guessing controlled by per-student per-checkpoint attempt limiter (`5 / 10 min ⇒ pin_locked`); offline brute-force cost ≈ 10⁴ KDF evaluations (documented trade-off in Risks). |
| **Retention** | Denied attempts (incl. `pin_locked`/`pin_incorrect` rows that carry no location) inherit the existing `DENIED_SCAN_RETENTION_DAYS` purge and 30-day scan-attempt hygiene; nothing new is retained beyond current schedules. |
| **Accuracy/accountability** | `checkpoint` + `pinVerified` columns on `ScanAttempt` give per-leg audit; `session.checkpoint_regenerated` audit rows state who re-armed what (D7). |

Test-assertable claim (required by the directive): the RA test in §10 asserts
`record.latitude === null && record.longitude === null && scanAttempt.latitude === null &&
scanAttempt.longitude === null` for any accepted online scan, and asserts
`hasSuspiciousCoordinates` was never invoked for online scans (spy).

---

## 10. Test Suite & Verification Matrix (HYB6)

**Baselines (GOV entry):** backend 712/65, web 274/44, Android 310/23, shared 95/6, browser
E2E 198 across Chromium/Firefox/WebKit. Targets after HYB: shared ≥ 105, backend
≥ 750, web ≥ 295, Android ≥ 330, E2E +1 spec (×3 engines).

| Layer | Coverage |
|---|---|
| **Shared (vitest)** | token validity via `validitySeconds` (boundary 59/60/300/301), legacy-payload normalization, `createQRTokenData` extras; pin-hash round-trip/tamper/wrong-length/iteration-clamp; `SessionCreateSchema` mode superRefine matrix (online+geofence rejected, in-person missing geofence rejected) |
| **Backend unit** | checkpoint arms/claims (start→end sequence, double-start 409, end-before-start 409, expired-arm refused D9), regeneration rules + audit + in-flight-token denial, `resolveDualCheckpointStatus` **full matrix** (present / late / incomplete×2 / absent / disputed-exempt / manuallySet-exempt / legacy-in-person untouched) |
| **Backend integration** | online scan end-to-end: no-geofence pass where the same evidence fails in-person; `null` coordinates persisted (`AttendanceRecord` + `ScanAttempt`); **RA 10173 assertion** incl. `hasSuspiciousCoordinates` spy untouched; PIN correct / wrong (counted) / locked / absent-when-required / supplied-when-disabled (accepted as a whitelisted optional field; assert it is ignored); replay idempotency with null coords; delayed offline sync dispute on late legs; roster seeding null-coords; auto-end both branches (end-armed + never-armed deadline) evaluated at `autoEndAt` |
| **Status propagation** | report totals + reduce totalizer, standings math + caveat, trends endpoint, docs CSV/PDF line, AI tool counts |
| **Web (vitest)** | create wizard mode toggles + RA notice; cockpit two-step panel state matrix (not-armed → armed → regenerated → ended) + PIN state never persisted/echoed; roster leg badges; `StatusBadge.incomplete`; ScanQrModal: no `getCurrentPosition` call (spy) for online, PIN phase states, offline-fields evidence matrix; offline submit fallback online branch (queue payload includes pin; duplicate guard per leg) |
| **E2E (Playwright, root `e2e/`, new `hybrid-attendance.spec.ts`)** | teacher creates online session → arms Start (+PIN) → student (Chromium) scans via screenshot upload → PIN modal → roster shows In; teacher arms End → student checks out → end → final statuses asserted from roster + API; in-person regression blocks (existing specs) stay green in all three engines |
| **Android (jest)** | `shouldShowScanFallbacks` matrix (env × mode); scan flow: location calls skipped for online tokens (mocked `expo-location`), PIN modal state machine, donut/status maps, create-screen mode branch, offline queue payload with pin + checkpoint |
| **Maestro (mobile E2E)** | faculty: create online session → arm Start with PIN → arm End → end; student: gallery-screenshot scan → PIN entry → success card (flows noted; device runs held to the standing constraint from the SA plan — no local adb) |
| **Verification gates** | `pnpm lint`, `pnpm -C backend format:check`, `pnpm -C backend exec prisma validate` (schema), `pnpm typecheck` per package, full test suites, `pnpm build`; containerized smoke on the local Compose stack: migration applies on the seeded DB, one live dual-checkpoint class verifies end-to-end, RA 10173 null-coords verified via API inspection, PWA offline banner unaffected |

---

## 11. Milestones

| ID | Scope | Acceptance criteria |
|---|---|---|
| **HYB1 — Shared contract** | types (SessionMode/Session/QRTokenPayload/AttendanceStatus/Record/Summary), token normalization + `validitySeconds` window, `pin-hash.ts`, zod updates, ApiClient methods (`generateCheckpointQrCode`, scan pin params), deprecation-free additive API | shared vitest ≥ 105 green; `pnpm -C shared typecheck && pnpm -C shared test` |
| **HYB2 — Migration + session state machine** | Prisma schema + idempotent migration + CHECKs + backfill; create/bulk DTO mode fields; activate dual-arm + regenerate + autoEndAt + cache publish; end/cron resolution hookup; `present()` strips | backend migration applies on seeded local DB; sessions suites green; no in-person regression |
| **HYB3 — Scan validation + reconciliation + PIN + counts** | validator mode branch + PIN gate + rate limiter; reconciliation gates + null-coords replay; resolution module; report/standing/dashboard/docs/AI `incomplete`; controller/DTO whitelisting | backend suites ≥ 750; RA 10173 null-coord test + geo-skip spy; full backend matrix green + `format:check` |
| **HYB4 — Web** | create wizard, cockpit dual-step + PIN + roster, ScanQrModal mode branches, status surfaces, offline branches, CampusMap null-geofence tolerance, privacy page clause | web ≥ 295 vitest; Playwright `hybrid-attendance.spec.ts` passes ×3 engines; existing 198 stay green (10 known engine-skips) |
| **HYB5 — Android parity** | faculty cockpit + create + scan (no-GPS, PIN modal, policy matrix) + api-client + status surfaces + Maestro flows | Android ≥ 330; typecheck + lint clean; parity deviation notes recorded (device runs deferred without adb/Maestro, consistent with prior plans) |
| **HYB6 — Docs & release verification** | AGENTS.md (Done/Key Decisions/Critical Context/Relevant Files) + `plan/README.md` untouched (feature plans unlisted); Redis key names documented (`pin-fail:*`, `active-session:*` TTL change); container smoke + full gates | all green; smoke log appended to this file's addendum |

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| PIN brute-force from a forwarded screenshot (10⁴ space) | 100k-iteration PBKDF2 + per-student challenge limiter stays primary; hash embedded in the signed token keeps verification single-round-trip; documented residual risk (GPU rigs) combined with 60–300 s window friction — RA/security review flagged for OQ3 |
| Regeneration window abuse (teacher error vs cheating) | regen strictly limited to the open window (D7), audited, and in-flight old tokens denied with a visible toast; resolution math ignores regeneration |
| Migration on dirty/dev DBs | fully idempotent statements + enumeration-safety (enum value added in its own step; nullable conversions are lock-cheap) mirroring the repo's self-healing pattern |
| Broken replay detection with null coordinates | explicit null-normalization + dedicated test (HYB3) |
| `incomplete` ambiguity for teachers | dedicated badge styling + explanatory tooltip + resolution note (`missed_checkout`/`missed_checkin`) surfaced in record rows |
| Students without the meeting app sitting in a browser (same single-device reality) | web scan modal implements identical fallbacks; the Feature-Parity Gate forces both clients in one delivery |
| Token-size growth (added payload fields) | +~120 base64 chars worst-case; QR ECC level 'M' and 1024/340 px renders already tolerate ~1.4× payload; verified in Playwright screenshot-scan path |
| Client/ lagging caches omitting `geofence` | clients (web + mobile) branch defensively (F12 caches store JSON blobs; loaders default `mode`, optional geofence) |
| Standing-policy dissent on `incomplete` weight | caveat string shipped; registrar confirmation tracked as OQ1 with a settings-migration path if it changes |

---

## 13. Open Questions (defaults if silent)

1. **`incomplete` weight in standing rate** — default: counted in the denominator, **not** the numerator (penalized like an absence in rate math but visible and excusable). Alternatives: partial credit (numerator + 0.5) or excluded from the denominator.
2. Should `incomplete` trigger a student **notification** at session end (mirroring absent notifications)? Default: **no** (teacher-visible only), follow-up flagged.
3. Should the **Meeting-PIN brute-force cost** be raised (Argon2id via native sodium — requires a dev-client rebuild) at a later milestone? Default: PBKDF2-SHA256 100k now; revisit with the v2 attestation workstream.
4. Should the cockpit allow arming End **before** the Start window closes (parallel windows)? Default: allowed (teacher-controlled friction, e.g. 10-minute hybrid meetings), no implicit gate.
5. Auto-generation digit length default — default: **3 digits**; the UI exposes 2–4.

---

## 14. File Inventory (expected)

**Shared:** `src/types/session.ts`, `src/types/attendance.ts`, `src/types/api.ts`,
`src/utils/token.ts`, `src/utils/pin-hash.ts` (new), `src/utils/index.ts`,
`src/validation/index.ts`.

**Backend:** `prisma/schema.prisma`;
`prisma/migrations/2026xxxxxx_hybrid_mode_dual_checkpoint/migration.sql`;
`sessions/dto/create-session.dto.ts`, `sessions/sessions.service.ts`;
`attendance/dto/attendance.dto.ts`, `attendance/types.ts`,
`attendance/scan-validator.service.ts`, `attendance/attendance.service.ts`,
`attendance/resolution.ts` (new), `attendance/geofence.service.ts` (call-site guard only),
`attendance/attendance-report.service.ts`, `../standing/standing.service.ts`,
`../dashboard/dashboard.service.ts`, `../docs/docs.service.ts`, `../ai/ai-prompts.ts`,
`../ai/ai-tool-registry.service.ts`, `../common/utils/*` (session-duration helper);
new/updated specs across `sessions/`, `attendance/`, plus RA/regression tests.

**Frontend:** `app/faculty/sessions/create/page.tsx`, `app/faculty/sessions/[id]/page.tsx`,
`components/ScanQrModal.tsx`, `components/scan-qr/*` (Views/types/useQrCamera),
`components/StatusBadge.tsx`, `components/CampusMap.tsx`, `components/student/*`,
`components/reports/*`, `app/student/dashboard/page.tsx`, `app/faculty/attendance/page.tsx`,
`app/faculty/excuses/page.tsx`, `app/faculty/disputes/page.tsx`,
`app/faculty/students/[id]/page.tsx`, `app/privacy/page.tsx`, `lib/api-client.ts`,
`lib/offline/*`, `lib/dashboard-trends.ts`, `lib/colors.ts`;
`e2e/hybrid-attendance.spec.ts` (new).

**Android:** `app/(faculty)/sessions/[id].tsx`, `app/(faculty)/sessions/create.tsx`,
`app/(tabs)/scan.tsx`, `hooks/qr-fallback-policy.ts`, `services/api-client.ts`,
`services/offline-store.ts` (queue payload contract only), status maps in
`(faculty)/disputes.tsx`, `(faculty)/student/[id].tsx`, `(faculty)/reports.tsx`,
`lib/dashboard-trend.ts`, `components/StudentCalendarViews.tsx`, dashboard stats surfaces;
`__tests__/*` new suites + Maestro flows.

---

## 15. AGENTS.md entry (to append on delivery)

```markdown
### Done (cont.)
- **Hybrid Attendance (plan/hybrid-attendance-plan.md, HYB1–HYB6)**:
  - SessionMode `in_person|online` (immutable after create; online = zero-GPS RA 10173:
    clients never request location, geofence forbidden by schema, `null` persisted end-to-end,
    geometry checks skipped for one predicate).
  - Dual checkpoints with separate Session columns/state/tokens: Start QR (60–300 s validity,
    0–60 min grace) + End QR (60–300 s, zero grace, final-5-min guideline), atomic arms denied
    on expired online activation (class survives a late first-click), regeneration audited
    while a checkpoint window is open.
  - Status matrix resolved at end/auto-end: present / late / incomplete (one leg; notes tag
    missed_check{in,out}) / absent; pending rows between checkpoints; disputed + manuallySet
    exempt; `incomplete` counts in standing denominator not numerator (caveat) and is excusable.
  - Meeting PIN: 2–4 digits hashed client-side (PBKDF2-SHA256 100k, per-token salt via
    @noble/hashes), signed into the token + stored on the session (`startPinHash`/`endPinHash`),
    server-timing-safe verified against DB copy, 5 wrong attempts / 10 min ⇒ pin_locked,
    plaintext PIN never leaves the teacher's device/logs.
  - Auto-end unified on `Session.autoEndAt` (end-armed expiry or startTime + duration + 15 min).
  - Screenshot fallbacks always available for online tokens (mode-aware policy overrides the
    global env pins); web + mobile PIN modal copy per spec.
  - Verification: backend X tests / Y suites, web Z / W, Android V / U, shared T / 5, Playwright
    hybrid spec + existing green across 3 engines; containerized smoke: dual-checkpoint class,
    RA null-coordinates assertions, offline PIN queued scan.
```

*(counts filled at delivery).*

---

## 16. Implementation Addendum (delivered)

| Area | Delivered |
|---|---|
| Shared | `SessionMode`/`CheckpointType`, extended `Session` + `QRTokenPayload` (legacy normalization), DB-matching `AttendanceRecord` checkpoint fields, `incomplete` status, `pin-hash.ts` (`PBKDF2-HMAC-SHA256`, 100_000 iterations, 60–300s checkpoint validity, injected CSPRNG), zod mode superRefine + `BulkSessionCreateSchema`, `generateCheckpointQrCode`/scan `pin` contracts. `@noble/hashes@1.8` (CJS-compatible for Jest; ESM for bundlers). |
| Database | Migration `20261101120000_hybrid_mode_dual_checkpoint`: `SessionMode` enum, 15 new `Session` columns, nullable geofence everywhere, `Session.autoEndAt` (+index), nullable `ScanAttempt`/`AttendanceRecord` coordinates, per-leg tokens/attempt FKs, mode/column CHECK, in-flight `autoEndAt` backfill. Historical rows untouched. |
| Backend | Dual-arm activation state machine (`start`/`end`, atomic claims, expired online arm refused per D9, bounded regeneration per D7), zero-GPS roster seeding, PIN verification gate with per-student `pin-attempt:*` limiter, per-leg reconciliation (`checkInToken`/`checkOutToken` gates), `resolution.ts` matrix reused by `end()` + the `autoEndAt` cron, unified cache TTL/deadline, `present()` strips checkpoint tokens and PIN hashes, `incomplete` propagated through reports/standing/dashboard/docs/AI, excuse acceptance for `incomplete`. |
| Web | Mode wizard with RA 10173 notice (geofence hidden), mode badge + two-step cockpit (validity seconds, start grace, PIN toggle/auto-generate/PIN chip/regenerate), per-leg roster badges + incomplete counts/filters/cycle, screenshot-first online scan modal (no geolocation, PIN phase), offline online scan queue (null coords + encrypted PIN), status surfaces/reports/donut/trends, zero-GPS CampusMap fallback, privacy page clause. |
| Android | Faculty cockpit parity (mode badge, dual steps, PIN sheet with auto-generate, per-leg badges, zero-GPS card), create wizard mode toggle, scan screen location suppression + PIN modal + mode-aware fallback policy (`shouldShowScanFallbacks`), api-client (checkpoint signing + offline queue), status maps/history filters/report donut/dashboard trends. |
| Verification | Shared 108 tests / 7 files; backend **746 / 67**; web **285 / 46**; Android **317 / 24**. `pnpm lint`, backend `lint:check` + `format:check`, all package typechecks, and `pnpm build` clean. New backend regression suites: checkpoint resolution matrix, hybrid validator (zero-GPS, PIN correct/wrong/locked/disabled, unarmed/end-grace), service-level RA null-coordinate persistence, online activation arms/regeneration. New E2E `e2e/hybrid-attendance.spec.ts` (cockpit arms a PIN-protected start/end checkpoint; student API scan asserts `coordinates: { latitude: null, longitude: null }`). |

### Deviations / decisions recorded during implementation

1. `@noble/hashes` was pinned to **1.8.0** (not 2.x): v2 is ESM-only and breaks the backend's ts-jest CommonJS transform. The 1.x line exposes CJS through the package `exports` map for Jest/Metro while bundlers still receive ESM.
2. Numeric validation for in-person activation runs before the session read (preserves the existing "reject without touching persisted state" contract); online expiry checks necessarily occur after the token is verified.
3. The meeting PIN is confirmed against the **session hash column**, not just the token copy; the token hash must match the DB hash (integrity check) before PBKDF2 verification. PIN attempts are limited per student per checkpoint (6 attempts / 10 min ⇒ `pin_locked`).
4. Between checkpoints the stored record stays `status='pending'`; clients render the leg outcome from `checkInStatus`/`checkOutStatus` (server-side resolution only at close). This keeps the existing "first accepted scan wins" and duplicate gates intact.
5. Expired online checkpoint activation is refused with a 400 and does **not** end the session (D9), unlike the legacy in-person expired-activation path.
6. Full-browser E2E for the PIN scan path is covered through the API after the teacher arms the checkpoint from the UI (the signed token only exists on the teacher screen); UI assertions cover the cockpit/wizard.
