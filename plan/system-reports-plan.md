# System Reports & Feedback Plan — lightweight issue intake + super-admin triage

**Status:** IMPLEMENTED (SR-0 … SR-7 executed; suites/lint/builds green; Docker stack rebuilt and smoke-passed)
**Scope:** `@polycheck/shared`, `backend/src/reports`, `frontend` (cockpit + dialog + My reports), `android` (sheet + cockpit + My reports).

## Locked Decisions

| # | Decision |
|---|---|
| SR-LD1 | Audit action `admin.report.status_changed` (lowercase-dot per repo convention, replacing the draft's `admin.report.resolved`): metadata `{ from, to, title, category, severity, noteUpdated, ipAddress }`; entering `resolved` stamps `resolvedAt`/`resolvedBy`, leaving `resolved` clears them. |
| SR-LD2 | Screenshots reuse the proof-of-class storage pipeline: client sends a data URL (`screenshotData`), server decodes with `decodeImageDataUrl` (JPEG/PNG/WebP, ≤ `REPORT_MAX_BYTES` default 5 MB), stores via `ProofStorageService`, and serves bytes through `GET /api/reports/:id/screenshot` (owner or super_admin). DB `screenshotUrl` holds the storage reference; the presented `screenshotUrl` is the streaming endpoint. Storage failures fail the field, never the submission. |
| SR-LD3 | `POST /reports` + `GET /reports/my` are `student`/`teacher` only; admin routes are `super_admin`; `PATCH /reports/:id/status` requires institution scope (department-scoped super admins get a typed 403 `admin.read_only`-style message and a read-only UI). |
| SR-LD4 | Rate limits (Redis, env-tunable): create 5/hour/user; admin status/note updates 30/hour/admin. |
| SR-LD5 | New notification type `system_report_resolved` sent to the submitter when their report is resolved (web + Android icon/label maps updated). |
| SR-LD6 | Any status → any status transition is allowed (triage flexibility); validation is enum-level, not a state machine. |
| SR-LD7 | Telemetry: identity is stamped server-side from the session (never trusted from the client); `deviceInfo`/`route`/`appVersion` are client-supplied bounded strings. Web derives platform from UA; mobile uses `Platform.OS` + `Platform.Version` + `expo-constants` app version; mobile `networkType` is `unknown` this phase (no NetInfo dependency — `expo-network` would require a dev-client rebuild and is a fast-follow). Web uses `navigator.connection.effectiveType` mapped to `wifi`/`cellular`/`online`/`offline`. |
| SR-LD8 | "My Submissions" lives in the universal profile surfaces: web `/profile` gains a "My reports" tab; Android profile screen gains a "My reports" section. No new tabs/neither platform's nav bar grows. |
| SR-LD9 | Cockpit route: web `/faculty/system-reports`; Android `(faculty)/system-reports.tsx` with a super-only More-sheet entry. Submit entry points: web sidebar + profile button opening `ReportIssueDialog`; Android `More` sheet item + profile-card action opening a `report-issue` route for students/teachers. |
| SR-LD10 | Admin list filters: `category`, `severity`, `status`, `role` (student/teacher), `search` (title/description ilike), `startDate`/`endDate` (createdAt), `limit`(≤100)/`offset`. Stats compute global counts for cockpit cards. |

## Contracts

- `SystemReport` shape: `{ id, category, severity, title, description, status, deviceInfo?, appVersion?, route?, networkType?, screenshotUrl?, adminNotes?, resolvedAt?, resolvedBy?, createdAt, updatedAt, user: { id, fullName, role, studentId?, email?, department? } }`.
- Methods: `createSystemReport`, `getMySystemReports`, `getSystemReports(filters)`, `getSystemReportStats`, `getSystemReport(id)`, `updateSystemReportStatus(id, { status, adminNotes? })`.
- Endpoints: `POST /reports`, `GET /reports/my`, `GET /reports/stats`, `GET /reports`, `GET /reports/:id`, `GET /reports/:id/screenshot`, `PATCH /reports/:id/status`.
- Prisma model + enums `ReportCategory`/`ReportSeverity`/`ReportStatus`; migration `20261031120000_system_reports_and_feedback` with FK `userId → User.id` `ON DELETE CASCADE` and indexes `(userId, createdAt)`, `(status, createdAt)`, category, severity.

## Phases
- **SR-0** shared types/validation/ApiClient.
- **SR-1** Prisma schema + migration + client regen.
- **SR-2** backend module (service/controller/dto/module + audit/notification/rate limits/storage fail-open).
- **SR-3** web: telemetry lib, `ReportIssueDialog`, sidebar/profile entries, profile My-reports tab, `/faculty/system-reports` cockpit, notification maps.
- **SR-4** android: client, submit sheet + route, profile My-reports, cockpit screen, More-sheet entries, notification icon.
- **SR-5** tests: backend spec, web vitest (dialog validation + cockpit helpers), android jest (telemetry/helpers).
- **SR-6** gates: typecheck/tests/lint/format/build + Docker rebuild + API smoke (student submit → admin triage → audit + notification).
- **SR-7** docs (AGENTS.md + this file status) + commit/push to the current branch.

## Verification targets
- Backend: role/rate-limit/logging/audit/notification/presentation unit specs.
- Web: dialog validation + copy — telemetry + submit body snapshot; cockpit helpers.
- Android: telemetry builder + option/helper lists.
- Docker smoke: seeded settings unaffected; student report flow; admin triage; `AuditLog` row + notification row present.

---

## Implementation Notes (SR-0 … SR-7 closed)

- Shipped phase-for-phase: shared contract (incl. a new `@polycheck/shared/validation` export path), Prisma migration `20261031120000_system_reports_and_feedback`, `backend/src/reports` module, web `ReportIssueDialog` + profile "My reports" + `/faculty/system-reports` cockpit, Android `report-issue` route + profile "My reports" + `(faculty)/system-reports` cockpit.
- Audit action uses the repo's lowercase-dot convention: `admin.report.status_changed` with `{ from, to, title, category, severity, noteUpdated, ipAddress }` (the draft's `admin.report.resolved` is expressed through the `to: 'resolved'` metadata, so audit search still surfaces resolutions).
- Mobile `networkType` ships as `unknown` (no NetInfo; `expo-network` is a dev-client-rebuild fast-follow). Web captures `navigator.connection.effectiveType` (wifi/cellular/online/offline).
- Verification executed locally: shared 95, backend 727, web 283, Android 314; lint/format/typecheck/`pnpm build` clean; Docker rebuilt; API smoke covered student create + `GET /reports/my`, 6th-submission 429, admin filtered list + stats, resolve → `resolvedAt`/`resolvedBy` + `AuditLog` row (`open->resolved`) + `system_report_resolved` notification; `/faculty/system-reports` and `/profile` served 200. Smoke rows were removed afterwards (black-box row counts restored to 0).
- E2E journey spec `e2e/system-reports.spec.ts` added (cockpit render + profile My-reports); not executed locally (no Playwright stack run this phase) — CI coverage.
- Android `report-issue` entry points: faculty More sheet item + profile screen card (student/teacher); super More sheet gains `System Reports`.
- Deferred as planned: `expo-network` (native rebuild), department-scope row-level report scoping (system reports are institution-wide), push (VAPID) delivery, in-app screenshot viewer for proof-style full-screen zoom.
