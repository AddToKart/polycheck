# Campus Designations & Maintenance Mode Plan — PUP Santa Maria dual-hat faculty + institutional maintenance subsystem

**Status:** IMPLEMENTED (DH-0 … MT-4 executed; suites/lint/format/builds green; Docker stack rebuilt and E2E-verified — see the implementation notes at the end)
**Directive references:** `AGENTS.md` progress log; `plan/super-admin-console-plan.md` (SA1–SA7); `plan/account-governance-plan.md` (GOV); `plan/institution-settings-plan.md` (IS1–IS5); `plan/hybrid-attendance-plan.md` (HYB1–HYB6); `plan/system-reports-plan.md` (SR)
**Scope:** `@polycheck/shared`, `backend` (NestJS), `frontend` (Next.js web), `android` (Expo RN).
**Compatibility bar:** zero regressions across the existing monorepo suites — as of the latest recorded state this is **1,469+ unit tests** (shared 108 / backend 754 / web 285 / Android 322) plus the Playwright E2E matrix (92 passed / 3 skipped on Chromium, 64/10/0 Firefox and WebKit). The directive's "1,126+" figure predates the AI/settings/wave-4/hybrid waves; this plan targets the current counts and every newer number recorded in `AGENTS.md`.

---

## 1. Context & Institutional Rationale

PUP Santa Maria Branch faculty hold **Concurrent Administrative Designations** (the CHED/SUC "dual-hat" model): an IT professor is also the campus **IT Coordinator / MIS Officer**, a mathematics professor is also the **Department Chairperson**, and the campus registrar's designated staff member administers accounts. Forcing second accounts (`bry.prof@` vs `bry.admin@`) splits identity, breaks Better Auth's student-only single-session model for staff (staff already hold concurrent sessions by design), and produces audit noise under two actor IDs.

This plan therefore keeps **one identity, one `role: 'teacher'`, plus additive administrative designations** — while enforcing **Separation of Duties (SoD)** that today's monolithic `super_admin` cannot express:

- IT Sysadmins (IT Coordinator) must **not** approve academic excuse letters.
- Academic Chairs (Department Head) must **not** toggle server maintenance.
- Registrars (User Admin) must **not** read server telemetry or excuse queues beyond their registrar duties.

Three designations are introduced, mirroring the three existing super-admin-only suites:

| Designation | Suite | Flag | Web surfaces | Backend surfaces |
|---|---|---|---|---|
| 🛠️ IT Operations | IT Operations Suite | `isItCoordinator` | `/faculty/server-status`, `/faculty/system-reports` (SR triage), `/faculty/settings` (System tab) | `GET /dashboard/server-status`, `server:subscribe`, SR admin routes, maintenance settings PUT |
| 🎓 Academic Oversight | Academic Department Oversight | `isDepartmentHead` | `/faculty/reports` (department reports + exports), `/faculty/excuses` (campus queue), `/faculty/at-risk` (new) | `GET /attendance/report`, `GET /attendance/excuses`, `POST /attendance/records/:id/excuse/decision`, `GET /attendance/at-risk` — department-scoped |
| 📋 User Administration | Registrar Suite | `isUserRegistrar` | `/faculty/users` (scoped console) | user CRUD, password resets, status, bulk CSV imports — department-scoped |

**Dedicated Super Admins (Branch Director) remain root over all three suites** and are unchanged; the existing super-admin web nav, Android tab bar, and E2E super-admin expectations must **not** drift (a standing Playwright journey asserts the exact super-admin sidebar item list, and SA1 removed classroom feeds from it on purpose).

Plus the paired **Institutional Maintenance Mode** subsystem (§MT below): a global, Redis-cached, settings-driven 503 shield that exempts super admins and IT coordinators and keeps `/health/*` probes open for Docker/Coolify/Cloudflare.

### Non-goals / out of scope

- No new login flows, roles, or `UserRole` values. `role` stays `'super_admin' | 'teacher' | 'student'`; designations are additive booleans.
- No change to SA1 "Option A" (super admins keep deep-link access to classroom resources; no proactive console feeds).
- No change to single-active-session policy (students still replace sessions; staff concurrency unchanged — `backend/src/auth/session-policy.ts`).
- No auto-off timer for maintenance mode (`maintenance_until` is an *estimate* surfaced in UI, never a kill switch — see MT-LD6).
- No device-attestation / audit-log UI changes beyond the audit actions this plan adds.
- No mobile import file picker, no web push — those remain separate fast-follows recorded in AGENTS.md.

---

## 2. Locked Decisions

### Dual-hat designations (DH)

