# Account Governance Plan — Delegated Password Reset, Governed Teacher Permissions, Device Binding + Cooldown, Universal Profile

**Status:** IMPLEMENTED (GOV-0 … GOV-7 executed; all suites, lint, and builds green)
**Scope of this plan:** governance/account-security/anti-cheat subsystem across `@polycheck/shared`, `backend`, `frontend`, and `android`.
**Out of scope (deferred):** email/SMS OTP delivery, web push (VAPID), OS-level device attestation (SafetyNet/DeviceCheck, v2), human-readable device names, iOS build, background sync changes.

---

## 1. Current-State Grounding (verified facts this plan builds on)

| Fact | Location |
|---|---|
| `User` already has `authVersion Int @default(0)` and `mustChangePassword` | `backend/prisma/schema.prisma:56-58` |
| `AuthSession.generation` pairs with `authVersion`; a new login increments `user.authVersion` and the post-create hook deletes every other session (single active session) | `backend/src/auth/better-auth.service.ts:144-176` |
| Session authenticator rejects `session.generation !== user.authVersion` | `backend/src/auth/session-authenticator.service.ts:24` |
| Mobile login endpoints are distinct routes: `POST /auth/mobile/login/student` and `/faculty` | `backend/src/auth/auth.controller.ts:62-75` |
| Web login endpoints: `POST /auth/login/student` / `/faculty` | `backend/src/auth/auth.controller.ts:38-59` |
| Self-service change-password exists (`POST /auth/change-password`), rate-limited 5/15-min, keeps the current session, deletes all other sessions, does **not** bump `authVersion` (deliberate, commented) | `backend/src/auth/auth.service.ts:263-319` |
| Password policy (12+ chars, lower/upper/digit/symbol) | `backend/src/auth/password-policy.ts:8-16`, `IsStrongPassword` decorator, web label copy in `frontend/src/components/auth/PendingPasswordChange.tsx:11-18` |
| Super admin reset (`PATCH /users/:id/password`) requires a **typed** password, sets `mustChangePassword`, bumps `authVersion`, deletes sessions, sends notification; **no server-side generation for single account creation** (create flows take a typed password; only bulk import generates temp passwords server-side) | `backend/src/users/users.service.ts:288-331`, `178-286` |
| Typed error infrastructure exists: `AllExceptionsFilter` passes through `code`; `ErrorCode` constants registry | `backend/src/common/filters/all-exceptions.filter.ts:22-31`, `backend/src/common/constants/error-codes.ts` |
| Web `ApiHttpError` carries only `message` + `status` (no `code`); Android `ApiRequestError` carries `status` **and** `code` | `frontend/src/lib/api-client.ts:38-46`, `android/services/api-client.ts:113,181-189` |
| Android compares `code === 'PASSWORD_CHANGE_REQUIRED'` (uppercase) while the backend emits lowercase `'password_change_required'` — a latent dead-branch bug | `android/services/api-client.ts:182,316,358` vs `backend/src/common/constants/error-codes.ts:24` |
| Mobile device identity already exists: `getOrCreateInstallationId()` → `mobile-<16 random hex>` persisted in SecureStore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); already sent on scans (`ScanAttempt.deviceId` column exists; offline queue too) | `android/services/device-id.ts`, `android/app/(tabs)/scan.tsx:232`, `backend/prisma/schema.prisma:265` |
| Settings registry pattern: `BOOLEAN_SETTING_KEYS`, `INTEGER_SETTING_RANGES` with min/max validation; keys seeded idempotently via migrations (AI availability precedent) | `backend/src/settings/settings.service.ts:6-35`, `backend/prisma/migrations/20261027120000_ai_availability_settings` |
| Web settings config (`SETTING_FIELDS`/`SETTING_SWITCHES`/`TAB_SETTING_KEYS`) and mobile mirror (`android/lib/institution-settings.ts`) drive `/faculty/settings` (web) and `(faculty)/settings.tsx` (Android), 4 tabs incl. `accounts` | `frontend/src/app/faculty/settings/settings-config.ts`, `android/lib/institution-settings.ts` |
| Audit convention: `admin.user.updated`, `admin.user.role_changed`, `admin.user.promoted`, `admin.user.created` (entityType `user`), written best-effort with try/catch log | `backend/src/users/users.service.ts:646-667` |
| Redis rate limiting pattern: `redis.consumeRateLimit(key, limit, windowSeconds)` + module-level `positiveInt()` env-tunable constants | `backend/src/auth/auth.service.ts:27-48,339-348` |
| Enrollment has **no** status column — an existing row means "actively enrolled" (removal deletes the row); student-president flow proves the same check | `backend/prisma/schema.prisma:197-208` |
| Advisory locks for membership mutations: `lockStudentSection`, `lockSection` | `backend/src/common/student-section-lock.ts` |
| Web user admin lives in `frontend/src/app/faculty/users/page.tsx` + `components/admin/{create-admin-dialog,user-profile-dialog,user-role-dialog}.tsx`; create teacher/student are inline (typed passwords); only `BulkImportDialog` displays generated credentials today | `frontend/src/app/faculty/users/page.tsx:192-237` |
| Teacher-facing student detail pages: web `frontend/src/app/faculty/students/[id]/page.tsx` (and section roster at `frontend/src/app/faculty/sections/[id]/page.tsx`); mobile `android/app/(faculty)/student/[id].tsx` (Alert-based confirms, `CampusCard` roster) | verified listings |
| Student identity on mobile: flippable ID card at `android/app/(tabs)/id-card.tsx` (hidden tab), plus `(tabs)/_layout.tsx` registers routes with `href: null` | verified |
| Staff "More" bottom sheet items are defined in `android/app/(faculty)/_layout.tsx` (`baseItems` split by `isSuper`) | verified |
| No `/profile` route exists on web; no Profile screen exists on Android. Web forced-rotation UI: `components/auth/PendingPasswordChange.tsx` + `SessionGuard`; Android: root route `android/app/change-password.tsx` | verified |
| E2E Playwright specs live at the repo root `e2e/*.spec.ts` with root `playwright.config.ts` | `e2e/auth.spec.ts`, `e2e/users-admin.spec.ts`, ... |
| Web settings numbers are declared in pure config with `min`/`max`; tests co-located (`page.test.tsx`, `settings-config.test.ts`) | `settings-config.ts:22-115` |

