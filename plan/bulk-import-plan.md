# Bulk Import — Super Admin Bulk Registration + Teacher Master-List Enrollment — Plan

> **Status:** Implemented (BM1–BM7). Addendum below records deviations from this plan.
> Sequenced **after** the offline-web
> PWA plan ([`offline-web-pwa-plan.md`](./offline-web-pwa-plan.md)) — M5–M6 in the overall
> rollout order. Covers **the "student has no account yet" decision** and the full
> register/enroll pipeline end-to-end.

---

## 1. Goal

Two import pipelines sharing one "bulk import core":

- **Flow A — Super Admin bulk registration**: load PUP department/campus master lists
  (CSV) and register student accounts campus-wide without typing one student at a time.
- **Flow B — Teacher master-list enrollment**: teacher imports the PUP class master list
  and enrolls the whole section in one pass (the flow that is practically impossible today:
  `findStudents` only exposes students already enrolled in one of the teacher's sections,
  `backend/src/users/users.service.ts:120-152`).

**Primary personas:** Department Super Admin (Flow A), teacher with a PUP SIS class
list export (Flow B).

## 2. Non-Goals

- No `.xlsx` parsing in v1 (CSV only — PUP lists are trivially exported; CSV also dodges
  Excel's leading-zero / date-mangling of student numbers). `xlsx` (SheetJS) is a v2 add-on.
- No self-registration for students (this stays admin/faculty-provisioned only).
- **Mobile IS included** — import ships on both platforms. Web gets the full 6-step wizard;
  mobile gets a condensed flow (paste-master-list → confirm → chunked commit), with a device
  file picker as the fast-follow. No backend changes for the mobile port (shared contract +
  JSON endpoints are role/transport agnostic); only client work in `android/`.
- No auto-provision of student accounts by teachers in v1 (see §7.4 policy ladder).

## 3. Locked Decisions (from the strategy review — not open questions)

| # | Decision |
|---|---|
| 1 | **Identity key = `studentId`** (PUP student number, regex `2024-00001-MN-0`). Email deduped only when present; login stays student-number-based (`backend/src/auth/auth.service.ts:97-140`). |
| 2 | **Passwords are server-generated, never typed by admins** for bulk rows. Returned once in the report / credentials CSV; satisfy the existing policy (12+ upper/lower/digit/symbol, `backend/src/users/dto/manage-user.dto.ts:16-25`). |
| 3 | **Client-side parsing** on the web (JSON chunk uploads) — the API stays JSON-only and multipart stays out (matches the proofs base64 pattern, `backend/src/main.ts:21-23`; no multer surface). |
| 4 | **Two-phase commit**: validate (dry-run) → confirm (execute). No half-imported lists. |
| 5 | **Chunked transactions**: ~250 rows per request; transaction per chunk (not per row, not whole file); batch re-runs are safe because existing studentIds skip (idempotent). |
| 6 | **Flow A through BullMQ** when campus-wide (thousands of rows — bcryptjs hashing blocks the event loop ~50–100 ms/student); small department batches run inline. The BullMQ posture mirrors `backend/src/sync/sync.service.ts` (Redis required in production, inline fallback in dev). |
| 7 | **Student has no account yet:** v1 **strict** — flag the row `STUDENT_NOT_FOUND` and require a Super Admin import first. v2 (optional institution setting) lets a *teacher* auto-create a **minimal, inactive** account from the master list; it stays un-loginable until activated. |
| 8 | **Import ships on both platforms** (parity rule from the mobile improvement plan): web full wizard first, mobile condensed import right after the backend milestones it depends on (BM2 → super admin import, BM4 → section import). Mobile uses the same chunked JSON endpoints — no new API surface. |
| 9 | **Sequencing**: this plan runs **after** the offline PWA plan because offline rewrites `frontend/src/lib/api-client.ts` + adds the IndexedDB layer that import's resumable chunk logic will sit on. |

## 4. Verified Current State (facts)

| Fact | Evidence |
|---|---|
| Single-record create only today; conflict → whole-request `409` | `backend/src/users/users.service.ts:154-260`; `users.controller.ts:35-45` |
| Asserts department scope for creators; department-scoped admins limited to own department | `users.service.ts:338-342`, `backend/src/common/admin-scope.ts` (`adminCanAccessUser`) |
| User + AuthAccount(Better Auth credential) + hash created atomically | `users.service.ts:217-240` |
| Enrollment is per-student with `pg_advisory_xact_lock` + `@@unique([studentId, sectionId])` + `studentCount` increment in the same transaction | `backend/src/sections/sections.service.ts:377-399`, `backend/src/common/student-section-lock.ts`, `backend/prisma/schema.prisma:192-203` |
| Teacher enrolls only in own sections (`section.teacherId !== teacherId` guard) | `sections.service.ts:258-272` |
| Bulk precedent pattern: validate up front → one `$transaction` of creates → realtime emit after | `backend/src/sessions/sessions.service.ts:100-162` |
| BullMQ infra exists (`attendance-sync`, concurrency 20, inline dev fallback) | `backend/src/sync/sync.service.ts` |
| Request body limit is JSON, proof-derived | `backend/src/main.ts:21` — `MAX_PROOF_BYTES * 4/3 + 100 KB`; import chunks must stay small (§10) |
| IdempotencyInterceptor caches responses ≤ 64 KB and stores terminal overshoot markers | `backend/src/common/interceptors/idempotency.interceptor.ts` |
| AuditInterceptor auto-audits every mutating request | `backend/src/common/interceptors/audit.interceptor.ts` |
| Rate limiting: global distributed per-user guard (`PER_USER_RATE_LIMIT`, env-tunable) + login-specific identity/IP limits | `backend/src/common/guards/distributed-rate-limit.guard.ts`, `backend/src/auth/auth.service.ts:267-271` |
| Institution settings have a strict key allowlist (`INSTITUTION_SETTING_KEYS`) | `backend/src/settings/settings.service.ts:11` |
| Institution-scoped admin user delta: `scope: 'institution' | 'department'` in `adminScope` | `backend/src/common/admin-scope.ts:19-22` |
| Super admin Users UI exists on web and mobile; single-create dialogs today | `frontend/src/app/faculty/users/page.tsx`, `android/app/(faculty)/users.tsx` |
| Section-detail "Enroll Student" search panel exists (web + mobile) | `frontend/src/app/faculty/sections/[id]/page.tsx:249-315`, `android/app/(faculty)/sections/[id].tsx` |
| No CSV parsing library installed anywhere; export-only CSV exists (hand-built, escaped/formula-injection-safe) | `frontend/src/lib/api-client.ts:433`, `backend/src/dashboard/dashboard.service.ts:168-200`, `documentation/bug-audit-2026-10-08.md:370` |
| Student scan fallback import paths go through image decode — **not** reusable for master lists | `frontend/src/components/scan-qr/*` (reference only) |

## 5. Shared Contract Additions (`@polycheck/shared`)

```ts
// src/types/bulk-import.ts
export type ImportMode = 'validate' | 'execute'
export type ImportConflictMode = 'skip_existing' | 'update_existing'   // A only
export interface StudentImportRow {
  rowNumber: number
  fullName: string
  studentId: string          // normalized at parse time
  email?: string
  program?: string
  yearLevel?: number
  department?: string
}
export interface EnrollImportRow {
  rowNumber: number
  studentId: string
  studentName?: string       // verification only, never stored from list
  expectedProgram?: string   // verification warning if mismatched
  expectedYearLevel?: number
}
export type ImportIssueCode =
  | 'MISSING_REQUIRED_FIELD' | 'INVALID_STUDENT_NUMBER' | 'INVALID_EMAIL'
  | 'DUPLICATE_IN_FILE' | 'YEAR_LEVEL_OUT_OF_RANGE' | 'PROGRAM_TOO_SHORT'
  | 'DEPARTMENT_MISMATCH' | 'EXCEL_MANGLED_STUDENT_NUMBER'
  | 'STUDENT_NOT_FOUND' | 'STUDENT_INACTIVE'
  | 'ALREADY_ENROLLED' | 'ACCOUNT_ALREADY_EXISTS' | 'FIELD_UPDATE_PREVIEW'
  | 'PROGRAM_YEAR_MISMATCH'
export interface ImportIssue { rowNumber: number; column?: string; code: ImportIssueCode; message: string }
export interface StudentImportResult {
  mode: ImportMode
  conflictMode: ImportConflictMode
  rowChecksum: string                    // ties execute to the validated row-set (§10)
  summary: { total: number; valid: number; new: number; update: number; skip: number; invalid: number }
  issues: ImportIssue[]                  // capped at 50 in the response payload
  hasMoreIssues: boolean
  credentials?: { rowNumber: number; studentId: string; tempPassword: string }[] // execute-only, once
}
export interface EnrollImportResult {
  mode: ImportMode
  rowChecksum: string
  summary: { total: number; valid: number; enrollable: number; skip: number; invalid: number; provisioning?: number }
  issues: ImportIssue[]
  hasMoreIssues: boolean
}
export interface ImportChunkResult {
  chunkIndex: number; created: number; updated?: number; skipped: number; failed: number
}
```

New `ApiClient` methods (callers on **both** platforms; mobile implements the same
contract in `android/services/api-client.ts`):

```ts
// Flow A
importStudentsChunk(data: {
  mode: ImportMode; conflictMode: ImportConflictMode
  rows: StudentImportRow[]; idempotencyKey: string
}): Promise<StudentImportResult>

// Flow B
previewEnrollImport(sectionId: string, rows: EnrollImportRow[]): Promise<EnrollImportResult> // read-only dry run
importSectionEnrollmentsChunk(
  sectionId: string,
  data: { mode: ImportMode; rows: EnrollImportRow[]; idempotencyKey: string },
): Promise<EnrollImportResult>
```

Validation schemas mirroring the backend DTOs live in `shared/src/validation` (today only a
class-validator DTO exists, `backend/src/users/dto/manage-user.dto.ts` — zod additions land here
so the web client can pre-validate identical rules).

## 6. Flow A — Super Admin Bulk Registration

### 6.1 Endpoint design

```
POST /api/users/students/import?mode=validate|execute
@Roles('super_admin') + assertDepartmentScope (department admins: rows must match
their department — casewise-insensitive match, no silent creation of new departments)
Body: { rows: StudentImportRow[] (≤ CHUNK_SIZE=250), conflictMode, idempotencyKey }
```

- `mode=validate`: responds with per-row issues + the preview summary
  `{ new: n, existing: m, invalid: k }` and — in `update_existing` mode — field diffs
  before/after per row (`FIELD_UPDATE_PREVIEW`). No writes.
- `mode=execute`: creates the new rows only (existing are honored per `conflictMode`),
  returns per-chunk result rows.

### 6.2 Atomicity & concurrency

- **Inherent per-row keys make chunks idempotent**: `studentId` unique on `User`
  (`schema.prisma:42`). Re-running a failed chunk safely skips created rows.
- Chunk execute = one `prisma.$transaction`: `User.createMany` (all-new rows) then one
  `AuthAccount.createMany` (same id mapping, `authEmail: u-<uuid>@auth.polycheck.invalid`
  generated per row — collision-free by construction), plus `hash()` per password.
- `createMany` over the `User` table does **not** cascade-relate `AuthAccount` — the two-step
  within one transaction is deliberate and keeps per-row round-trips out (construction cost is
  dominated by bcrypt anyway).
- Any prisma error inside the chunk → whole chunk fails; client re-requests `mode=validate`
  to recompute the remaining rows; nothing partial is visible.

### 6.3 Passwords & credential artifact

- Server-generated per row (crypto random); single display opportunity:
  - `mode=execute` response carries `credentials: [{ rowNumber, studentId, tempPassword }]`
    **once, only in the same response** — never persisted, never resendable; a lost
    download requires the `/users/:id/password` reset flow (`users.service.ts:262-297`).
- Downloadable **credentials CSV** built client-side in the wizard (marked clearly:
  "Print/hand out; do not email"). Field list matches the single-create protocol teachers already know.
- `mustChangePassword` (forced first-login rotation) — see Open Decisions (§15.A).

### 6.4 BullMQ path (campus-wide imports)

- Threshold documented in-code (e.g. > 1 chunk or explicit "run in background" checkbox):
  `users-import` queue (same pattern as `attendance-sync` — producer/events/worker,
  metrics gates optional):
  - enqueued job = validated batch; worker executes chunk(s) sequentially; job result = summary only
- Frontend polls a new `GET /users/students/import/jobs/:id` for progress — non-blocking browser
  tab even at 3,000+ rows. If Redis absent (dev), inline path runs the same service function.

### 6.5 Audit, metrics, persistence

- `AuditInterceptor` covers the request; the service additionally writes
  `AuditLog.metadata.importSummary = { created, skipped, failed, conflictMode, rowCount }`
  (counts + issue codes only — **never row personal data**).
- Metrics: `polycheck_import_rows_total{kind="student_registration"|"section_enrollment", outcome}`.
- Optional minimal `ImportBatch` Prisma model (kind, actorId, department, counts, metadata JSON
  with failed-row excerpts + checksum) — "what happened to row 47?" capability. Recommended;
  see Open Decisions (§15.B).

## 7. Flow B — Teacher Master-List Enrollment

### 7.1 Endpoint design

```
POST /api/sections/:id/enrollments/import?mode=validate|execute
@Roles teacher section-owner (same ownership guard as enrollStudent)
Body: { rows: EnrollImportRow[], idempotencyKey }
```

### 7.2 Per-row semantics

| Row state | mode=validate | mode=execute |
|---|---|---|
| Student exists, `isActive` | preview "will enroll" | upsert enrollment |
| Student exists, inactive | `STUDENT_INACTIVE` issue | block row |
| Already enrolled (`@@unique` pair) | `ALREADY_ENROLLED` preview skip | skip (idempotent) |
| **No account** | `STUDENT_NOT_FOUND` issue | **v1: block row** · **v2 setting on: auto-provision inactive** |
| Program/year mismatch vs list | warning (`PROGRAM_YEAR_MISMATCH` soft issue, never blocks) | enroll + warn |

### 7.3 Bulk transaction & locking (scale-up of the existing pattern)

One `execute` chunk = one transaction:

1. Take **section-level** advisory lock once (adapt `lockStudentSection` →
   `lockStudentSectionInBatch(tx, sectionId)` — hash on `sectionId` only) so concurrent
   enroll-code joins/self-enroll for the same section serialize safely.
2. Re-check section ownership + roster member set inside the transaction (mid-import
   removal/sync can't produce phantom rows — mirrors the late-enrollment roster fix).
3. `Enrollment.createMany({ skipDuplicates: true })`.
4. `studentCount` corrected to `count(*)` of enrollments at close (single update, replaces N increments).
5. SectionRoles/idempotency: no roles are created from imports (president/QAC stays manual).

### 7.4 No-account policy ladder (locked in strategy review)

- **v1 (default): strict.** `STUDENT_NOT_FOUND` rows are reported; enrollment proceeds for
  found rows; UI legend: "Ask your Super Admin to import the department roster first."
- **v2 (opt-in): auto-provision of minimal, inactive accounts.** New institution setting
  `allow_teacher_student_provisioning` added to `INSTITUTION_SETTING_KEYS` (true/false string).
  When on, missing rows create:
  `User{ role:'student', studentId, fullName, program, yearLevel, isActive:false, department:<section.teacher.department> }`
  + AuthAccount with server-generated temp password. **No email required. Students cannot
  log in until the department super admin activates them** (`setUserStatus` — sessions
  never held because none existed). Audit `entityType: user` action=`bulk_provision` per row.
- Activation UX: super admin Users page gains an "Inactive (provisioned)" filter chip;
  bulk activate = existing `setUserStatus` loop is fine for tens, N rows per chunk otherwise.

### 7.5 Where it lives

- **Web:** section detail `sections/[id]/page.tsx` — "Enroll Student" panel gains
  "Import from master list" toggle → wizard component shared with Flow A.
- **Mobile:** section detail `(faculty)/sections/[id].tsx` — same panel gains "Import from
  master list" → condensed import flow (§13). The roster refreshes automatically through
  `getSectionStudents` after commit.

## 8. Parsing & Column-Mapping Layer (frontend)

`frontend/src/lib/import/parse.ts` + `map.ts` (+ `normalize.ts`):

- **Parser:** `papaparse` (browser, JSON-clean); inputs via `<input type=file>` + drag&drop;
  5 MB / 5,000-row cap enforced client-side per file.
- **Column dictionary:** canonical fields (`studentNumber`, `fullName`, `email`, `program`,
  `yearLevel`, `section` (ignored, context is the UI target), `sex` (ignored), …).
- **Auto-mapping:** case-insensitive trigram match over common PUP SIS headers
  (`"Student Number"`, `"Student No."`, `"SN"`, `"NAME"`, `"Surname, First M."`, `"YR&SEC"`…)
  — worker always confirms the mapping visually; mapping remembered per admin in localStorage.
- **Normalization:** trim; `studentId` → uppercase; strip thousands separators if numeric;
  year words ("1st Year") → int; program preserved verbatim (2–150 chars).
- **Excel-mangling detector:** numeric-only or date-shaped `studentId` values flagged
  `EXCEL_MANGLED_STUDENT_NUMBER` with copy explaining "re-export the CSV with the SN column
  formatted as text".

## 9. Wizard UX (both flows)

```
[1 Upload]  →  [2 Map columns]  →  [3 Validate (dry-run)]  →  [4 Confirm]
      →  [5 Commit (progress bar, 'stop after this chunk')]
      →  [6 Report (per-chunk results, failed-row drill-down, downloads)]
```

- Step 3/4 shows: total / valid / will-create / will-skip / will-update (A: with diff) / issues
  table (row + code + message), max 50 issues visible + "download issues CSV".
- Step 5: sequential chunk sends; a "stop after current chunk" control; progress = chunks done / total.
- Step 6: credentials CSV (A) + a failed-rows CSV for retry (both flows). Errors after commit surface as a
  single recoverable summary; tied into `useNotifications` toasts (web).
- Accessibility + sizing follow existing dialogs (`components/ui/dialog.tsx` patterns), plus
  `role="alert"` error surfaces like the users page template.

## 10. Retries, Idempotency & Limits

- Every chunk sends an `Idempotency-Key` (uuid); the existing interceptor replays the cached
  response on retry — note the **64 KB cache cap**: per-row result rows kept terse so results
  remain caching-friendly and body-limit-safe (250-row chunk result ≈ ~25–50 KB).
- Client retry semantics: on network failure mid-commit → automatically re-run `mode=validate`
  first (fresh server-side truth), then resume only the remaining rows.
- Rate limiting: 2,000-row single-import = 8 chunk requests — trivial vs the per-user guard;
  no special exemption requested, no bypass (the guard stays enforced on import routes).
- `mode=execute` enforces a validate→execute binding: the execute request must carry the same
  `conflictMode` and the `rowChecksum` returned by the validate call, and the row set is
  re-hashed server-side — anything that moved between preview and commit aborts before writing.

## 11. Privacy & Data Handling

- Parsed file rows live only in the browser; no raw file upload, no server-side master-list persistence (§15.B optional schema stores counts + excerpts only, never full PII rows).
- Credentials CSV = the most sensitive artifact: printed template recommended; never attached
  to email; never logged.
- Sentry/addons: import failures log counts + sample issue codes only (existing
  strip-bodies policy, `documentation/PRODUCTION_DEPLOYMENT.md:63`).
- Students bulk-created by Flow A hit the existing `PrivacyConsentGate` on first login —
  zero changes to consent flow.

## 12. Testing Strategy

| Layer | Coverage |
|---|---|
| Parser/mapper/normalizer (Vitest) | golden CSV fixtures: PUP-style headers, `EXCEL_MANGLED_STUDENT_NUMBER`, dup-in-file, multiline names, BOM/CRLF, 5k-row boundary |
| Backend service (Jest) | chunk atomicity (simulated mid-chunk failure → nothing persists), idempotent re-run, dept-scope enforcement, department mismatch, `field_update_preview` diffs, `studentCount` correctness after skip-provision chunks, advisory-lock serialization test, `STUDENT_NOT_FOUND`/v2 provisioning behavior + activation gating, existing `conflictMode` skip-vs-update semantics |
| Controller DTO (Jest) | class-validator DTOs mirror the zod schemas: row counts, issue shapes, `mode`/checksum contract |
| Wizard E2E (Playwright) | full happy path (fixture CSV → map → validate → execute → report + credentials download), conflict path, v2 auto-provision path, job-progress path |
| Load (script) | 2,000-row synthetic CSV: inline vs BullMQ timing, request waterfalls, DB pool saturation watched (`connection_limit` env respected) |

## 13. UI Placement Summary

| Surface | Addition |
|---|---|
| `frontend/src/app/faculty/users/page.tsx` | "Import Students" button → Flow A wizard |
| `frontend/src/app/faculty/sections/[id]/page.tsx` | "Import from master list" inside the Enroll Student panel → Flow B wizard |
| `frontend/src/app/faculty/users/page.tsx` (v2) | "Inactive (provisioned)" filter chip + bulk activate |
| `android/app/(faculty)/users.tsx` | "Import students" action in the Add sheet → condensed Flow A import (§13.1) |
| `android/app/(faculty)/sections/[id].tsx` | "Import from master list" inside the enroll directory → condensed Flow B import (§13.1) |
| `android/app/(faculty)/users.tsx` (v2) | inactive/provisioned filter + bulk-activate in the account list |

### 13.1 Mobile condensed import UX (both flows)

The phone screen is the same wizard, flattened. Reuses the shared contract + endpoints 1:1 —
the only new native surface is input acquisition:

1. **Input (v1 — paste-first):** a multiline `TextInput` ("Paste master list from Sheets/Files
   as CSV") reading the clipboard as default suggestion; **v1.1 — file import:**
   `expo-document-picker` (new dep, single plugin, no config keys) →
   `expo-file-system.readAsStringAsync` → same parser. `papaparse` is pure JS and runs in
   React Native unmodified — parse/normalize/mapping logic ships **once** in a shared module
   (either in the web `lib/import/*` moved to `@polycheck/shared/import` or duplicated with
   golden-fixture parity tests; recommendation: promote to shared).
2. **Map/verify:** column-mapping confirmation sheet (same dictionary), live preview count
   ("312 valid · 9 will be skipped"), issue list capped + "view all".
3. **Commit:** persist-inserted chunk sequence with progress bar and "stop after this chunk";
   same idempotency-key + validate→execute binding.
4. **Report:** per-chunk result summary sheet; failed-rows copy-back +
   **credentials artifact**: reuse the existing `android/services/file-sharing.ts` share
   pipeline (native share sheet) with the same "print/hand out — never message/email" warning;
   clipboard copy fallback via existing `expo-clipboard`.

Offline note: imports remain **online-only** on mobile too — the queue exists for scans, not
for admin mutations (parity decision documented in §10).

## 14. Milestones (BM1–BM7)

| ID | Scope | Key acceptance |
|---|---|---|
| **BM1 — Contract** | `shared` types + zod schemas + `ApiClient` methods; `papaparse` dep; parser/mapper/normalizer with fixture tests | golden fixtures pass; web components typecheck |
| **BM2 — Backend Flow A** | `/users/students/import` (validate+execute inline), chunk transaction, generated passwords, dept scope; BullMQ job path + job-status GET; audit/metrics | Jest suite for atomicity/idempotency/scope passes; 2k-row load script within limits |
| **BM3 — Super admin wizard (web)** | full 6-step wizard on Users page + credentials CSV + issues CSV + conflict modes + diff preview | Playwright happy + conflict paths pass |
| **BM4 — Flow B + section import (web)** | `/sections/:id/enrollments/import`, batch advisory lock, `studentCount` reconciliation, hook into section page | Jest lock/counter tests + section-page E2E pass |
| **BM5 — v2 policy pack** | `allow_teacher_student_provisioning` setting, inactive auto-provision, activation filter/bulk in Users UI (both platforms for the activation UI), settings docs | Jest setting-guard tests; E2E provision→activate→login flow |
| **BM6 — Mobile equivalents** | shared parser promotion, `expo-document-picker` + FileSystem read, condensed import in `users.tsx` (Flow A, after BM2) and `sections/[id].tsx` (Flow B, after BM4), credentials share via `file-sharing.ts`; jest tests for the chunker + maestro flow `04-bulk-import.yaml` (paste path); import surfaces match §13.1 | jest + maestro pass; no backend delta required |
| **BM7 — Polish** | `ImportBatch` model (if §15.B decided yes), job progress UX, load test tune, docs + AGENTS.md parity note | audit page shows import entries with summaries |

## 15. Open Decisions (must be resolved before BM1)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| A | Forced first-login change vs credentials-CSV-only | (1) add `User.mustChangePassword` + login flow force; (2) CSV-only, reset password exists | **(1)** — safer at 5k students; cost: one column + one login-step screen |
| B | Persist `ImportBatch` rows server-side | (1) minimal model + retention; (2) rely on AuditLog metadata only | **(1) minimal** — resumable admin conversations across devices; retention 90 days |
| C | Max rows per file / per job | 2,000 / 5,000 / unlimited | **5,000** with BullMQ mandatory above 2,000 |
| D | Auto-provision department source | section teacher's department (v2) | confirmed — no row-level override in v2 |
| E | Whether Flow A may also enroll (master lists often are class lists) | optional target-section flag reusing Flow B | **defer** — keep flows clean v1; re-evaluate after pilot feedback |

## 16. References

- Backend: `backend/src/users/**`, `backend/src/sections/**`, `backend/src/sync/sync.service.ts`
  (BullMQ shape), `backend/src/settings/settings.service.ts` (setting registry),
  `backend/src/common/{admin-scope,student-section-lock}.ts`, `prisma/schema.prisma`
- Frontend: `frontend/src/lib/api-client.ts`, `frontend/src/app/faculty/users/page.tsx`,
  `frontend/src/app/faculty/sections/[id]/page.tsx`
- Shared: to-be `shared/src/types/bulk-import.ts`, `shared/src/validation` additions,
  parser/mapper promoted to shared for the mobile port (BM6)
- Mobile: `android/services/api-client.ts` (implements the new shared methods),
  `android/services/file-sharing.ts` (credentials CSV share), `android/app/(faculty)/users.tsx`,
  `android/app/(faculty)/sections/[id].tsx`, `android/maestro/flows/04-bulk-import.yaml` (new)
- Related plans: [`sync-plan.md`](./sync-plan.md) (BullMQ posture),
  [`api-services-plan.md`](./api-services-plan.md) (endpoint conventions),
  [`auth-plan.md`](./auth-plan.md) (credential creation),
  [`offline-web-pwa-plan.md`](./offline-web-pwa-plan.md) (sequencing dependency),
  [`mobile-improvement-plan.md`](./mobile-improvement-plan.md) (parity rule + release hygiene).

---

## 17. Implementation Addendum

- **Decisions resolved:** A = forced first-login rotation (implemented, web + mobile);
  B = `ImportBatch` persisted with 90-day opportunistic retention; C = 5,000 rows/file with
  250-row chunks; D = teacher's department; E deferred.
- **Endpoints shipped:** `POST /api/users/students/import` (body `mode`, optional
  `?background=true`), `GET /api/users/students/import/jobs/:id`,
  `POST /api/sections/:id/enrollments/import` (teacher only).
- **Contract note:** execute requires the `rowChecksum` returned by validate; the server
  recomputes it from normalized rows and returns 409 `import_checksum_mismatch` otherwise.
- **Background queue:** `users-import` BullMQ queue with inline dev fallback. Worker excludes
  credentials from Redis job return values; for the background path only, credentials are staged
  in Redis for a single 5-minute one-time retrieval. The web wizard uses inline chunks, so
  credentials normally travel only in the execute response.
- **Flow B provisioning:** guarded by `allow_teacher_student_provisioning` (default `false`).
  Provisioned accounts are inactive with `mustChangePassword=true`; no credentials are returned
  to teachers — activation stays with a Super Admin.
- **UI:** web `BulkImportDialog` reused for both flows (upload/map/validate/confirm/report,
  stop-after-chunk, retry remaining, credentials/issues/failed-row CSV downloads). Mobile
  `BulkImportSheet` is paste-first (clipboard/TextInput) because adding `expo-document-picker`
  would require a native rebuild before the imminent store release; file-picker parity is the
  documented follow-up.
- **History:** import summaries are visible in the existing audit log (`bulk_import`,
  `bulk_enrollment_import`) and `ImportBatch`; a dedicated import-history screen was not added.
- **Not run here:** the 2,000-row load script (needs Postgres/Redis load harness) and Playwright
  import E2E (needs the seeded backend); Jest coverage for atomicity/checksum/scope/locking and
  all mobile tests pass.
- **E2E spec:** `e2e/import.spec.ts` covers the super-admin validate flow and the teacher roster
  import entry point; it was compile-checked (`playwright test --list`) but not executed locally
  because it requires the seeded backend + web stack.