| # | Decision |
|---|---|
| DH-LD1 | Designations live on `User` as three booleans defaulted `false`: `isItCoordinator`, `isDepartmentHead`, `isUserRegistrar`. They are meaningful **only for `teacher` accounts**; assigning them to students is rejected (`400 designation_teacher_only`-shaped message), and super admins implicitly hold **all three suites** without carrying the flags. Client helpers (`canAccessItOperations` etc.) compute `role === 'super_admin' || flag === true`, so the seed data never needs to stamp flags on the Branch Director's account. |
| DH-LD2 | `RequestUser` (backend principal, `backend/src/auth/authenticated-principal.ts`) gains the three required booleans, resolved through the Better Auth `additionalFields` declared in `better-auth.service.ts` (the session already carries `role/scope/department/isActive/authVersion/...` — no second DB round-trip). `SessionAuthenticator` maps them into the principal. Crucially, `disableCookieCache: true` already forces a DB-backed session read per request, so a designation **added or revoked mid-session takes effect on the next request** without re-login. |
| DH-LD3 | Authorization mechanism: new decorator `@RequireDesignation(...FacultyDesignation)` + `DesignationsGuard` registered as an `APP_GUARD` **immediately after `RolesGuard`** (order: SessionAuth → PasswordChange → DistributedRateLimit → Roles → **Designations** → PrivacyConsent). Routes that open a suite to designees are widened with `'teacher'` in `@Roles(...)` **and** annotated `@RequireDesignation('...')`; the guard passes super admins unconditionally and requires the flag from teachers. `403` responses carry `code: 'designation_required'` and the missing suite id. |
| DH-LD4 | **Registrar (user-admin) scope is department-pinned.** A teacher with `isUserRegistrar` may manage accounts **only inside `User.department` matching their own (case-insensitive)**, reusing the existing department-scope machinery (`adminCanAccessUser` / `assertDepartmentScope`). They may: list/create students, create teachers (department forced), reset passwords, enable/disable, run the bulk CSV import and read its jobs. They may **not**: change roles, create/promote super admins, edit another actor's designations, or touch users outside their department. Each widened route keeps a super-admin fast path. |
| DH-LD5 | **Designation assignment is super-admin-only** and is sent as three optional booleans in `PATCH /users/:id` (`UpdateUserDto`, teacher targets only). If any actor other than a super admin submits a designation field, the service rejects with `403 code: 'designations_admin_only'` **before** applying anything (no partial writes — the whole update is rejected). Every change is audited as `admin.user.designations_changed` with a per-field `{ field, from, to }` diff. |
| DH-LD6 | **Academic Oversight scope is department-pinned via `AttendanceScopeService`.** For `teacher && isDepartmentHead`: `sessionScope` expands from `{ teacherId: user.id }` to a department clause on `section.teacher.department` (`equals, insensitive` — the exact shape the department-admin specs assert today); `filteredSessionScope` pins `department = user.department` regardless of the query's `department` param (dept admins already behave this way, see `attendance-scope.service.ts:66-70`); `listExcuses` uses the same `{ session: { section: { teacher: { department: … } } } }` shape; `decideExcuse` accepts records whose session teacher shares the actor's department (`teacherId === user.id` remains the first check); the at-risk service swaps the `{ teacherId }` clause for the department clause. A plain teacher with **no** designation, or a department head with **no** `User.department`, behaves exactly as today (no oversight). Head's own classroom write flows never move: same sections, same permissions. |
| DH-LD7 | Server Status widens to the IT designation: `GET /dashboard/server-status` and the gateway's `server:subscribe`/`server:unsubscribe` accept `role === 'super_admin' || isItCoordinator === true` (gateway `assertServerMetricsAccess` reads the principal from the handshake middleware — WS handshakes go through the same Better Auth `getSession`, so designations apply there too). The SA7 5s publisher, idle-at-zero-subscribers behavior, and `GET /metrics` are untouched. Admin overview (`GET /dashboard/admin-overview`), Audit Log, and Global Search remain super-admin-only — IT coordinators do **not** get them. |
| DH-LD8 | System-issue triage (`GET /reports`, `GET /reports/stats`, `GET /reports/:id`, `PATCH /reports/:id/status`, `GET /reports/:id/screenshot`) widens from `super_admin` to `super_admin + @RequireDesignation('it_operations')`. IT coordinators act on the full institution list (system reports are institution-wide by SR-LD3 design); there is no department filter on this route, so no scope surprise. |
| DH-LD9 | Registrar routes widened exactly: `GET /users`, `GET /users/teachers`, `GET /users/students`, `POST /users/students`, `POST /users/teachers`, `POST /users/students/import`, `GET /users/students/import/jobs/:id`, `PATCH /users/:id/password`, `PATCH /users/:id/status`, and the department-scoped subset of `PATCH /users/:id` (profile fields only — see DH-LD10). Every other users route (`PATCH /users/:id/role`, `POST /users/admins`) stays `@Roles('super_admin')` with no designation widening. `GET /users/:id` has no route guard today (service-scoped); it gains the registrar branch in its service scope check so designees can fetch department targets. |
| DH-LD10 | Registrar `PATCH /users/:id` subset = `{ fullName, department?, program?, yearLevel? }` on **department targets only**; `email` changes, status flips via `/:id`, and designation fields are rejected for registrars with the codes from DH-LD4/DH-LD5. (`department` edits by a registrar are additionally constrained: Cannot move a user out of (or into) their own department — the server forces `department` to the registrar's own on teacher/student targets.) |
| DH-LD11 | Web navigation is capability-driven: `sidebar.tsx` builds the teacher list dynamically — appending grouped sections **"IT Operations Suite"** (Server Status, Issue Reports → `/faculty/system-reports`, Maintenance Controls → `/faculty/settings?tab=system`), **"Academic Department Oversight"** (Department Reports → `/faculty/reports`, Excuses → `/faculty/excuses`, At-Risk Students → `/faculty/at-risk`), and **"Registrar Suite"** (User Management → `/faculty/users`) based on `user.isItCoordinator` / `user.isDepartmentHead` / `user.isUserRegistrar`. `studentNav` and `superAdminNav` are byte-for-byte unchanged (the E2E suite asserts the super-admin item list; SA1 forbids regress). Designee groups render **below** the teaching items using the existing `Nav` `border-l-4` styling with a new small uppercase group heading. |
| DH-LD12 | Web per-page gates upgrade from `role !== 'super_admin'` to the shared capability helpers on exactly: `users`, `settings`, `server-status`, `system-reports`, `reports` pages. Teachers-without-designations keep the identical redirect behavior they have today. Android uses a new optional predicate parameter on `useAuthGate(roles, allow?: (user) => boolean)` so screens can express "super admin or `isItCoordinator`" without mutating the hook's contract. |
| DH-LD13 | Android "More" bottom sheet renders designation-gated items from a **pure, unit-testable helper** `buildFacultyMoreItems(user, …)` extracted from `MoreSheet` in `(faculty)/_layout.tsx`: teacher base items stay first/current; IT designees get *Server Status* (new `(faculty)/server-status.tsx` screen, §DH-4), *Issue Reports* (`system-reports.tsx`), *Maintenance Controls* (`settings.tsx`); academic designees get *Department Reports* (`reports.tsx`) + *At-Risk Students* (new `(faculty)/at-risk.tsx`) on top of the Excuses item that already exists; registrar designees get *User Management* (`users.tsx`). Super-admin sheet content is unchanged except the new items route into the same screens they already use. |
| DH-LD14 | Seed data only **adds new faculty accounts** with designations; existing seeded users are never stamped (E2E journeys like the faculty re-login/multi-device tests, the dashboard-trend fixture, and student-scoping specs all reference those exact users/rosters, and stamping flags would change nav + error-tracking expectations mid-suite). New: `bry.mis@pup.edu.ph` (`CCIS` teacher, `isItCoordinator`), `chair.ccis@pup.edu.ph` (`CCIS` teacher, `isDepartmentHead`), `reg.campus@pup.edu.ph` (`Registrar's Office`-labeled `HRM`-style department string `Registrar` teacher, `isUserRegistrar`) — passwords via the existing seeded pattern; student rosters untouched. |
| DH-LD15 | Audit for designation writes: `admin.user.designations_changed` (metadata `{ targetUserId, targetRole, changes: [{ field, from, to }], ipAddress }`). Reads of designation state never audit. All new audit actions follow the repo's lowercase-dot convention. |

### Maintenance mode (MT)

| # | Decision |
|---|---|
| MT-LD1 | **Naming collision resolved up front**: the codebase already has `backend/src/common/services/maintenance.service.ts` — a cron-pruning `MaintenanceService` (stale permissions, scan attempts, audit logs, notifications). The new subsystem is a separate module **`backend/src/maintenance-mode/`** with `SystemMaintenanceService`, `MaintenanceGuard`, and `MaintenanceModeController`. The prune service is untouched and renamed nowhere (zero-regression). Documentation in AGENTS.md will disambiguate "maintenance cron" vs "maintenance mode". |
| MT-LD2 | Settings keys (existing `InstitutionSetting` string-row model — no schema change for settings): `maintenance_mode_enabled` (boolean, default `false`), `maintenance_message` (free text ≤ 500 chars, default `''` → server substitutes the built-in default copy), `maintenance_until` (optional ISO-8601 datetime string, `''` clears the estimate). New `SettingsService` validating kinds: `OPTIONAL_DATETIME_SETTING_KEYS` + `OPTIONAL_TEXT_SETTING_KEYS` alongside the existing boolean/integer/enum kinds; a malformed/missing row resolves to the safe default like every other key kind. |
| MT-LD3 | Runtime state is served from a Redis-cached snapshot (`maintenance:state` JSON, TTL 60 s) with a **2-second in-process memo** on top, so the guard adds a cache read (µs) instead of a Postgres round-trip to *every* protected request. On toggle, the writing instance deletes the key; cross-instance staleness is bounded by TTL (no pub/sub dependency — `RedisService` has no subscribe surface and adding one is explicitly rejected to keep the blast radius small). Redis outage + DB outage together fail **open** (log at `error` level, continue serving) — the API never bricks itself on internal failure; a maintenance that is momentarily unenforced is the accepted trade-off, documented in Key Decisions. |
| MT-LD4 | `MaintenanceGuard` is a global `APP_GUARD` registered **between `PasswordChangeGuard` and `DistributedRateLimitGuard`** (order: SessionAuth → PasswordChange → **Maintenance** → RateLimit → Roles → Designations → PrivacyConsent). Placement rationale: after auth so the actor is resolved; before rate limiting so blocked users never consume login/sync rate budget; before roles so suites are unreachable regardless of role metadata. Behavior: `@Public()` routes skip (health probes, login, maintenance status, privacy notice); otherwise `isMaintenanceExempt(principal)` (`role === 'super_admin' || isItCoordinator === true`) **or** maintenance off → continue; else `503 ServiceUnavailableException({ code: 'system_maintenance', message: maintenance_message \| default, estimatedEnd? })`. |
| MT-LD5 | The 503 body is: `{ statusCode: 503, error: 'ServiceUnavailableException', message, code: 'system_maintenance', estimatedEnd?: string, path, timestamp }`. `AllExceptionsFilter` is extended additively to forward a string `estimatedEnd` (it already forwards `code` and `remainingMinutes`; this mirrors that pattern). Operators' checks get the same JSON via `/maintenance/status`. |
| MT-LD6 | **No auto-off.** `maintenance_until` is an *estimated resumption* display value only — passing the timestamp flips the client countdown into "Resumption is overdue — contact IT" copy; the mode itself only ends when an exempt actor writes `maintenance_mode_enabled=false`. Automating shutdown would silently reopen the system while the outage persists; the Settings System tab spells this out. |
| MT-LD7 | Public metadata endpoint `GET /maintenance/status` (`@Public()`, `@SkipThrottle()`) → `{ enabled, message?, estimatedEnd? }` (`message`/`estimatedEnd` omitted entirely when disabled). This powers pre-login and app-boot screens without leaking anything else (it publishes exactly what the 503 body publishes). Path lives under the new `maintenance-mode` controller; it is exempt from the maintenance guard by definition. |
| MT-LD8 | Login endpoints self-check inside `AuthService` (they are `@Public()` and therefore invisible to the guard): `POST /auth/login/student`, `/auth/login/faculty`, `/auth/mobile/login/student`, `/auth/mobile/login/faculty` validate credentials first, then — anti-enumeration preserving the current timing profile — load the (already fetched) user and reject non-exempt actors with the canonical `503 { code: 'system_maintenance' }` **if and only if the mode is on**. Invalid credentials still return `401` first; students are never exempt, so `/auth/login/student` rejects **every** credential-valid attempt while the mode is on. |
| MT-LD9 | Realtime: the gateway's `afterInit` handshake middleware (which already authenticates every socket) additionally rejects non-exempt sockets while the mode is on with `next(new Error('system_maintenance'))` — Socket.IO's default reconnection keeps retrying, so exempt staff and post-recovery clients come back on their own without a client release. `notifications:new`, `ai:thread:*`, `server:metrics`, and the session-replacement broadcast semantics are otherwise unchanged. |
| MT-LD10 | Offline mobile contract: a `503 code: 'system_maintenance'` is **transient, not terminal** — the SQLite sync queue retains queued submissions and the "pending sync" chip stays; the classifier in `android/services` never maps `system_maintenance` to a terminal/duplicate bucket (it joins the existing network-failure family with its own userData message). In-class operation is unaffected mechanically (offline scans already required no server); the UI adds the preservation notice quoted in §MT-5. |
| MT-LD11 | Maintenance writes are audited: every `PUT /settings/:key` touching the three maintenance keys emits `system.maintenance_changed` (metadata `{ key, from, to, estimatedEndSet? }`). Keys other than the maintenance trio are still institution-scope super-admin territory (existing `scope !== 'institution'` check) — **IT coordinators may PUT only the maintenance keys** (controller/service-level per-key policy), preserving SoD even at the settings endpoint. |
| MT-LD12 | Client surface naming per the directive: web ships both `MaintenanceOverlay.tsx` (global, event-driven, sits above route content) and a `MaintenancePage.tsx` variant (login pages + `/maintenance` route render path) backed by one canonical `<MaintenanceScreen/>`; Android ships a full-screen `MaintenanceSheet`/`maintenance` route with the student preservation notice. Both show: animated wrench + clock (CSS/RN Animated, reduced-motion aware), countdown to `estimatedEnd`, support contact block, discreet **"Administrator Login"** link → `/login/faculty`. |

---

## 3. Architecture Overview

```
                        ┌──────────────────────────────────────────────────────────┐
                        │ NestJS global pipeline (AppModule providers order)       │
                        │                                                          │
 request ──► HttpMetrics → SessionAuth → PasswordChange → MAINTENANCE ──► RateLimit
                                                            │                → Roles → DESIGNATIONS → PrivacyConsent
                                                            │                       ► controller
                                                            │
            ┌───────────────────────────────────────────────┘
            │  on/off? exempt?     exempt = super_admin OR isItCoordinator
            │    (Redis-cached 60s + 2s mem, DB fallback, fail-open)
            ▼
        503 { code:'system_maintenance', message, estimatedEnd? }   ← regular users
        pass → DesignationsGuard → suite routes (per-route widening)
```

```
 Principal (every request, DB-backed via Better Auth additionalFields)
   { id, role, department, scope, …, isItCoordinator, isDepartmentHead, isUserRegistrar }
        │
        ├── MaintenanceGuard ......... exemption
        ├── DesignationsGuard ....... suite routes (3 decorations)
        ├── AttendanceScopeService .. department clauses for DH (report / excuses / at-risk / lists)
        ├── UsersService ............ registrar department pinning + designation admin-only rule
        └── server-status + reports . IT-designation widenings (HTTP + WS)
```

```
 Clients
   Web:  MaintenanceScreen (overlay/page) ◄── api-client 503 event + GET /maintenance/status + SessionGuard branch
   Android: maintenance store ◄── api-client classifier (503 system_maintenance) + AppState /maintenance/status probe
            scan screen notice · sync queue retained · preservation banner
```

---

## 4. Data Contracts & `@polycheck/shared`

### 4.1 `shared/src/types/user.ts`

```ts
export type UserRole = 'super_admin' | 'teacher' | 'student'

export interface User {
  // …existing fields unchanged…
  /** Concurrent administrative designations (PUP Santa Maria dual-hat model). Teacher-only; super admins hold all suites implicitly. */
  isItCoordinator?: boolean
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
}
```

`Teacher`/`Student`/`SuperAdmin` aliases inherit automatically. No property is removed or re-typed anywhere — the contract is purely additive.

### 4.2 New module `shared/src/utils/designations.ts` (pure, no API imports — fully unit-testable)

```ts
export type FacultyDesignation = 'it_operations' | 'academic_oversight' | 'user_admin'
export const FACULTY_DESIGNATIONS: readonly FacultyDesignation[] = ['it_operations', 'academic_oversight', 'user_admin'] as const
export const DESIGNATION_FLAGS: Record<FacultyDesignation, keyof User> = {
  it_operations: 'isItCoordinator',
  academic_oversight: 'isDepartmentHead',
  user_admin: 'isUserRegistrar',
} as const
export const DESIGNATION_LABELS: Record<FacultyDesignation, string> = {
  it_operations: 'IT Coordinator',
  academic_oversight: 'Department Head',
  user_admin: 'Registrar',
}

export interface DesignationCarrier {
  role: UserRole
  isItCoordinator?: boolean
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
}

export function activeDesignations(user?: DesignationCarrier | null): FacultyDesignation[]
export function hasDesignation(user: DesignationCarrier | null | undefined, d: FacultyDesignation): boolean
export function canAccessItOperations(user?: DesignationCarrier | null): boolean        // super_admin || isItCoordinator
export function canAccessAcademicOversight(user?: DesignationCarrier | null): boolean   // super_admin || isDepartmentHead
export function canAccessUserAdmin(user?: DesignationCarrier | null): boolean           // super_admin || isUserRegistrar
export function isMaintenanceExempt(user?: DesignationCarrier | null): boolean          // super_admin || isItCoordinator
export function oversightDepartment(user?: DesignationCarrier | null): string | null    // dept head → their department, else null
```

Property names match the directive verbatim (`canAccessItOperations`, `canAccessAcademicOversight`, `canAccessUserAdmin`). These are re-exported through `shared/src/types` barrel **and** the `utils` subpath (the repo's non-null pattern from `haversineDistance` / `pin-hash` exports).

### 4.3 New module `shared/src/types/maintenance.ts`

```ts
/** Canonical 503 body published while maintenance mode is active (MT-LD5). */
export interface MaintenanceBlockBody {
  code: 'system_maintenance'
  message: string
  estimatedEnd?: string
}

/** Public, unauthenticated snapshot from GET /maintenance/status (MT-LD7). */
export interface MaintenanceStatus {
  enabled: boolean
  message?: string
  estimatedEnd?: string
}

export const DEFAULT_MAINTENANCE_MESSAGE
  = 'Polycheck is undergoing scheduled maintenance. Attendance taken during class still works offline — your records are safely stored on this device and will sync when servers reopen.'

export const MAINTENANCE_SETTING_KEYS = [
  'maintenance_mode_enabled',
  'maintenance_message',
  'maintenance_until',
] as const
```

### 4.4 `shared/src/types/dashboard.ts`

`UpdateUserInput` gains the three optional booleans (mirroring the GOV override-tri-state lines):

```ts
export interface UpdateUserInput {
  // …existing fields…
  /** Designation assignment (DH-LD5): super-admin-only; rejected for other actors before any field is applied. */
  isItCoordinator?: boolean
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
}
```

No new exported dashboard types otherwise; `AdminUserPage`/`AdminUserFilters` are untouched (department designees filter using `department` as registrars do).

### 4.5 Validation

- New `shared/src/validation/maintenance.ts`:
  - `MaintenanceStatusSchema` (disciplined optional ISO strings — `z.string().datetime({ offset: true })` for `estimatedEnd`).
  - `MaintenanceBlockBodySchema` (client-side parsing of the 503 — tolerant: strings must survive but unknown extras ignored).
  - Settings-input validation mirrors the backend (`maintenance_message` ≤ 500, `maintenance_until` ISO-or-empty).
- `shared/src/validation` barrel re-exports (the export path exists since SR-0).
- Designation naming: `FACULTY_DESIGNATION_KEYS` exported as a `z.enum(['it_operations','academic_oversight','user_admin'])` for test reuse; the **user-update zod mirror** used by tests gains the three `z.boolean().optional()` fields.

### 4.6 `shared/src/types/api.ts` (ApiClient)

```ts
export interface ApiClient /* … */ {
  // Maintenance mode (MT)
  getMaintenanceStatus(): Promise<MaintenanceStatus>   // GET /maintenance/status — public, never throws for 5xx-format responses
  // …setSetting/getSettings unchanged (maintenance keys flow through them)…
}
```

Both client implementations (web + Android) implement the detection themselves via their request parsers; Android additionally keeps its maintenance store (§MT-7). Test additions assert the new method exists in **both** clients and that an outdated role gate cannot strip it.

---

## 5. Database Schema & Prisma Migration

### 5.1 User model columns

```prisma
model User {
  // …existing…
  // PUP Santa Maria concurrent administrative designations (teacher accounts only).
  isItCoordinator  Boolean @default(false)
  isDepartmentHead Boolean @default(false)
  isUserRegistrar  Boolean @default(false)
}
```

### 5.2 Migration `backend/prisma/migrations/20261102120000_campus_designations_maintenance_mode/migration.sql`

Self-healing, idempotent, in the shape of `20260907090000_domain_constraints` (pre-checks + backfills so dirty dev databases never crash):

```sql
-- Columns (guarded by information_schema checks; ALTER ... DEFAULT false, NOT NULL)
ALTER TABLE "User" ADD COLUMN "isItCoordinator"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "isDepartmentHead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "isUserRegistrar"  BOOLEAN NOT NULL DEFAULT false;

-- Partial indexes for the two visibility scans (department oversight and registrar target lookups).
CREATE INDEX "user_designee_department_idx"
  ON "User" (department) WHERE role = 'teacher' AND ("isDepartmentHead" = true OR "isUserRegistrar" = true);

-- Idempotent setting seeds so a fresh GET /settings shows everything with safe defaults.
INSERT INTO "InstitutionSetting" (key, value, "updatedBy", "createdAt", "updatedAt") VALUES
  ('maintenance_mode_enabled', 'false', 'system', NOW(), NOW()),
  ('maintenance_message',      '',      'system', NOW(), NOW()),
  ('maintenance_until',        '',      'system', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
```

Backfill decision: existing rows need **no** value backfill (`DEFAULT false` covers all existing + future rows). The AGENTS.md "migration self-healing" pattern is followed; `prisma migrate dev` regenerates the typed client (`User` gains `isItCoordinator` etc.). **Historical rows and all 754 existing backend specs are untouched** — default `false` preserves exactly the current behavior for every non-designee account.

### 5.3 Seed updates (`backend/prisma/seed.ts`, DH-LD14)

Actor-gated upserts exactly like the existing seeding functions:

| Account | Role | Department | Designation | Purpose |
|---|---|---|---|---|
| `bry.mis@pup.edu.ph` | teacher | `CCIS` | `isItCoordinator: true` | IT Ops journeys: server status, triage, maintenance toggle. |
| `chair.ccis@pup.edu.ph` | teacher | `CCIS` | `isDepartmentHead: true` | Academic oversight: department reports/excuses/at-risk. Must teach ≥1 section (reuse `sec-00X` creation pattern with a fresh placeholder section if needed — seeded so head-scope specs have both head-owned *and* non-head-owned sections to assert against). |
| `reg.campus@pup.edu.ph` | teacher | `Registrar` | `isUserRegistrar: true` | Registrar journeys: filtered user directory, password reset, import. |

Seeded + designated via `prisma.user.upsert` shaped like the existing teacher upserts (idempotent, safe across re-seeds). `SEED_PASSWORD` continues to apply. The existing `mcreyes` (super admin), `jmdelacruz`/`mesantos` (plain teachers), and all 8 students are untouched by design.

---

## 6. Backend (NestJS)

### 6.1 New module `backend/src/maintenance-mode/`

```
backend/src/maintenance-mode/
├── maintenance-mode.module.ts
├── system-maintenance.service.ts      (+ .spec.ts)
├── maintenance.guard.ts               (+ .spec.ts)
├── maintenance-mode.controller.ts     (+ .spec.ts)
```

**`SystemMaintenanceService`** (MT-LD3)

- `current(): Promise<MaintenanceStatus>` — reads `getJson('maintenance:state')` from `RedisService` with a 2-second in-process memo; on cache miss re-reads the three settings rows via `SettingsService` and writes the snapshot with `TTL 60`.
- `invalidate()` — deletes the snapshot key (called on settings writes).
- `isOn()`, `bypasses(principal)` — thin pure wrappers around `current()` + `isMaintenanceExempt` from shared utils.
- Sources of truth remain the settings rows; the cache is a soft layer with bounded staleness (≤ 60 s cross-instance). No pub/sub added (RedisService has no subscribe surface — MT-LD3).

**`MaintenanceGuard`** (MT-LD4). Reflection: `IS_PUBLIC_KEY` skip; then `SystemMaintenanceService.bypasses(request.user)`; else throw `new ServiceUnavailableException({ code: 'system_maintenance', message, estimatedEnd })`. Idempotent & allocation-free hot path: memo hit → `===` to cached enabled flag → throw or pass.

**`maintenance-mode.controller.ts`**

- `GET /maintenance/status` → `@Public() @SkipThrottle() @Get('status')` under `@Controller('maintenance')`, returning the exact `MaintenanceStatus` contract.

### 6.2 Guard composition & `AllExceptionsFilter`

- App providers order (exact diff):

```
SessionAuthGuard → PasswordChangeGuard → MaintenanceGuard(NEW) → DistributedRateLimitGuard
                 → RolesGuard → DesignationsGuard(NEW) → PrivacyConsentGuard
```

- `AllExceptionsFilter`: forward a string `estimatedEnd` from responses that carry it (mirrors the `code`/`remainingMinutes` forwarding; additive + typed; spec updated with a "503 carries maintenance surface" case). Existing message/code/remainingMinutes forwarding is behaviorally untouched.

### 6.3 `@RequireDesignation` + `DesignationsGuard`

```
backend/src/common/decorators/require-designation.decorator.ts   // Designations = (...d) => SetMetadata(REQUIRED_DESIGNATIONS_KEY, d)
backend/src/common/guards/designations.guard.ts                  // + designations.guard.spec.ts
```

Guard logic: no metadata → pass; principal missing → `ForbiddenException` (defensive, mirrors RolesGuard); `role === 'super_admin'` → pass; else every metadata entry must map to a truthy flag via `DESIGNATION_FLAGS` else `ForbiddenException({ message: '<Suite> requires the <Designation Label> designation', code: 'designation_required' })` with `designation` describing the missing suite. Registration point per DH-LD3.

### 6.4 Principal & auth wiring (DH-LD2)

1. `better-auth.service.ts`: extend the `server.additionalFields` map with `isItCoordinator`, `isDepartmentHead`, `isUserRegistrar` (type `boolean`, `input: false`, `defaultValue false`) exactly like the existing governance overrides (`canResetStudentPasswords`/`canEmergencyUnbindDevices` entries).
2. `authenticated-principal.ts`: `RequestUser` gains the three optional booleans.
3. `session-authenticator.service.ts`: copy them into the returned principal (single `getSession` call — unchanged perf).
4. `auth.service.ts` `sanitizeUser` (used by `/auth/me`, both logins): yield the three booleans so `GET /auth/me` and every login response return the active designations — this is where the directive's "dynamic permission resolution in `auth.controller.ts` returning active designations in `req.user`" lands: the principal itself is resolved once per request in `SessionAuthenticator` (mirroring `req.user`), and the controller's DTO-free `getProfile` simply surfaces the sanitized row; the hook lives in the authenticator rather than the controller because every guard (session, maintenance, designations) consumes the principal uniformly. Clients (`api.getCurrentUser()`) pick the fields up on the next `/auth/me` refresh with **no client-side schema change**.

**Login maintenance interlock (MT-LD8)** — in `AuthService`:

```ts
private assertLoginAllowedDuringMaintenance(user: PrismaUser) {
  // runs in loginStudent + loginFaculty AFTER credential validation on the already-fetched row
  if (isMaintenanceExempt({role: user.role, isItCoordinator: user.isItCoordinator})) return
  if (!maintenance.active) return
  throw new ServiceUnavailableException({
    code: 'system_maintenance', message: maintenance.message, estimatedEnd: maintenance.estimatedEnd,
  })
}
```

A private boolean snapshot is read from `SystemMaintenanceService.current()` (module-injected; `AuthModule` imports `MaintenanceModeModule`).

### 6.5 Endpoint + guard widening matrix

Legend: **R** = role widening, **D** = `@RequireDesignation` added, **S** = service-level scope branch.

| Route | Today | After |
|---|---|---|
| `GET /dashboard/server-status` | `@Roles('super_admin')` | + R `'teacher'` + D `'it_operations'` |
| WS `server:subscribe` / `server:unsubscribe` | `assertServerMetricsAccess` role check | + S `principal.isItCoordinator === true` |
| `GET /reports`, `GET /reports/stats`, `GET /reports/:id`, `GET /reports/:id/screenshot`, `PATCH /reports/:id/status` | `@Roles('super_admin')` | + R `'teacher'` + D `'it_operations'` (service untouched — institution-wide) |
| `PUT /settings/:key` | `@Roles('super_admin')` + institution-scope check | + R `'teacher'` + D `'it_operations'` + S per-key policy: non-super actors may PUT **only** `maintenance_*` keys; super admin path identical (DH-LD11 / MT-LD11) |
| `GET /users` `GET /users/teachers` `GET /users/students` | super_admin (+`students` teacher) | + R `'teacher'` + D `'user_admin'` + S registrar department pinning (DH-LD4) |
| `POST /users/students` `POST /users/teachers` | super_admin | + R + D `'user_admin'` + S: teacher creation forces `department: actor.department` (registrar path) |
| `POST /users/students/import` / `GET …/jobs/:id` | super_admin | + R + D `'user_admin'` + S same pinning (`assertDepartmentScope` gains registrar branch) |
| `PATCH /users/:id` | super_admin | + R + D `'user_admin'` + S: registrars limited to `{ fullName, department?, program?, yearLevel? }` on department targets; designation fields 403 with `designations_admin_only`; department forced (DH-LD9/LD10) |
| `PATCH /users/:id` (designations) | — | Super-admin-only writes (DH-LD5) + `admin.user.designations_changed` audit + Teacher-only target validation |
| `PATCH /users/:id/password`, `PATCH /users/:id/status` | super_admin | + R + D `'user_admin'` + S department targets only |
| `PATCH /users/:id/role`, `POST /users/admins` | super_admin | unchanged, no widening |
| `GET /attendance/report`, `/summaries`, `/attempts`, `/attendance` list, `GET /attendance/*` list routes | `@Roles('teacher','super_admin')` already | unchanged role metadata; scope inside `AttendanceScopeService` gains the DH branch (DH-LD6) |
| `GET /attendance/at-risk` | `@Roles('teacher','super_admin')` | unchanged metadata; service branch swaps `{ teacherId }` for the department clause for heads |
| `GET /attendance/excuses` | same | service branch per DH-LD6 |
| `POST /attendance/records/:id/excuse/decision` | `@Roles('teacher')` | unchanged; `decideExcuse` adds the department-shared-teacher condition |
| `GET /maintenance/status` | — | new, `@Public()` |
| `/health`, `/health/ready` | `@Public()` | unchanged |

### 6.6 Attendance scoping: the single implementation point

`backend/src/attendance/attendance-scope.service.ts` gains one pure predicate + branches (exact clause shapes asserted in the existing department-admin specs are reused):

```ts
// isAcademicHead(user) := user.role === 'teacher' && user.isDepartmentHead === true && !!user.department
sessionScope:      head → { section: { teacher: { department: { equals: dept, mode: 'insensitive' } } } } … 
                     (with head-owned sections legitimately inside)
filteredSessionScope: head → department = actor.department pinned; teacherId filter restricted to in-department
recordScope/rawRecordWhere: untouched shapes; they compose sessionScope, so heads get department-wide staff lists
```

and in `attendance.service.ts`:

- `listExcuses`: `teacher && head → { session: { section: { teacher: { department: { equals: dept, mode: 'insensitive' } } } } }` — same shape the dept-admin spec at `attendance-excuse.service.spec.ts:183` asserts for admins.
- `decideExcuse`: head branch checks `session.section.teacher.department` equality (requires extending the existing `include` to `section: { select: { teacher: { select: { department: true } } } }`).

`attendance-at-risk.service.ts::list`: head branch uses the department clause in `sectionWhere` (matching the dept-admin spec shape at line 143 — `{ where: { teacher: { department: 'CCIS' } } }`-family), and sectionId allow-checks against that same clause instead of the teacher's own sections.

### 6.7 Users service: registrar branches

New teammate file `backend/src/common/designations/department-pin.ts` (pure, spec'd) so `admin-scope.ts` stays untouched:

```ts
export function registrarCanAccessUser(actor, targetDepartment?): boolean            // ilike equality
export function registrarDepartmentClause(dept): Prisma.StringFilter                 // { equals, mode: 'insensitive' }
export function isDesignationWriteRequest(dto): boolean                              // any designation field present
```

`UsersService`:

- `findAll`/`findTeachers`/`findStudents`: registrar branch — super-admin filters preserved; registrar pins `department` to their own and rejects a request asking for another department (consistent with `assertDepartmentScope` behavior for scoped admins).
- `createTeacher`: registrar → force `dto.department = actor.department` before persistence + audit metadata `forcedDepartment: true`.
- `createStudent` / import path (`users.service.ts::assertDepartmentScope`, `student-import-queue.service.ts`): add the registrar branch alongside `adminCanAccessUser` (the import's department validation flows unchanged).
- `updateUser`: full designation handling (DH-LD5) **before** applying the row write, department-pin enforcement for registrar actors, and the field whitelisting of DH-LD10. `mustChangePassword` / audits / notifications existing behavior untouched.
- `resetPassword`/`setStatus`/`findOne`: registrar department branch reuses `assertDepartmentScope`'s exact error messaging style.

### 6.8 Settings service checks (MT keys + IT writes)

`backend/src/settings/settings.service.ts`:

- `INSTITUTION_SETTING_KEYS` + `BOOLEAN_SETTING_KEYS` gain `maintenance_mode_enabled`; new kinds `OPTIONAL_TEXT_SETTING_KEYS` (500 chars) and `OPTIONAL_DATETIME_SETTING_KEYS` (ISO-8601 or `''` clears).
- New `getMaintenanceState(): Promise<{ enabled: boolean; message: string; estimatedEnd: string | null }>` reading the three keys with defaults, consumed by both `SystemMaintenanceService` (write-time + TTL refresh) and `MaintenanceModeController`.

`SettingsController::set`: role/designation widening + the duo rule:

```
if (!isMaintenanceSettingKey(key) && !institutionScopedSuperAdmin(user)) → 403 // existing semantics preserved
if (isMaintenanceSettingKey(key)) → audit 'system.maintenance_changed' via maintenance audit recorder + invalidate()
```

(Trailing behavior identical for non-maintenance keys so 0 regressions; the endpoint-wide rate limiter unchanged.)

### 6.9 Gateway

`attendance.gateway.ts::afterInit` middleware (MT-LD9):

```ts
server.use(async (socket, next) => {
  socket.data.user = await this.sessions.authenticate(this.handshakeHeaders(socket))  // unchanged
  const maintenance = await this.systemMaintenance.current()                          // cache-hit read
  if (maintenance.enabled && !isMaintenanceExempt(socket.data.user)) {
    return next(new Error('system_maintenance'))                                      // socket closes; Socket.IO retries
  }
  await socket.join(this.userRoom(user.id))
  next()
})
```

`assertServerMetricsAccess` accepts `isItCoordinator === true` alongside super admin (WS handshake already returns the principal with designation fields — DH-LD7). The existing `attendance.gateway.spec.ts` cases stay green (no role test changes needed for the exempt path).

### 6.10 Swagger / docs

Route guards are annotatable — update the descriptions for the widened suites and `GET /maintenance/status`. No new docs auth (`swagger.ts` token-gating untouched).

### 6.11 Backend test plan (per-suite contract — counts)

| Spec file (new/extended) | Assertions | Est. new cases |
|---|---|---|
| `common/guards/maintenance.guard.spec.ts` *(new)* | @Public bypass; exempt super_admin; exempt IT coordinator; blocked teacher & student; 503 body shape (`code`, `message`, `estimatedEnd`); fail-open on state-service crash; no throw when bypass helper passes | 7 |
| `common/guards/designations.guard.spec.ts` *(new)* | no metadata; super_admin pass; missing-flag rejection per suite; multi-suite route requiring both; 403 body shape (`designation_required`) | 6 |
| `maintenance-mode/system-maintenance.service.spec.ts` *(new)* | cache hit/miss/TTL; invalidation on write; DB fallback values; memo expiry; estimate-only semantics of `maintenance_until` | 6 |
| `maintenance-mode/maintenance-mode.controller.spec.ts` *(new)* | public status shape on enabled/disabled; `SkipThrottle` metadata present | 3 |
| `auth/auth.service.spec.ts` *(extends)* | valid credentials + maintenance → 503 for student (both login forms); 503 for non-designated teacher; pass through for IT coordinator & super admin; 401 unchanged (invalid creds precede maintenance check) | 6 |
| `auth/session-authenticator.service.spec` *(extends)* *(if present)* | principal mapping includes the 3 flags | 2 |
| `settings/settings.service.spec.ts` *(extends)* | new setting kinds: boolean + datetime(mock) + long-text boundaries (≤ 500 + trim) | 5 |
| `settings/settings.controller.spec` *(extends)* | IT non-key PUT 403; maintenance key write ok; super admin institution-scope rule preserved; dept-scoped super admin still blocked | 4 |
| `users/users.designations.spec.ts` *(new)* | designation field submits by registrar → 403 no-partial-write; teacher-target validation (student target rejected); department-move rejection; diff metadata `{field,from,to}`; audit row written | 7 |
| `users/users.service.spec.ts` *(extends)* | registrar: list pinning; password reset scope; status set; import endpoint scope; `GET /users/:id` fetch; promotions unchanged for super admin | 8 |
| `attendance/attendance-scope.service.spec.ts` *(extends)* | head session scope clause; head report department pinning + teacherId-in-department; plain teacher unchanged | 5 |
| `attendance/attendance-excuse.service.spec.ts` *(extends)* | head lists department-wide; head decides other teachers' excuse in-dept; out-of-dept 403; own-session fast path unchanged | 5 |
| `attendance/attendance-at-risk.service.spec.ts` *(extends)* | head department clause + sectionId allow-check | 4 |
| `attendance/attendance-report.service.spec.ts` *(extends)* | head department pinning (mirrors dept-admin spec shapes) | 3 |
| `dashboard/dashboard.controller.spec` *(extends)* | server-status route accepts IT designee; admin-overview still super admin only | 3 |
| `reports/reports.controller.spec` *(extends)* *(if present)* | triage routes accept IT designee; teacher without flag 403 | 4 |
| `all-exceptions.filter.spec.ts` *(extends)* | 503 forwards estimatedEnd string; unknown numeric ignored | 2 |
| `common/filters/…` + gateway specs *(extends)* | WS rejection while active; exempt sockets join rooms; `server:subscribe` IT designee | 4 |

**Target backlog ≥ 84 new backend cases** across ~17 suites.

---

## 7. Frontend (Next.js Web)

### 7.1 `lib/api-client.ts` maintenance detection

- `ApiHttpError` gains `readonly estimatedEnd?: string` (parsed like `code`).
- In the response failure path (where `code`/`remainingMinutes` parse — `api-client.ts:144-146`), additionally test for the maintenance signal and **dispatch a window event before throwing**:

```ts
window.dispatchEvent(new CustomEvent('polycheck-maintenance', { detail: { message, estimatedEnd } }))
throw new ApiHttpError(message || 'System maintenance', 503, code, estimatedEnd)
```

- Add `getMaintenanceStatus()` (`GET /maintenance/status`, tolerant: any 404/parse failure yields `{ enabled: false }`).
- Designation fields ride through existing user caching (`saveUser`) automatically; no localStorage migration.

### 7.2 Maintenance components (MT-LD12)

```
frontend/src/components/maintenance/
├── MaintenanceScreen.tsx        (+ MaintenanceScreen.test.tsx)  — the canonical branded screen
├── MaintenanceOverlay.tsx       (+ .test.tsx)                   — global fixed overlay w/ MaintenanceScreen
├── MaintenancePage.tsx          (+ .test.tsx)                   — page variant (login / /maintenance route)
└── MaintenanceProvider.tsx      (+ .test.tsx)                   — context + window-event + polling orchestration
```

- **Design**: full-screen `bg-maroon dark:bg-surface-dark` surface; Lora heading "Polycheck is under scheduled maintenance"; animated wrench + clock icon pair (pure CSS `animate-spin`-style keyframes, `prefers-reduced-motion` → static); countdown timer computed against `Date.now() + clockSkew` using the **existing `/health` clock-offset mechanic from the offline plan** so a skewed device clock can't show a negative countdown; support contact block from the static web constant (§9 — never a runtime fetch); discreet bottom link **"Administrator Login" → `/login/faculty`** (small, `text-golden`, `underline-offset-2`).
- **MaintenanceProvider** (mounted inside `NotificationProvider` in `app/layout.tsx`, co-located with `PwaBoot`/`AuthSessionMonitor`): listens for `polycheck-maintenance`; on activation sets state, mounts the overlay above `{children}` (`z-[100]`, `role="alertdialog"`, focus trap, `aria-label`s per the accessible-dialog conventions in the audit), polls `getMaintenanceStatus()` every 30 s while active, and clears itself when the mode ends.
- **`SessionGuard`** branch: `catch` inspects `ApiHttpError.status === 503 && code === 'system_maintenance'` → new `GuardState 'maintenance'` rendering `<MaintenancePage/>`; the generic "connection unavailable" screen is otherwise unchanged.
- **`AuthSessionMonitor`**: **no code change, spec'd** — its `/auth/me` probe semantics already treat non-401/403 failures as "session not proven revoked"; a 503 must not sign users out (covered by an added unit case).
- **Login pages** (`(auth-landing)/login/{faculty,student}`): on login `ApiHttpError` with the maintenance signal → render `<MaintenancePage/>`; invalid-credential and password-gate flows untouched.
- **Admin bypass**: the overlay carries the directive's "admin bypass modal" as an explicit escape hatch — when the cached user is exempt (`isMaintenanceExempt(user)`, e.g. the mode flipped on while an IT coordinator was online and they reload), `MaintenanceProvider` checks the cached principal, auto-dismisses the hint surface, and leaves a compact "Maintenance active — you are exempt" pill instead of the fullscreen; non-exempt principals get the full branded wall with the discreet **"Administrator Login"** link (`/login/faculty`, small, `text-golden`) as their only escape route.

### 7.3 Sidebar (DH-LD11)

`components/layout/sidebar.tsx`:

- `type NavItem = { label: string; href: string; icon: any; group?: string }`; render treats consecutive runs sharing `group` under an uppercase 10px heading (`text-[10px] font-bold tracking-widest text-zinc-400`) — zero style drift for existing `studentNav`/`teacherNav`/`superAdminNav` (no group on existing items).
- Teacher list assembly:

```ts
const teacherBase = teacherNav                                       // unchanged items
const itOps: NavItem[] = [
  { label: 'Server Status', href: '/faculty/server-status', icon: Server, group: 'IT Operations Suite' },
  { label: 'Issue Reports', href: '/faculty/system-reports', icon: Flag, group: 'IT Operations Suite' },
  { label: 'Maintenance Controls', href: '/faculty/settings?tab=system', icon: Settings, group: 'IT Operations Suite' },
]
const oversight: NavItem[] = [
  { label: 'Department Reports', href: '/faculty/reports', icon: BarChart3, group: 'Academic Department Oversight' },
  { label: 'At-Risk Students', href: '/faculty/at-risk', icon: ClipboardCheck, group: 'Academic Department Oversight' },
]
const registrarSuite: NavItem[] = [ { label: 'User Management', href: '/faculty/users', icon: Users, group: 'Registrar Suite' } ]
const items = [...teacherBase, ...(canAccessItOperations(user) ? itOps : []), ...(canAccessAcademicOversight(user) ? oversight : []), ...(canAccessUserAdmin(user) ? registrarSuite : [])]
```

(`oversight` re-parents Excuses for department heads: the standard teacher already has Excuses; a head sees it **once**, inside the oversight group, deduplicated from the base list to avoid double entries.)

- Sidebar unit tests (`sidebar.rendering.test.tsx`): teacher-without-flags identical item list; IT-only designation shows exactly one extra group + 3 items; head-only designation surfaces exactly 2 extra items (Department Reports, At-Risk) with Excuses re-parented; both designations render both groups; `superAdminNav` byte-identical (guarding the existing E2E expectation).

### 7.4 Page-gating + new/updated surfaces

| File | Behavior |
|---|---|
| `app/faculty/users/page.tsx` | gate → `canAccessUserAdmin(current)`; `isFullAdmin = current.role === 'super_admin'` hides role-change + Add-Super-Admin + **designations editor** for registrars; department selector pinned/disabled for registrars. |
| New `components/admin/designations-editor.tsx` (+ test) | The three switch rows (🛠️/🎓/📋 with helper copy + department-required warning for the IT/Head flags) integrated into the existing user edit dialog (GOV layout); **submission is a super-admin-only affordance** (hidden from registrars by design — DH-LD4). |
| `app/faculty/settings/page.tsx` + `settings-config.ts` | page gate → `super_admin or canAccessItOperations`; new `"system"` tab: id `system`, label `'System'` — the fifth tab; fields: `maintenance_mode_enabled` switch (`'false'` default), `maintenance_message` textarea, `maintenance_until` datetime-local (empty = none); status chip describes live mode; IT designees see **only** the System tab (super admin keeps all five); `isTabSaveable`/`isTabDirty` derive naturally; per-tab save body validation is a local pure function with vitest. |
| `app/faculty/server-status/page.tsx` | gate → `super_admin or canAccessItOperations`; designee copy swaps the "Super Admin" framing for an "IT Operations" heading. Subscription flow untouched. |
| `app/faculty/system-reports/page.tsx` | gate → `super_admin or canAccessItOperations`; dashboard delegates unchanged. |
| `app/faculty/reports/page.tsx` | gate → `super_admin or canAccessAcademicOversight`; for heads: plain-teacher variant plus a pinned **"Your department: CAF"** banner (server enforces; client hides the department select unless super admin). |
| `app/faculty/excuses/page.tsx` | *No gate change* (heads are teachers); decision mode `user?.role !== 'teacher'` naturally allows heads; nothing else changes. |
| New `app/faculty/at-risk/page.tsx` (+ test) | Standalone at-risk list (`GET /attendance/at-risk?limit=50`), plain table with existing `StudentAtRisk` type, section filter optional (server scope permits own sections/department). Teacher dashboard widget unchanged. |
| `components/auth/SessionGuard.tsx` | maintenance branch (§7.2). |
| `components/AuthSessionMonitor.tsx` | spec'd no-change; unit test that 503 ≠ logout. |

### 7.5 Frontend tests (extensions; target ≥ 24 new cases)

- **vitest units**: `MaintenanceScreen` countdown ticking + overdue + message fallback; `MaintenanceOverlay` event → show → poll-off → clear; maintenance-event dispatch from `api-client` parser; sidebar variant matrix (5 cases); `designations-editor` submit payload + forbidden-registrar variants; settings `system` tab save/body discipline (incl. `maintenance_until` empty → `''`); `SessionGuard` maintenance state; at-risk page dedups; users page `isFullAdmin` gating of privileged affordances.
- **Playwright** (`e2e/designations-maintenance.spec.ts`, seeded accounts):
  1. IT coordinator login → Ops group + 3 items visible; opens Server Status (metrics render, ≥1 poll update); Issue Reports cockpit renders; Maintenance Controls shows the System tab; **cannot** see `/faculty/reports`/`/faculty/at-risk`, nor Audit Log/Global Search items.
  2. Department head login → sees oversight group; is **denied** `/faculty/server-status` and `/faculty/system-reports` (redirect), and sees the pinned department banner on Reports; Excuses renders the campus-wide queue; At-Risk lists student rows.
  3. Registrar login → User Management lists department-only users; password reset modal issues a copyable credential; role/add-admin affordances absent; designation PUTs are 403-asserted via `page.route` interception.
  4. Maintenance journey: super admin enables the mode at `/faculty/settings?tab=system`; a student's forced reload shows the MaintenancePage; a regular teacher attempting login sees the maintenance surface (not "invalid credentials"); IT coordinator login lands on the dashboard; `/maintenance/status` shows `enabled: true`; super admin turns the mode off; the teacher's next login succeeds.

(e2e runs against seeded designees; count target ≥ 10 new journeys incl. per-engine retries.)

---

## 8. Expo React Native (Android)

### 8.1 API client + maintenance store

```
android/services/api-client.ts           (+ classifier + ApiRequestError field `estimatedEnd`)
android/lib/maintenance.ts               (+ .test.ts)  — subscribe/snapshot store; mirrors lib/session-replacement.ts house pattern
android/lib/more-items.ts                (+ .test.ts)  — buildFacultyMoreItems(user, opts) extraction (DH-LD13)
```

- `ApiRequestError` gains `estimatedEnd?: string`; the parser detects `res.status === 503 && code === 'system_maintenance'` → **`maintenanceStore.setActive({ message, estimatedEnd })`** → throws the typed error (mirror of the `password_change_required` handling at lines 377/419, without auto-clobbering state).
- `maintenance.ts`: tiny `subscribe/snapshot` module — `getSnapshot()`, `setActive(s)`, `clear()`, `subscribe(cb)`; no persistence (app-lifetime only).
- Sync engine (`services/sync`): extend the failure classifier so `system_maintenance` is a **retryable** network-family failure — queue retained, no terminal marker, no repeated toast (coalesce: one notice per session). The existing terminal-failure tests stay green.

### 8.2 Screens

| File | Work |
|---|---|
| `app/_layout.tsx` (root) | mounts `<MaintenanceNotice/>`: when store active + user exists but is non-exempt → persistent top banner on faculty/student root screens + full-screen `AppModal` variant only when a network action fails; delegates to `components/maintenance/MaintenanceScreen.tsx` (RN twin of web: maroon surface, Animated wrench/clock via `Animated.loop` guarded by `AccessibilityInfo.isReduceMotionEnabled`, countdown, support block, admin login mailto/deep-link). |
| `(tabs)/login` screens (`login.tsx` + student equivalent) | on `isMaintenanceError(err)` render inline maintenance panel instead of the generic error alert. |
| `(faculty)/_layout.tsx` MoreSheet | consumes `buildFacultyMoreItems(user, { capabilities, pendingExcuses })` — items for designees per DH-LD13; visual pass identical (same `MoreItem` type). |
| New `app/(faculty)/server-status.tsx` (+ jest) | Lightweight parity screen: poll `GET /dashboard/server-status` every 5 s (matches web cadence) rendering the existing ServerSparkline tiles (reuse `components/` sparkline component from SA7 if exported; else a compact version) — no WS dependency, uses `useFocusEffect` + polling. Gated `useAuthGate(['teacher','super_admin'], (u) => canAccessItOperations(u))`. |
| New `app/(faculty)/at-risk.tsx` (+ jest) | list screen mirroring teacher dashboard's widget rows via `api.getAtRiskStudents({ limit: 50 })`; designation- or teacher-gated. |
| `app/(faculty)/users.tsx` | gate → `useAuthGate(['super_admin','teacher'], (u) => canAccessUserAdmin(u))`; registrar UI hides role-change/add-admin/designation editor; department filter pinned. |
| `app/(faculty)/settings.tsx` + `lib/institution-settings.ts` | gate → predicate (DH-LD12); tabs derive from the shared/mirror config which gains the `system` tab (both `android/lib/institution-settings.ts` and `frontend/src/app/faculty/settings/settings-config.ts` are edited **in lockstep** like the IS wave did — integration test asserts the two key sets stay identical); maintenance switch/message/datetime rows reuse `CampusSwitchRow`/`CampusFormField`. |
| `(faculty)/reports.tsx`, `(faculty)/excuses.tsx`, `(faculty)/system-reports.tsx` | gates widened by predicate (reports → oversight; excuses unchanged role+head flow; system-reports → IT). |
| `app/(faculty)/system-reports.tsx` gating | designee widened in `useAuthGate` predicate list. |
| `hooks/use-auth-gate.ts` | gains optional `allow` predicate `(user) => boolean` appended to role checks (DH-LD12) — existing call sites (8 screens) are **unaffected** (predicate defaults to `() => true`). |
| `app/report-issue.tsx` | intake is **blocked by maintenance** for students/teachers (`POST /reports` is a protected route) — the screen shows the preservation notice instead of a generic failure and does **not** queue (reports are non-critical; only attendance is queued). Documented as a `system_maintenance` non-queued surface. |
| Scan surfaces `(tabs)/scan.tsx` | on submission error with the maintenance code → render the MT preservation notice (§8.3 copy) and prevent repeated dialogs; screenshot/manual fallbacks remain hidden for online-mode during maintenance (`shouldShowScanFallbacks` unchanged). |

### 8.3 Preservation notice copy (exact)

> *"Polycheck is undergoing scheduled server maintenance. In-class attendance continues normally! Your offline records are securely stored on this device and will sync as soon as servers reopen."*

Rendered inside the mobile maintenance screen when the user is a **student**, and as the scan-screen rejection notice in any session where the device holds queued offline submissions. Staff variant drops the second sentence. Reduced-motion + `accessibilityLiveRegion="polite"`.

### 8.4 Android tests (target ≥ 18 new cases)

`__tests__/maintenance-store.test.ts`, `more-items.test.ts`, `use-auth-gate-predicate.test.ts`, `api-client-maintenance.test.ts` (classification incl. queue retention), `server-status.test.ts` render keys, `institution-settings-parity.test.ts` (android vs web system-tab config equality), plus update of `qr-fallback-policy`/scan suites asserting the preservation copy path.

---

## 9. Consolidated building plan (icons/copy) — the shared "suite names"

Consistent labels everywhere, verified by web/Android tests and E2E strings:

- **IT Operations Suite** — Server Status · Issue Reports · Maintenance Controls
- **Academic Department Oversight** — Department Reports · Excuses · At-Risk Students
- **Registrar Suite** — User Management

Maintenance screens: heading *"Polycheck is under scheduled maintenance"*, subline is `maintenance_message` (or `DEFAULT_MAINTENANCE_MESSAGE`), countdown chip *"Estimated resumption: HH:MM"* ticking down by minutes/hours until overdue ("Resumption is overdue — contact IT"), contact lines: Campus MIS Desk (IT Coordinator) · Office of the Campus Director (static web constant / RN constant — never fetched at runtime). Administrator Login link pinned bottom for web; mobile shows a "Faculty & IT staff can sign in above" line.

---

## 10. Phases

> Executed in order; every phase ends with the shared gates (`pnpm lint`, per-package typecheck/test runners, `pnpm build`) staying green — no dirty-land commits.

| # | Phase | Contents | Verification |
|---|---|---|---|
| DH-0 | shared contract | `types/user.ts` + `types/maintenance.ts` + `utils/designations.ts` + `validation/maintenance.ts` + `UpdateUserInput` + `ApiClient.getMaintenanceStatus` | shared suite ≥ 108 → ~124; `pnpm --filter @polycheck/shared test` |
| MT-0 | shared maintenance contracts | (folded into DH-0 commit or its own) | (same) |
| DH-1 | Prisma + auth plumbing | migration §5.1–5.2, client regen, Better Auth additionalFields, `RequestUser`, `SessionAuthenticator`, `sanitizeUser` | backend suite; migration applies on fresh Compose volume |
| MT-1 | maintenance backend core | module (service/guard/controller), AppModule insertion, AllExceptionsFilter `estimatedEnd`, settings kinds validation + `getMaintenanceState` | maintenance guard/controller specs + settings specs |
| DH-2 | backend authorization | `DesignationsGuard` + decorator, users registrar branches + designation admin-only writes, settings PUT per-key policy, attendance-scoping branches (report/at-risk/excuses/lists), server-status + SR triage widening, gateway (MT + IT), audit actions | per-suite table §6.11; container smoke script runs the deny-list matrix |
| MT-2 | auth 503 interlock | `assertLoginAllowedDuringMaintenance` on all four login methods (web + mobile) | auth.service.spec extensions |
| DH-3 | web designees | sidebar grouping; users page + designations editor; settings System tab (web config side); server-status/system-reports/reports/at-risk page gates + at-risk page | web vitest ≈ 285 → ~305 |
| MT-3 | web maintenance | api-client event + Provider + Screen/Overlay/Page + SessionGuard branch + login branches + AuthSessionMonitor test | web vitest; Compose smoke |
| DH-4 | android designees | `use-auth-gate` predicate, more-items extraction + layout consumption, users/settings/reports/system-reports screens gated by predicates, new server-status + at-risk screens | android jest ≈ 322 → ~340 |
| MT-4 | android maintenance | api-client classifier + store, login + scan notices, root banner + full-screen screen, sync retention test, report-issue notice | android jest |
| DH-5 | E2E journeys | maintenance lifecycle + dual-hat matrix journeys (`e2e/designations-maintenance.spec.ts` ≥ 10 tests); super-admin nav regression assertion kept | Chromium first (engine retries per existing config); Firefox/WebKit secondary runs |
| QE-1 | full verification | full matrix §12 + Docker rebuild + all-up smoke (migration, seeding, matrix endpoints, UI) + zero backend 5xx probes | checklist below |
| DH-6 / MT-5 | docs + closeout | AGENTS.md: Progress entry, Key Decisions (SoD matrix, maintenance fail-open, estimate-only `maintenance_until`, seed designations), Relevant Files, Critical Context (designation surfaces + maintenance contracts + smoke commands); this file's status header flips to IMPLEMENTED with per-phase notes; conventional commit(s) | manual review |

---

## 11. Invariants (regression safety)

1. **No existing test edits** — every pre-existing assertion in the 1,469 unit tests + E2E journeys must remain passing except where a suite explicitly gains *additional* cases. If a legacy test contradicts a Locked Decision above, surface the conflict to the implementer before touching the test.
2. **`admin-scope.ts` contract untouched** — super-admin scope helpers keep identical signatures and semantics; registrar logic lives in a new sibling module so all 12 consumer modules of `admin-scope` are compile-time identical.
3. **Super-admin UI byte-stability** — `studentNav`/`teacherNav`/`superAdminNav` items; the Android super tab bar (Dashboard/Users/Reports/More) and super More-sheet item set; both asserted by existing tests and the new E2E.
4. **Cron prune `MaintenanceService` untouched**; its name remains `MaintenanceService` in `common/services/` (documented disambiguation only).
5. **Principal additions are backward-inert** — all surfaces that predate designations see super admins exactly as before and teachers-without-flags exactly as before.
6. **Settings surface additive** — all prior keys keep validation and defaults; `PUT` non-maintenance-keys behavior unchanged for institution super admins; `GET /settings` visibility unchanged.
7. **No default-on behavior** — maintenance defaults `false`, designations default `false`; the entire system behaves pre-plan-identical before any super admin acts.
8. **Post-maintenance recovery is a no-op client-side** — regular clients reconnect on their own (Socket.IO backoff + SessionGuard revalidation + mobile AppState probes) after the mode is disabled; no caches to purge beyond the 60 s TTL.

---

## 12. Final Verification Matrix (QE-1)

| Gate | Command / instrument | Expect |
|---|---|---|
| Shared | `pnpm --filter @polycheck/shared test` | ~124 pass / 0 fail |
| Backend | `pnpm --filter backend test`, `pnpm --filter backend lint format:check`, typecheck | ~838 pass / 0 fail (754 + 84) |
| Web | `pnpm --filter frontend test && pnpm --filter frontend lint && build` | ~309 pass / 0 fail (285 + 24) |
| Android | `pnpm --filter @polycheck/android test lint typecheck prebuild:check` | ~340 pass / 0 fail (322 + 18) |
| Full build | `pnpm build` (turbo) | clean |
| E2E | root Playwright: Chromium first, then Firefox/WebKit on `e2e/auth.spec.ts`, `e2e/designations-maintenance.spec.ts`, hybrid regression | 0 failed; skips match engine policy |
| Compose smoke | docker compose up → migration logs; seed includes the 3 designees; API matrix below; zero backend 5xx in compose logs | all pass |
| API smoke sequence | **maintenance off:** three designees pass each suite route; non-designees get `403 designation_required` on all widened routes; students unchanged. **maintenance on:** `/health` + `/maintenance/status` 200; login student 503; login teacher 503; login IT coordinator 200; student sync batch 503 + queue retained; `GET /dashboard/admin-overview` still denied for designees; IT coordinator `PUT /settings/maintenance_mode_enabled=false` 200 → regular-user recovery within 60 s | scripted checklist (extends the API smoke pattern used in the bulk-import/system-report waves) |

Manual device checks recorded in the plan addendum after execution:
- Android: physical runbook (More sheet variants across the 3 designations, maintenance full-screen, preservation notice during online scans + offline scans, sync chip after recovery).
- Web: IT designation dark-mode pass, announcement countdown across reloads.

---

## 13. Risks, Open Questions & Pre-written Answers

| Risk / question | Disposition |
|---|---|
| Regression risk on existing specs that assert where-clause shapes for teacher scoping (AttendanceScopeService) | Designation branches are strictly additive; department head only has the designation on the 3 accounts; existing specs use plain `teacher` principals (no flags) — shapes byte-identical. Spec snapshot helper reuse documented. |
| Better Auth `additionalFields` change requires server rebuild? | No migration concept for additionalFields (Prisma owns the columns); Better Auth maps column names at runtime. Rebuild of the backend container is the standing gate anyway. |
| Guard pipeline order (3 new `APP_GUARD`s) on Nest version in use | Registration order across `AppModule.providers` is deterministic (single module); specs assert exact behavior per order; no `APP_FILTER` changes beyond forwarding land. |
| Registrar breadth — is teaching-creation too broad? | Requirement explicitly includes faculty/student account creation. Confinement: department-pinned + audit every time. If PUP policy later narrows it, disable by un-assigning the designation (no code change, no seeds change). |
| Missing `department` on a designated head/registrar | Treat as plain teacher (helpers return false / scope helpers pass-through); the users dialog forces a department before saving either flag (UI + 400 from service). |
| Should `maintenance_until` auto-disable the mode? | Explicitly rejected (MT-LD6): the timestamp is an estimate, not a kill switch — automating shutdown would silently reopen the system mid-outage. |
| 503 during active offline queue drain (edge: mode flips mid-drain) | Queue retained per MT-LD10; `classifyAttendanceSyncError` treats `system_maintenance` as retryable; nothing terminal. |
| Wider `GET /maintenance/status` abuse (scraping) | It publishes 3 fields; `@SkipThrottle()` relative to the already-present throttler; Cloudflare can cache it; harmless. |
| Audit noise from every settings write | Interceptor already records generic "PUT /settings/:key"; the targeted `system.maintenance_changed` row is added only for maintenance keys, keeping audit search precise. |
| E2E timing with countdown UI | Journeys assert presence + overdue fallback, never exact seconds; seeded `maintenance_until = now + 15m`. |

---

## 14. Success Criteria (definition of done)

1. A designated CCIS IT professor logs in once (web or Android), sees the Teaching Workspace plus exactly the IT Operations Suite, accesses Server Status live metrics, triages issue reports, and toggles Maintenance Mode on and off — **without ever seeing** excuse queues or user management.
2. A designated department head sees department-wide reports/exports, decides excuses from other teachers' sections, and reviews at-risk students of their department — without seeing server/maintenance surfaces.
3. A designated registrar manages their department's students/teachers with scoped password resets and CSV imports — without routes, UI affordances, or designation writes they should not have.
4. While maintenance mode is on: `/health/*` and `/maintenance/status` stay green; students & plain teachers hit branded 503 surfaces (web + Android) with countdown + Administrator Login; mobile shows the offline preservation notice and retains queued records; IT coordinator & super admins pass freely; the mode is disabled from Settings → System by an exempt actor and everything recovers with no client release.
5. Every test, lint, typecheck, format, and build gate stays green at each phase; the full manifest counts in §12 overshoot the baseline monotonically; AGENTS.md and this file reflect the shipped state.
---

## Implementation Notes (DH-0 … MT-4 + QE-1 closed)

Shipped phase-for-phase. Final verification executed locally against the rebuilt Docker stack:

- **Shared**: 122 tests / 9 files (designation helpers + maintenance validation/countdown parity).
- **Backend**: 845 tests / 75 suites; `lint:check`, `format:check`, and typecheck clean. New suites cover the maintenance guard/service/controller, the designations guard, designation writes + registrar scoping, department-head attendance scope, the login 503 interlock, settings maintenance kinds, and exception-filter forwarding.
- **Web**: 304 tests / 48 files; lint and `next build` clean. New coverage: sidebar suite matrix, settings System tab + IT-only visibility, MaintenanceScreen/countdown, the api-client 503 event, and the SessionGuard maintenance branch.
- **Android**: 335 tests / 27 suites; typecheck clean. New coverage: maintenance store/countdown, More-sheet designation derivation, and settings System-tab parity.
- **E2E**: new `e2e/designations-maintenance.spec.ts` 4/4 (IT isolation, head oversight, registrar scope, maintenance open/close). Full Chromium suite **104 passed / 3 skipped / 0 failed**. Firefox/WebKit were not rerun this wave.
- **Live API matrix (20/20)**: a plain teacher receives `403 designation_required` on `/users`, `/reports`, and server-status while own attendance reports stay 200; the IT coordinator gets 200 on server-status/triage but 403 on user management; the department head gets 200 on report/at-risk but 403 on telemetry; the registrar gets 200 on `/users` and `403 designations_admin_only` on a designation PATCH; the super admin passes every suite; a student is denied at-risk.

### Deviations from the draft

1. **Health probe paths**: the global `/api` prefix applies to `HealthController`, so the public probes are `GET /api/health` and `GET /api/health/ready` (unchanged and never maintenance-blocked). The draft's `/health/ready` paths were corrected in the smoke script, the E2E journey, and AGENTS.md.
2. **Seed registrar department**: `reg.campus@pup.edu.ph` is pinned to `CCIS` rather than a fictional `Registrar` department, so local demo data (all seeded students are CCIS) sits inside the registrar's scope. Production department assignment remains an institutional decision recorded in Next Steps.
3. **Cache invalidation transport**: `SettingsService` emits `settings.maintenance-changed` over the in-process `EventEmitter2`; `SystemMaintenanceService` deletes the Redis snapshot and clears its memo. This keeps `SettingsService` free of the Redis dependency (and its ESM-only client) while preserving the documented 60 s cross-instance bound.
4. **Backend oversight helper**: `common/designations/department-pin.ts` carries `academicOversightDepartment` because the attendance unit specs mock `@polycheck/shared` with an explicit whitelist; the shared `oversightDepartment` remains the client-facing source of truth.
5. **Typed login errors (web)**: `loginStudent`/`loginFaculty` now throw `ApiHttpError` (message, status, code, `estimatedEnd`) instead of a bare `Error`, which is what lets the login pages render the maintenance wall rather than an inline error string. Invalid-credential messaging is unchanged.
6. **Maintenance wall scope**: the global overlay covers only an authenticated, non-exempt session. Logged-out visitors see the login pages' embedded maintenance surface (plus the public `GET /maintenance/status` probe), so the wall can never trap someone away from the administrator login.
7. **Editor ergonomics**: the user profile dialog is now `max-h-[90vh] overflow-y-auto` because the designations section makes the form taller than a 900 px viewport.
8. **E2E enrollment hygiene**: the student enrollment journey creates a disposable student account. Instructor removal stamps a V3 `EnrollmentTombstone`, which would permanently block a reused seeded student from code enrollment after the first cleanup.
9. **No auto-off**: `maintenance_until` remains a display estimate only; the mode ends exclusively through an exempt actor's settings write.