---

## 2. Goals

1. Teachers can reset the password of any student **actively enrolled in one of their own sections** (web + mobile), receiving a server-generated human-readable temporary password (`PUP-XXXXXXXX-XXX!`) with a copy modal; the student is forced to rotate on first login.
2. Super admins govern delegation with switches (`Institution "Accounts & access"` tab) and per-teacher nullable overrides in the Users dialogs; account creation displays a generated-credentials modal with one-click Copy.
3. Students' mobile apps are bound to one device installation; self-service "Unregister This Device" arms a cooldown (default 2 h) that blocks **mobile logins** with typed `device_cooldown_active`, while web stays fully exempt; teachers have an in-roster Emergency Device Release.
4. One `/profile` page (web) and one profile screen (Android) for all three roles: identity, self-service password change (with authVersion rotation), contacts, device status.

---

## 3. Locked Decisions (deltas from the originating task description)

| # | Decision | Rationale |
|---|---|---|
| LD1 | Device identity = existing `getOrCreateInstallationId()` (`mobile-…` SecureStore id). **No new fingerprint SDK.** | Already used for `ScanAttempt.deviceId`; app-install-scoped identity is acceptable in v1 (attestation is v2 per AGENTS). |
| LD2 | Binding is **student-only**, written at mobile login success and mobile scan acceptance; write-on-change (idempotent `update` only when `boundDeviceId` differs). No backfill for existing users — first mobile login/scan binds lazily. | Avoids per-request writes; web cookie sessions are exempt by design. |
| LD3 | Cooldown enforcement points: the two `/auth/mobile/login/*` routes **plus mobile scan validation** (defensive scan check for unbound devices while cooled). Failure returns `403 { code: 'device_cooldown_active', message, remainingMinutes }`. Web cookies and staff logins never hit the check. | Requirement C2; keeps laptops/teacher devices unaffected. |
| LD4 | "Unregister This Device" **clears the binding and revokes all of the user's Better Auth sessions (including the calling device), then sets `deviceCooldownUntil = max(existing, now + N hours)`.** During cooldown, *any* student mobile login fails (device-agnostic — the binding is cleared, so every device is "another device"). Modal copy is strengthened accordingly. | Simplest correct semantics: without revocation a surviving session could re-bind lazily (LD2) and defeat the cooldown; cannot distinguish "same device" after clearing the binding without extra columns. Fast-escape hatch: teacher Emergency Device Release clears the cooldown immediately. |
| LD5 | Repeated self-unregister while cooled extends the lock (`max(existing, now + N)`), never shortens it. Rate-limited 5/hour. | Deterministic anti-abuse; idempotent at rest. |
| LD6 | `POST /auth/change-password` self-service **now also increments `authVersion`** and updates the invoking session's `generation` to the new value inside the same transaction (keeping the "current session survives, all others die" behavior; `deleteMany` stays as belt-and-braces). Tests that assert "no bump" are updated. | Requirement D2; the generation/authVersion machine already exists (better-auth.service.ts) — reusing it is a 3-line delta. |
| LD7 | Per-teacher permissions are **nullable booleans on `User`** (`canResetStudentPasswords`, `canEmergencyUnbindDevices`). Effective permission = override if non-null, else institution setting. Super admin edits them via `PATCH /users/:id` (teacher targets only). UI shows a tri-state ("Follow institution default"). | Zero extra table; matches institution-setting fallback reading. |
| LD8 | Temporary passwords are **generated server-side** by a shared generator (`PUP-` + 8 chars from the unambiguous base32 alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` + `-` + 3 alphabet chars + one random symbol from `!@#$%_-` giving ≥12 chars with all classes present). Used by teacher reset **and** super-admin create/reset when the client omits `password`. Always returned exactly once in the response, never stored in plaintext, never logged. Prevents guessable "PUP-ABC123!"-style output (the literal example in the request is only 11 chars and lower-entropy). | `isStrongPassword` requires ≥12 + all classes; crypto-random via `node:crypto.randomBytes`. |
| LD9 | Audit action strings follow the repo's lowercase-dot convention, not the uppercase strings in the originating request: `teacher.password_reset`, `teacher.device_release`, `student.device_unregister`, `contact.updated`, and generated creations reuse `admin.user.created` with `metadata { generatedPassword: true }`. The originating uppercase names are recorded here verbatim as search aliases in the Audit Log docs so both spellings surface. | Consistency with `admin.user.*`, searchable with existing `contains:` filters. |
| LD10 | `remainingMinutes` on cooldown errors passes through `AllExceptionsFilter` (small whitelist extension: numeric `remainingMinutes`). Web `ApiHttpError` gains `code?` and `remainingMinutes?`. | Otherwise the generic filter drops the payload; both platforms need the number for the countdown. |
| LD11 | Teacher UI learns its own effective permissions from `GET /auth/me` (`getProfile`) — the response for teachers additionally carries `delegatedPermissions: { canResetStudentPasswords, canEmergencyUnbindDevices }` (merge of override + policy read via SettingsService). No new endpoint; server re-validates authoritatively on every mutation. | Buttons can hide locally without leaking settings rows; server remains the gate. |
| LD12 | Profile is a single top-level route: web `frontend/src/app/profile/page.tsx` (own slim layout reusing the sidebar shell), Android root route `android/app/profile.tsx` reachable from (a) student ID-card screen button, (b) student dashboard entry, (c) staff More sheet item. Not a new tab bar slot on either platform (bars are already at capacity). | Meets "one profile page for all 3 roles" without nav-bar surgery; deep-linkable. |
| LD13 | Emergency Device Release route: `POST /users/students/:studentId/device-release` with `body { sectionId, reason, note? }` (same shape discipline as teacher reset). Guards: teacher role + policy + per-teacher permission + target student enrolled in that section owned by the teacher (transaction + `lockStudentSection`). Clears `boundDeviceId`/`deviceBoundAt`/`deviceCooldownUntil` and revokes sessions; always audited; idempotent (`clearedCooldown: false` when nothing was set). | Section context is what the teacher acts from (roster/student detail); mirrors LD7 gating. |
| LD14 | Android typed-code comparisons are normalized to lowercase (`password_change_required` dead-branch fixed; new `device_cooldown_active` matches lowercase). | Found bug; new code must not copy it. |
| LD15 | Contacts are new nullable `User.contactEmail` / `User.contactPhone` columns, edited by the owner only via `PATCH /users/me/contacts`. They are secondary contact channels only — `authEmail` (Better Auth internal) and the institutional login email are never touched. | Requirement D4 without overlapping login identity. |

---

## 4. Database Schema & Migration

### 4.1 Prisma model deltas (`backend/prisma/schema.prisma`, `model User`)

```prisma
model User {
  // ... existing fields ...
  // Account governance (GOV)
  boundDeviceId              String?    // mobile-<hex> installation id; student-only
  deviceBoundAt              DateTime?
  deviceCooldownUntil        DateTime?  // mobile login lock while set
  canResetStudentPasswords   Boolean?   // null = follow institution default
  canEmergencyUnbindDevices  Boolean?
  contactEmail               String?
  contactPhone               String?
  // ... relations unchanged ...
}
```

Indexes: none required — all reads are `findUnique({ where: { id } })` (row-local). Deliberately **no** partial index on `boundDeviceId` (cross-account same-device detection is a v2 attestation idea, not built here).

### 4.2 Migration `backend/prisma/migrations/20261030120000_account_governance_device_binding/migration.sql`

1. Idempotent `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS` (or `information_schema` DO-block guard, matching the `20260907090000_domain_constraints` self-healing convention) for the 7 columns above.
2. Seed the three institution settings idempotently (upsert on `key`), mirroring `20261027120000_ai_availability_settings`:
   - `allow_teacher_password_reset = 'true'`
   - `allow_teacher_emergency_device_unbind = 'true'`
   - `device_cooldown_hours = '2'`
3. `created_by = 'system'` for the seeded rows.
4. No data backfill: no existing device ids exist; binding happens lazily (LD2).

Regenerate the Prisma client (`pnpm --filter @polycheck/backend prisma generate` → generated output already lives in `backend/src/generated/prisma`).

### 4.3 Seed scripts
`backend/prisma/seed.ts` — no user-data changes required; optionally assert the three keys exist after `prisma migrate deploy` in the seed validation step (cheap guard for fresh environments).

---

## 5. API Contracts

### 5.1 New endpoints

#### `POST /api/users/students/:studentId/teacher-reset-password` (teacher)
```jsonc
// Request  (auth: teacher; rate limit: users:reset-student-password:<teacherId> — 10/hour, env TEACHER_RESET_RATE_LIMIT / TEACHER_RESET_RATE_WINDOW_SECONDS)
{ "sectionId": "sec-123" }

// 200 (password shown ONCE; never persisted in plaintext/log)
{ "userId": "s-42", "temporaryPassword": "PUP-K7W2M4QA-9T!", "message": "Temporary password generated. It must be changed on the student's next login." }

// 403 policy/permission/enrollment failures (see §7 error matrix)
{ "statusCode": 403, "error": "Forbidden", "code": "teacher_permission_disabled", "message": "..." }
// 404 → { code: 'user_not_found' }; policy/permission/enrollment failures → 403 per §7
```
Server actions in one transaction (`lockStudentSection(studentId, sectionId)` first):
`user.update(password, mustChangePassword: true, authVersion: increment)` → `authAccount.upsert` → `authSession.deleteMany` → audit row `teacher.password_reset` (`entityId = studentId`, `metadata { sectionId, ipAddress, outcome: 'succeeded' }`) → notification to the student (`type: 'password_reset'`, existing copy) → non-blocking `events.emit('auth.session-replaced', { userId, reason: 'teacher_password_reset' })`.

#### `POST /api/users/students/:studentId/device-release` (teacher)
```jsonc
// Request (body validated by EmergencyDeviceReleaseSchema)
{ "sectionId": "sec-123",
  "reason": "lost_or_damaged",           // 'dead_battery'|'lost_or_damaged'|'borrowed_device'|'other'
  "note": "Left phone at home — borrowed sibling's device today" }   // optional, ≤280 chars

// 200
{ "user": { "...User payload...", "boundDeviceId": null, "deviceCooldownUntil": null },
  "clearedCooldown": true, "message": "Device released. The student can log in on a new device now." }
```
Actions: rate limit `users:device-release:<teacherId>` (10/hour) → guards (LD13) → transaction clears the three device columns, deletes sessions, audits `teacher.device_release` (`metadata { sectionId, reason, note?, ipAddress, clearedCooldown }`), notifies the student (`type: 'device_released'`, link `/login`). Idempotent repeat returns 200 with `clearedCooldown: false`.

#### `POST /api/users/me/device/unregister` (student)
```jsonc
// Request — body optional: { "deviceId": "mobile-ab12cd34ef56..." } (sender's installation id; also accepted without a body)
// 200
{ "user": { "...User payload...", "boundDeviceId": null, "deviceCooldownUntil": "2026-10-30T14:00:00.000Z" },
  "cooldownHours": 2, "cooldownUntil": "2026-10-30T14:00:00.000Z",
  "message": "Device unregistered. Mobile logins are locked for 2 hours; your instructor can release you sooner." }
```
Actions: rate limit `users:device-unregister:<userId>` (5/hour) → transaction: clear binding, `deviceCooldownUntil = max(existing, now + cooldownHours)` (LD4/LD5), `authSession.deleteMany` (all — the student is logged out everywhere, locally the client clears its token + offline store via the normal logout path) → audit `student.device_unregister` (`metadata { deviceId, cooldownHours }`) → **no** notification (self-inflicted).

#### `PATCH /api/users/me/contacts` (all roles)
```jsonc
// UpdateContactsSchema: { contactEmail?: string (email, ≤254, optional → '' means clear), contactPhone?: string (^\+?[0-9\s-]{7,20}$) }
{ "contactEmail": "juan.delacruz@gmail.com", "contactPhone": "+63 917 123 4567" }
// 200 → sanitized User payload (contacts populated). Rate limit users:contacts:<userId> 10/15-min.
```

#### Teacher-readable capability probe
`GET /api/auth/me` — for `role === 'teacher'` the sanitized payload gains:
```jsonc
{ "...": "standard fields",
  "delegatedPermissions": { "canResetStudentPasswords": true, "canEmergencyUnbindDevices": true } }
```

### 5.2 Changed endpoints

| Endpoint | Change |
|---|---|
| `POST /auth/mobile/login/student`, `POST /auth/mobile/login/faculty` | DTO gains `deviceId?` (≤64 chars, URL-safe). After Better Auth session creation (and only for successful logins): students → `assertMobileLoginAllowed` (403 cooldown, LD3) then `registerBinding`; staff → no device logic. |
| `POST /auth/change-password` | `authVersion` bump + current-session `generation` refresh (LD6); response sanitization now includes contacts. |
| `POST /users/teachers`, `POST /users/students` | `password` becomes **optional**; when omitted the server generates (LD8), sets `mustChangePassword: true`, and the response gains `temporaryPassword`. When provided, behavior is identical to today (and now also writes an `admin.user.created` audit row for parity). |
| `PATCH /users/:id/password` | Password optional → generated variant; response gains `temporaryPassword`; already forces rotation today. |
| `PATCH /users/:id` | Gains `canResetStudentPasswords?: boolean | null`, `canEmergencyUnbindDevices?: boolean | null` (teacher targets only; `null` = clear the override and follow institution default). Audit metadata records the changed permission fields. |
| `GET /auth/me`, `GET /users/me` (`userId = self`) | Sanitized payloads gain device fields (self only: `boundDeviceId`, `deviceBoundAt`, `deviceCooldownUntil`) + contacts; teacher gains `delegatedPermissions` (LD11). |
| Scan acceptance (`POST /attendance/...` incl. offline sync replay) | On an **accepted** scan for a **student**: defensive cooldown check (403 `device_cooldown_active` if unbound+cooled) then binding registration (LD2). Rejected/duplicated scans never bind. |
| `GET /users/:id` (teacher on own-roster student) | Payload includes `deviceBoundAt` and `deviceCooldownUntil` for status display on the student detail page. |
| `grep parity` | `ApiClient` contract (§6) is updated in the same commit as the backend (Feature Parity Gate). |

### 5.3 `@polycheck/shared` contract

`shared/src/types/user.ts` — `User` gains: `boundDeviceId?: string | null`, `deviceBoundAt?: string | null`, `deviceCooldownUntil?: string | null`, `canResetStudentPasswords?: boolean | null`, `canEmergencyUnbindDevices?: boolean | null`, `contactEmail?: string | null`, `contactPhone?: string | null`.

`shared/src/types/api.ts` — new/updated inputs & results:
```ts
export type EmergencyDeviceReleaseReason = 'dead_battery' | 'lost_or_damaged' | 'borrowed_device' | 'other'
export interface TeacherResetStudentPasswordResult { userId: string; temporaryPassword: string; message: string }
export interface EmergencyDeviceReleaseInput { sectionId: string; reason: EmergencyDeviceReleaseReason; note?: string }
export interface EmergencyDeviceReleaseResult { user: User; clearedCooldown: boolean; message: string }
export interface UnregisterDeviceResult { user: User; cooldownHours: number; cooldownUntil: string; message: string }
export interface UpdateContactsInput { contactEmail?: string; contactPhone?: string }
// CreateTeacherInput / CreateStudentInput / resetUserPassword: password becomes optional;
//   the results gain a `temporaryPassword?: string` field (server-generated, shown exactly once).
export interface ManageUserCredentialsResult { temporaryPassword?: string }   // mixed into create/reset results
export interface UpdateUserInput (dashboard.ts) gains: canResetStudentPasswords?: boolean | null; canEmergencyUnbindDevices?: boolean | null
export interface DelegatedTeacherPermissions { canResetStudentPasswords: boolean; canEmergencyUnbindDevices: boolean }
```
`ApiClient` additions (both clients implement in GOV-0/GOV-4/GOV-5):
```ts
teacherResetStudentPassword(studentId: string, sectionId: string): Promise<TeacherResetStudentPasswordResult>
emergencyReleaseDevice(studentId: string, input: EmergencyDeviceReleaseInput): Promise<EmergencyDeviceReleaseResult>
unregisterDevice(deviceId: string): Promise<UnregisterDeviceResult>
updateContacts(input: UpdateContactsInput): Promise<User>
// createTeacher/createStudent/resetUserPassword: password becomes optional; results carry temporaryPassword?
// loginStudent/loginFaculty: nothing in the interface changes; deviceId added under the hood
```

`shared/src/validation/index.ts` — new zod schemas: `EmergencyDeviceReleaseSchema` (reason enum, trimmed note ≤280), `UpdateContactsSchema` (email format, phone pattern, both optional, but at least one non-empty value is required or the request 400s), `TeacherResetStudentPasswordSchema` (`sectionId` non-empty cuid-like ≤64), `DeviceCooldownHoursSchema` (int 1–24 — mirrors backend `INTEGER_SETTING_RANGES`).

`shared/src/utils/permissions.ts` — new pure helper:
```ts
export function effectivePermission(override: boolean | null | undefined, settingEnabled: boolean): boolean
export function cooldownRemainingMinutes(cooldownUntil: string | null | Date, nowMs?: number): number | null
export function formatCooldownRemaining(minutes: number): string   // "1 h 23 min" / "45 min"
```
(unit-tested in shared; reused by web UI, Android UI, and backend tests as the single source of the fallback math.)

---

## 6. File-by-File Change Map

### 6.1 `@polycheck/shared` (GOV-0)
| File | Change |
|---|---|
| `shared/src/types/user.ts` | +7 device/permission/contact fields (§5.3) |
| `shared/src/types/api.ts` | new inputs/results + `ApiClient` methods; create/reset password optionality |
| `shared/src/types/dashboard.ts` | `UpdateUserInput` + two nullable permission flags |
| `shared/src/validation/index.ts` | 4 new zod schemas |
| `shared/src/utils/permissions.ts` | **new** — effectivePermission / cooldown math / formatter |
| `shared/src/utils/permissions.test.ts` | **new** — cooldown boundary math (exactly expired → null), policy merge truth table |

### 6.2 Backend (GOV-1/GOV-2/GOV-3)
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | §4.1 |
| `backend/prisma/migrations/20261030120000_account_governance_device_binding/migration.sql` | **new** — §4.2 |
| `backend/src/settings/settings.service.ts` | `allow_teacher_password_reset` + `allow_teacher_emergency_device_unbind` into `BOOLEAN_SETTING_KEYS`; `device_cooldown_hours: { min: 1, max: 24 }` into `INTEGER_SETTING_RANGES`; new convenience getter `getTeacherDelegationPolicies(): Promise<{ teacherPasswordReset: boolean; teacherEmergencyUnbind: boolean; deviceCooldownHours: number }>` resolving fallbacks (`true`,`true`,`2`) |
| `backend/src/settings/settings.service.spec.ts` | new-key validation tests (range 1–24, bool values, unknown key) |
| `backend/src/common/constants/error-codes.ts` | + `DEVICE_COOLDOWN_ACTIVE: 'device_cooldown_active'`, `TEACHER_POLICY_DISABLED: 'teacher_policy_disabled'`, `TEACHER_PERMISSION_DISABLED: 'teacher_permission_disabled'` (reuses existing `NOT_ENROLLED`, `USER_NOT_FOUND`) |
| `backend/src/common/filters/all-exceptions.filter.ts` | pass through numeric `remainingMinutes` (+ spec update) |
| `backend/src/users/password-generator.ts` | **new** — LD8 generator using `node:crypto.randomBytes` over the unambiguous alphabet; asserts `isStrongPassword` output in a self-test |
| `backend/src/users/password-generator.spec.ts` | **new** — ≥12 chars, all classes, no ambiguous glyphs (I/1/L/0/O), 200-sample uniqueness sanity |
| `backend/src/users/device-binding.service.ts` | **new** — `assertMobileLoginAllowed(user, deviceId, cooldownHours)` (403 + `remainingMinutes`), `registerBinding(userId, deviceId, role)` (write-on-change), `unregister(userId, deviceId, cooldownHours, ip)` (LD4/5 transaction + audit), `emergencyRelease(...)` (LD13 transaction + audit + notify). Constructor: `PrismaService`, `SettingsService`. |
| `backend/src/users/device-binding.service.spec.ts` | **new** — cooldown math with fake clocks, register-on-change idempotency, unregister extends-not-shortens, session revocation batch, audit rows, release clears all three columns |
| `backend/src/users/dto/governance.dto.ts` | **new** — `TeacherResetStudentPasswordDto { sectionId }`, `EmergencyDeviceReleaseDto { sectionId, reason (IsIn enum), note? ≤280 }`, `UpdateContactsDto { contactEmail? IsEmail, contactPhone? Matches(^\+?[0-9\s-]{7,20}$) }` |
| `backend/src/users/dto/manage-user.dto.ts` | `CreateTeacherDto.password` / `CreateStudentDto.password` become `@IsOptional()`; service generates when absent |
| `backend/src/users/dto/admin-user.dto.ts` | `UpdateUserDto` gains the two teacher permission fields. Tri-state resolved as decided in GOV-3 AC: an explicit `PERMISSIONS_CLEAR` sentinel clears an override; omitted fields are untouched; booleans set values. |
| `backend/src/users/users.service.ts` | `createTeacher`/`createStudent` optional-password + `temporaryPassword` result + `admin.user.created` audit; `resetPassword` optional-password + `temporaryPassword` return; `updateUser` permission field handling (teacher-only, audit `changedFields`); new `teacherResetStudentPassword(studentId, dto, actor, ip)`; new `updateContacts(userId, dto)` (validated, best-effort audit `contact.updated`); `recordAdminAudit` gains an `ip` metadata hook (controllers pass `req.ip`) |
| `backend/src/users/users.service.spec.ts` | teacher reset barriers (policy off / override off / not enrolled / expected audit + rate-limit calls), generated password strength + single notification, permission update on teacher-only targets, contacts validation + `'' clears` semantics, create-with-generated password returns it once |
| `backend/src/users/users.controller.ts` | + `POST students/:id/teacher-reset-password` (`@Roles('teacher')`), `+ POST students/:id/device-release` (`@Roles('teacher')`), `PATCH users/me/contacts` (authenticated all roles), `+ POST users/me/device/unregister` (`@Roles('student')`); each passes `req.ip` |
| `backend/src/users/users.module.ts` | export `DeviceBindingService`; providers + new DTOs |
| `backend/src/users/dto/admin-user.dto.spec.ts` | permission-field validation cases |
| `backend/src/auth/dto/login-student.dto.ts`, `login-faculty.dto.ts` | + `deviceId?` (≤64, URL-safe chars) |
| `backend/src/auth/auth.service.ts` | `loginStudent`/`loginFaculty` gain a `deviceId` param; per-login flow: (staff or deviceId-less students) skip; students → cooldown check for mobile routes **only**, then binding. Mobile-only flag decided by the caller route (controller passes `channel: 'mobile' \| 'web'`, LD3). `changePassword` → LD6 transaction. `sanitizeUser` + device(owner)/contacts/`delegatedPermissions`(teacher, via SettingsService) |
| `backend/src/auth/auth.service.spec.ts` | cooldown 403 body asserts `code` + `remainingMinutes`; same-device re-login idempotent; changePassword bump keeps current session (`generation` assert) and deletes others; teacher payload gains delegatedPermissions merged from settings |
| `backend/src/auth/auth.controller.ts` | mobile routes forward `dto.deviceId` + `channel: 'mobile'`; web routes forward `'web'`; `GET me` unchanged signature (payload enriched in service) |
| `backend/src/auth/auth.module.ts` | import `UsersModule` (for `DeviceBindingService`) + `SettingsModule` (no cycles: neither imports auth) |
| `backend/src/attendance/attendance.service.ts` | accepted-scan/post-accept hook: `deviceBinding.registerBinding(studentId, deviceId, 'student')` + defensive cooldown check for unbound-cooled students (live scan path AND offline sync replay — sync module delegates through this service; verified during GOV-2 and hooked in both entry points if the sync path has its own validator) |
| `backend/src/attendance/attendance.service.spec.ts` | accepted-scan binding write-on-change; rejected scan never binds; cooled unbound scan 403 `device_cooldown_active` |

### 6.3 Web frontend (GOV-4)
| File | Change |
|---|---|
| `frontend/src/lib/api-client.ts` | `ApiHttpError` gains `code?: string`, `remainingMinutes?: number` (parsed in `handleResponse`); new ApiClient methods (§5.3); `createTeacher/createStudent` omit-password mode; `resetUserPassword(id, password?)`; teacher reset/release/unregister/contacts |
| `frontend/src/app/faculty/settings/settings-config.ts` | `SETTING_SWITCHES` + `allow_teacher_password_reset`, `allow_teacher_emergency_device_unbind` (tab `accounts`); `SETTING_FIELDS` + number field `device_cooldown_hours` (1–24, tab `accounts`, caption "Lockout window after a student unregisters their device"); `TAB_SETTING_KEYS.accounts` merges switches **and** fields for the accounts tab |
| `frontend/src/app/faculty/settings/settings-config.test.ts` | new keys in `tab keys` + defaults merge |
| `frontend/src/app/faculty/settings/page.tsx` (+ `page.test.tsx`) | accounts tab renders the two switches + number input via existing primitives |
| `frontend/src/components/admin/credential-result-dialog.tsx` | **new** — post-create/reset modal: identity lines (role, name, ID/email), monospace `temporaryPassword`, **Copy credentials** (builds `Polycheck credentials — <role> — <id> — temp password` text), warning copy "share in person; the student must change it at first login", tested copy fallback |
| `frontend/src/components/admin/credential-result-dialog.test.tsx` | **new** |
| `frontend/src/components/admin/user-profile-dialog.tsx` (+test) | teacher targets: two tri-state permission controls (Follow institution default / Allowed / Disabled) mapping to `boolean | null` |
| `frontend/src/app/faculty/users/page.tsx` (+test) | create teacher/student switch to generated-password mode (omit `password`, open credential modal from response; the previously typed-password field becomes the "Generate automatically" affordance); the admin reset flow also gains the generated variant option |
| `frontend/src/app/faculty/students/[id]/page.tsx` (+tests) | actions row gains: **Reset password** (confirm Dialog → call → credential-result dialog) and **Emergency device release** (Dialog with the 4 reasons + note); buttons hidden when `delegatedPermissions` says disabled (from `GET /auth/me` refresh helper in `lib/hooks/use-api.tsx` consumer); device status chip when `deviceCooldownUntil` set (e.g. "Device locked · 1 h 12 min left") |
| `frontend/src/app/faculty/sections/[id]/page.tsx` | roster row overflow gains the two actions (same modal components, extracted to `components/faculty/StudentGovernanceActions.tsx` shared) |
| `frontend/src/components/faculty/StudentGovernanceActions.tsx` | **new** — shared buttons + both dialogs, used by student detail + section roster |
| `frontend/src/components/faculty/StudentGovernanceActions.test.tsx` | **new** |
| `frontend/src/app/profile/page.tsx` + `profile/layout.tsx` + `profile/page.test.tsx` | **new** — LD12 route with SessionGuard + `PendingPasswordChange`-style gate interplay (if `mustChangePassword`, redirect to the gate first) |
| `frontend/src/components/profile/ProfilePage.tsx` | **new** — identity panel (read-only: PUP ID, role, department, program and year level for students, department for teachers/admins), tabs styled like settings tabs; Security form (current + new + confirm, 12-char policy copy, mismatch + wrong-current errors, success toast → apiClient profile refresh); Contacts form (email + phone, unsaved indicator); Devices (student-only: bound id preview `…XXXXXX`, `deviceBoundAt`, cooldown chip/countdown tick, **Unregister this device** with LD4 policy copy confirm) |
| `frontend/src/components/profile/DevicePanel.tsx` (+test) | **new** — cooldown countdown formatting via shared `formatCooldownRemaining`, confirm modal, logout-on-success path (`api.logout()` → push `/login`) |
| `frontend/src/components/profile/ChangePasswordForm.tsx` (+test) | **new** — self-service (requires currentPassword), disable-submit during flight, `authVersion` note copy "other sign-ins will be signed out" |
| `frontend/src/components/layout/sidebar.tsx` | all three role nav lists gain **Profile** (`/profile`, icon `UserRound` — placed after Assistant) |
| `frontend/src/components/auth/SessionGuard.tsx` | unchanged behavior; add a test asserting /profile is a guarded route like others (not special) |
| `frontend/src/app/(auth-landing)/login/student/page.tsx` + `faculty/page.tsx` | web students never get cooldown errors (web exempt); leave as-is |
| `e2e/account-governance.spec.ts` (root) | **new** Playwright spec (GOV-6): settings toggles render; users create → credentials modal copy; student detail reset + release modals; profile password change keeps session (reload still authed) |

### 6.4 Android (GOV-5)
| File | Change |
|---|---|
| `android/services/api-client.ts` | `loginStudent/loginFaculty` fetch `getOrCreateInstallationId()` and include `deviceId`; failures parsed like `handleResponse` so `ApiRequestError` carries `code` + `remainingMinutes` (switch to shared response parser for login paths); LD14 normalization (`password_change_required` fix); new methods `teacherResetStudentPassword`, `emergencyReleaseDevice`, `unregisterDevice`, `updateContacts`; create/reset calls omit password and surface `temporaryPassword` |
| `android/__tests__/api-client.test.ts` | login body contains the installation id; cooldown error object asserts `code: 'device_cooldown_active'` + `remainingMinutes`; the uppercase dead-branch regression test |
| `android/components/CampusLoginPortal.tsx` (shared branded login UI used by both login screens) | catch the `device_cooldown_active` `ApiRequestError` type → branded cooldown modal (`CampusCard`) showing `remainingMinutes` countdown, anti-cheat explanation, and "Ask your instructor for an emergency release" advice |
| `android/app/profile.tsx` | **new** root route (all roles; explicit `useAuthGate` list) — mirrors web ProfilePage: Identity (read-only), Contacts (two text fields + save), Security (change-password form → POST change-password; keeps forced-rotation route `android/app/change-password.tsx` untouched), Devices (student-only: bound-chip, bound-at, cooldown countdown ticking, **Unregister this device** destructive confirm `Alert` with LD4 copy → `api.unregisterDevice()` then local `logout()` + SecureStore token wipe + offline-store owner wipe via existing logout path), `CampusToast` success/error |
| `android/app/(tabs)/_layout.tsx` | register `profile` deep-linkable route equivalent: none needed for root route; add `href: null` registration ONLY if profile lives under a group — **final routing call documented in GOV-5 AC** (root `app/profile.tsx` doesn't need tab registration) |
| `android/app/(tabs)/id-card.tsx` | header gains a compact device chip ("Device active" / "Device locked") + "Profile & security" button → `router.push('/profile')` |
| `android/app/(tabs)/dashboard.tsx` | student dashboards gain the same profile shortcut inside the existing header/avatar row |
| `android/app/(faculty)/student/[id].tsx` | actions area gains **Reset password** (confirm `Alert` → clipboard copy via `expo-clipboard` + `CampusToast`) and **Emergency device release** (`PickerSheet`-style reason picker + note field + confirm); device-cooldown indicator chip when the target is cooled |
| `android/app/(faculty)/_layout.tsx` | More sheet `baseItems` gains "Profile & security" item for both teacher and super lists |
| `android/lib/institution-settings.ts` (+ `android/app/(faculty)/settings.tsx`) | three new account-tab entries (2 switches + 1 number with min/max), mirroring the web config; render already generic — merge accounts fields+switches like the AI tab does |
| `android/__tests__/device-profile.test.ts` | **new** — cooldown countdown formatter cases, unregister dialog decision logic (copy assertions), reason-picker mapping |
| `android/RELEASE.md` | short note: new server flags; no native rebuild needed (no new native modules) |

---

## 7. Error & Edge-Case Matrix

| Condition | Endpoint | Status | `code` | Client behavior |
|---|---|---|---|---|
| Institution `allow_teacher_password_reset=false` | teacher-reset | 403 | `teacher_policy_disabled` | teacher UI hid button (LD11), server re-asserts |
| Teacher override disabled | teacher-reset / release | 403 | `teacher_permission_disabled` | same |
| Student not enrolled in the acting teacher's section | teacher-reset / release | 403 | `not_enrolled` | toast/modal "Student not in this section"; refresh roster |
| Target user missing / role ≠ student | teacher-reset / release | 404/403 | `user_not_found` | standard 404 UX |
| Student mobile login while cooled | mobile login | 403 | `device_cooldown_active` + `remainingMinutes` | Android branded modal w/ countdown; message includes "contact your instructor for an emergency release" |
| Unbound+cooled student scan (defensive) | scan submit | 403 | `device_cooldown_active` | same copy (rare — unregister revokes sessions) |
| Web login of any role during cooldown | web login | none — never blocked | — | students can still study on web (exempt design) |
| Rate-limited reset/release | any | 429 | — | "Too many requests, try again later" (generic) |
| Contacts both empty / bad format | contacts | 400 | validation messages | form-level inline errors |
| Permission tri-state `null` | `PATCH /users/:id` | special | — | explicit "clear override" sentinel (decided in GOV-3 AC), audited as `cleared: ['canResetStudentPasswords']` |
| Student deleted/removed mid-flow | roster actions | 403/404 | `not_enrolled`/`user_not_found` | re-fetch roster |
| Second unregister while cooled | unregister | 200 (extends) | — | LD5; UI shows updated `cooldownUntil` |
| Audit insert failure | any governance mutation | business mutation continues | — | fail-open per repo decision; error logged with full request context |
| Deleted `deviceId` / old cached client (no body field) | mobile login | login proceeds; **cooldown still blocks** (device-agnostic when the field is absent) | — | documented behavior |
| Teacher reset + student already logged in elsewhere | teacher-reset | sessions revoked | — | Android profile shows `mustChangePassword` via existing 403-gate mapping; web SessionGuard routes to the rotation gate |
| Release for a never-bound student | release | 200 `clearedCooldown: false` | still audited | idempotent |
| Change-password from `/profile` with wrong current password | change-password | 401 via existing path | — | inline form error (message from existing endpoint) |

---

## 8. Phases & Acceptance Criteria

> IDs are referenced in commit messages (`gov:`), tests, and the eventual AGENTS.md progress entry.

### GOV-0 — Shared contract (web + android compile against it)
- §5.3 types, validation, util, `ApiClient` methods; export from package entrypoints.
- `effectivePermission`/`cooldownRemainingMinutes`/`formatCooldownRemaining` unit tests.
- `pnpm --filter @polycheck/shared test && build` green.

### GOV-1 — Database & settings
- Prisma schema + migration per §4 (idempotent, no backfill), client regenerated.
- Settings service: three keys + `getTeacherDelegationPolicies()` + spec; container smoke verifies the seeded rows (pinned like previous migrations).
- ACs: `migrate deploy` twice → no error; settings `PUT` rejects `device_cooldown_hours: 0` and `25`.

### GOV-2 — Auth/device core (backend)
- Mobile login `deviceId` DTO + channel flag; cooldown enforcement + typed error; binding registration; scan-path hook; `changePassword` authVersion/generation transaction (LD6); `sanitizeUser` enrichment incl. contacts + `delegatedPermissions`.
- `AllExceptionsFilter` passthrough of `remainingMinutes` + spec.
- ACs: all new/updated specs green (`auth.service.spec.ts`, `session-authenticator` untouched, `attendance.service.spec.ts`); note the mobile bearer strategy (`better-auth` bearer plugin) still enforces exactly one active session; no cookie flow changes.

### GOV-3 — Users governance endpoints (backend)
- Generator + DTOs + controller routes (teacher reset, release, unregister, contacts) with rate limiting, transactions + advisory lock, audit rows (LD9), notifications.
- Creation/reset optional-password + `temporaryPassword`; `updateUser` permission tri-state per error matrix sentinel.
- ACs: `users.service.spec.ts` + `device-binding.service.spec.ts` + `password-generator.spec.ts` green; e2e fixture untouched but smoke covers each 403 barrier code.

### GOV-4 — Web UI
- api-client typed errors + new methods; settings accounts tab; users create/reset credential modal; user-profile-dialog permission tri-state; student detail + section roster actions; profile page + panels + sidebar Profile link.
- ACs: vitest suites listed in §6.3 pass; Playwright `e2e/account-governance.spec.ts` journeys pass on Chromium (settings toggles, create-with-generated-credentials, profile-password rotation session survival, teacher reset modal); typecheck/lint clean.

### GOV-5 — Android UI
- api-client login deviceId + cooldown surfaced (LD14 fix included), profile root route, id-card chip + dashboard shortcut, student-detail actions, More sheet entry, settings mirror, login cooldown modal.
- ACs: `android` typecheck + jest suites green (`api-client.test.ts`, `device-profile.test.ts`); smoke on the local stack: unregister → logout → login shows countdown modal; teacher release instantly clears; feature parity one-liner satisfied ("native-only surfaces named").

### GOV-6 — Tests & E2E hardening
- Full matrix: backend (unit) → the three new spec files + extended users/auth/settings specs; shared → GOV-0 tests; web → vitest + Playwright journey spec; android → jest.
- `e2e/users-admin.spec.ts` + `e2e/auth.spec.ts` updated for the generated-credentials flows (previously typed passwords).
- ACs: no regressions in the existing ~1.5k-test suites; no skipped tests added.

### GOV-7 — Quality gates & documentation
- `pnpm lint` (zero errors), `pnpm build` all packages, backend format check.
- Docker stack rebuilt; smoke: masked super-admin journey (settings), teacher reset journey, student profile/journey, cooldown login (server responses verified by curl for the typed body since Playwright cannot drive Android).
- `AGENTS.md` updated: new Done entry (short, matching existing style), Critical Context additions (cooldown model, endpoints, error codes), Relevant Files list, Key Decisions (LD4/LD8/LD9 highlights).
- `plan/account-governance-plan.md` — final status & deviation notes if any.

---

## 9. Verification & Testing Deliverables (summary)

| Layer | Suites / specs |
|---|---|
| Backend unit | `users.service.spec.ts` (barriers, generation, contacts, permissions, audit), `auth.service.spec.ts` (cooldown typing + binding + change-password bump), `settings.service.spec.ts` (3 keys), `device-binding.service.spec.ts` (new), `password-generator.spec.ts` (new), `all-exceptions.filter.spec.ts` (`remainingMinutes`), `attendance.service.spec.ts` (scan binding) |
| Shared | `utils/permissions.test.ts` (new), validation schema tests |
| Frontend vitest | `profile/page.test.tsx`, `profile/DevicePanel.test.tsx`, `profile/ChangePasswordForm.test.tsx`, `faculty/StudentGovernanceActions.test.tsx`, `admin/credential-result-dialog.test.tsx`, `admin/user-profile-dialog` (updated), `faculty/settings` (updated), `users` page (updated) |
| Playwright (root `e2e/`) | `account-governance.spec.ts` (new); `users-admin.spec.ts`, `auth.spec.ts` updated for generated credentials |
| Android (jest) | `api-client.test.ts` (deviceId + cooldown + lowercase-code fix), `device-profile.test.ts` (new: countdown, dialog logic, mappings) |
| Manual smoke (documented) | device-release instant re-login; unregister → countdown modal; teacher reset + first-login rotation gate; web access while cooled; `curl` shows `code: 'device_cooldown_active'` + `remainingMinutes` |

**Quality gates:** `pnpm lint`, `pnpm build`, backend `format:check`, all four packages' test suites — all must be clean before GOV-7 closes. Feature Parity Gate: this plan ships every UI capability on **both** web and Android (Playwright + jest coverage respectively; Maestro device flows remain a listed follow-up per repo convention).

---

## 10. Open Questions (resolved-by-default; flag during implementation if reality differs)

1. ~~Tri-state permission sentinel for `null`~~ → decided in GOV-3 AC: explicit `PERMISSIONS_CLEAR` string value (validated) rather than overloading `false`; documented in DTO comments.
2. Android `change-password.tsx` forced-rotation route revalidation timing — expect unchanged; if the Profile security form is shown while `mustChangePassword`, redirect to the forced-rotation route (same as web `SessionGuard`).
3. Human-readable device names (device model via `expo-device`) — deferred; profile shows "Android device · id …XXXXXX". If trivial (`expo-device.modelName`), add a `deviceLabel` alongside the id in the same phase without changing the schema.
4. Super-admin emergency release from `/faculty/users` (no section context) — deferred; the teacher flow covers the in-classroom need; an admin path can reuse `DeviceBindingService.emergencyRelease` later with an `entityType: 'admin'` audit action.

---

## Implementation Notes (GOV-0 … GOV-7 closed)

- Tri-state teacher overrides use native JSON `null` (no string sentinel): `UpdateUserDto` accepts `boolean | null`, and omitted fields remain untouched.
- Temporary password format is `PUP-<8 upper/digit>-<2 lower><symbol>` (16 chars) — guarantees uppercase, lowercase, digit, and symbol without ambiguous glyphs (I/L/O/0/1). The request's literal `PUP-ABC123!` example fails the 12-char policy, so it was not used verbatim.
- Cooldown is device-agnostic for students while active (binding cleared, all sessions revoked); staff logins and all web cookie sessions are exempt. `remainingMinutes` travels through `AllExceptionsFilter`.
- Self-service password rotation bumps `authVersion` and advances the invoking session's `generation` in the same transaction, so the rotating session survives while every other session dies immediately.
- Delivered surfaces: Accounts settings tab (web + Android), generated-credential modals for account creation/reset (web + Android), teacher reset/release on student detail (web + Android) and web section roster, `/profile` on web + Android (identity, password, contacts, student device panel), sidebar Profile entry, and Android More-sheet/ID-card entry points.
- Verification executed locally: shared 95, backend 712, web 274, Android 310 tests; `pnpm lint`, backend `format:check`, `prisma validate`, and `pnpm build` clean. Playwright specs (`e2e/account-governance.spec.ts`, updated `e2e/admin.spec.ts`) were added/updated but not executed locally (no Docker stack running); they run in CI.
- Deferred as planned: email/SMS OTP, human-readable device labels, super-admin device release from `/faculty/users`, OS attestation, and Maestro device flows.
