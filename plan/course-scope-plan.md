# Polycheck Course-Based Scope Plan (replacing "Department" for PUP Santa Maria)

> **Status:** Proposed (2026-11-25). Nothing in this document has been implemented.
> Companion to `plan/campus-designations-and-maintenance-plan.md` (the designation model this plan re-scopes),
> `plan/course-section-session-fixes-plan.md` (shipped `Section.course` + catalog),
> `plan/master-list-import-and-activation-plan.md` (imports that must produce clean course values) and
> `plan/account-governance-plan.md`.
>
> **Reader's ground rules:** claims marked **verified** were read from source in this repo while writing this
> plan. Unmarked items are design intent. Items marked **TO VERIFY / TO CONFIRM** need a fact from outside the
> repo (mostly the registrar's real program list) before they are coded.

---

## 0. Executive Summary

**Problem.** PUP Santa Maria has no academic departments. It has **courses (degree programs)** and a
**head professor per course**. (Student organisations such as ISITE/ACES/HMSOC are communities, **not**
part of the data model and are deliberately excluded from this plan.) Polycheck was built around
`User.department`, so heads, registrars and some admin scopes are pinned to a department string that does not
exist on this campus (the seed puts everyone in `CCIS`; students default to `Unspecified`).

**Decision (what I recommend for PUP Santa Maria):** make **course** the scoping concept, and do it as a
**scope re-pointing, not a rename**.

| # | Decision | Why |
|---|---|---|
| D1 | **Course identity = the catalog program code** (`BSIT`, `BSHM`, …). Students carry it on `User.program`; sections on `Section.course` (both already exist). | No new identity concept; both columns exist and are already shown in the UI. |
| D2 | **Heads are scoped by the *section's course*, not by the teacher's department.** A course head sees sections whose `course` is in their managed list. | A teacher can teach several courses; one department string cannot represent that. It also means an irregular BSHM student sitting in a BSIT section is visible to the BSIT head — where the class actually happens (verified current behavior is teacher-department based, see §2). |
| D3 | **Two additive fields carry the scope:** `User.managedCourses String[]` and `User.managesAllCourses Boolean`. | Supports "one head, one course", "one head, several courses" and "Head of Academic Programs, all courses" without a new role. |
| D4 | **Head of Academic Programs = a Course Head with `managesAllCourses = true`.** No new designation flag. | Honors the owner's rule: *no more roles; use the dual-hat designations.* |
| D5 | **Registrar is campus-wide by default** (`managesAllCourses = true`); a registrar may optionally be pinned to courses (students by `program`). Teacher-account administration, role changes and designation edits stay all-courses/super-admin only. | A registrar's office serves every program; course pinning is only for program coordinators who are given the user-admin designation. Empty scope stays **fail-closed**. |
| D6 | **Heads keep today's powers, now course-scoped:** read reports/attendance/at-risk, decide excuses, file/advance CHED referrals. **No classroom writes** (sessions, sections, enrollment) — unchanged oversight policy. | Preserves shipped behavior and the read-only principle for oversight accounts. |
| D7 | **Internal identifiers keep their legacy names** (`isDepartmentHead`, `department` column, `/admin` wire fields). Only **labels** change ("Course Head", "Head of Academic Programs", "Course"). | `department` has ~700 mentions in backend, ~450 in Flutter and shared wire models; a rename before the defense is pure risk. Naming debt is documented and scheduled post-defense. |
| D8 | **Super-admin `scope: 'department'` is deprecated, not removed.** New accounts are `institution`; `admin-scope.ts` stays byte-identical. | It is load-bearing in 12 modules and the DB check constraint allows it; breaking it buys nothing. |
| D9 | **Catalog: single shared constant for v1 = the eight programs published on the official PUP Sta. Maria page (§4.1); a registrar sign-off confirms it before release; DB-backed editable catalog is phase 2.** | The current constant is a *draft* with colleges (Engineering, Business, …) this campus does not have. Controlled values matter more than editability for the defense. |
| D10 | **Safe switch:** `COURSE_SCOPE_MODE=legacy\|course` (env, default `legacy`) selected inside one helper; rollback = flip the env. | Course scoping touches data-visibility rules; it must be reversible without a deploy. |

**Non-goals:** renaming DB columns/wire fields; removing `User.department`; changing super-admin institution scope
semantics; touching attendance/scan/ingest/sync/ledger; the legacy RN `android/` app.

---

## 1. Scope

### 1.1 In scope
- Course catalog correction + normalization helper (aliases → code).
- `managedCourses` / `managesAllCourses` fields, migration, backfill of existing designees.
- One backend course-scope module replacing every `academicOversightDepartment` / `registrarDepartment` use.
- Course filters (reports, at-risk, dashboards, Users console) alongside the existing section filters.
- Users console: designee editor (course multi-select + "All courses"), labels.
- Import/enrollment/section/user forms: course instead of department; auto-fill of the legacy `department`.
- Web + Flutter label and capability updates; shared helpers; tests; rollout; rollback.

### 1.2 Out of scope
| Item | Reason |
|---|---|
| Column/wire rename (`department` → `course`) | Cross-client break risk; see D7. |
| New roles/designations | Owner rule. |
| Per-student "home course" oversight view (head sees *their* students taking other courses' subjects) | Section-based oversight is the primary model; offer later if heads ask. |
| DB-backed course catalog UI | Phase 2 (§9 M9). |
| Removing department-scoped super admins | Deprecated only (D8). |

---

## 2. Verified baseline

| Fact | Evidence |
|---|---|
| `Section.course` exists (nullable string), required by the web create-section form, shown across many screens. | migration `20261110120000_section_course`; `plan/course-section-session-fixes-plan.md` |
| Course catalog is a shared constant labelled **DRAFT**; it groups by a "department" key and includes Engineering/Education/Industrial Technology entries. | `shared/src/constants/pup-courses.ts` |
| Students are **required** to have `program`, `yearLevel` **and** `department` (DB check); teachers require only `email`; super admins require `scope ∈ {department, institution}` and a department when scoped. | `20260907090000_domain_constraints/migration.sql`, `User_role_fields_valid` |
| Imports default a student's `program` and `department` to `'Unspecified'` when the list omits them. | `student-import.service.ts` `DEFAULT_PROGRAM`/`DEFAULT_DEPARTMENT` |
| **Head oversight is scoped by the *section teacher's* department**: `section: { teacher: { department: { equals: head.department } } }`. Not by student department, not by `Section.course`. | `backend/src/attendance/attendance-scope.service.ts` (`recordScope`, `sessionScope`, `filteredSessionScope`) |
| A head with no department gets no oversight (`academicOversightDepartment` returns null). Registrar without department gets nothing (fail-closed). | `common/designations/department-pin.ts` |
| Registrar scope pins account queries to `User.department`; registrars force their own department on creation. | `department-pin.ts`, `users.service.ts` (~12 call sites) |
| Scope helpers are used by: `users.service` (12), `attendance-scope` (6), `docs.service` (5), `attendance-referral` (5), `student-import` (4), `dashboard.service` (4), `student-import-queue` (3), `attendance.service` (3), `section-roles` (2), `attendance-at-risk` (2), `admin-scope` (2), shared `designations.ts` (1). | repo grep of `academicOversightDepartment\|oversightDepartment\|registrarDepartment\|registrarUserWhere\|registrarCanAccessDepartment\|accountAdminScope\|adminDepartment` |
| `department` footprint: backend 704 mentions / 32 non-test files; frontend 226 / 18; shared 93 / 12; Flutter 445 / 39; e2e 42 / 2; ingest 0. | repo grep |
| Seed puts every demo account in `CCIS`; seed designees: `bry.mis` (IT), `chair.ccis` (head), `reg.campus` (registrar). | `backend/prisma/seed.ts` |
| `admin-scope.ts` is the shared super-admin scope source for 12 modules; its department semantics must not shift. | header comment of `common/admin-scope.ts`; AGENTS.md |
| Wire contracts are consumed by Flutter freezed models: unknown **enum** values fail loud; extra JSON keys are ignored. | DD-C3 lesson (`defense-day-bugfix-plan.md`) |

**Operating context (from the owner):** no departments on campus; a head professor per course (student
organisations are communities and out of scope); some professors also act as IT/HM advisers and should see how
"their" course is doing (attendance rate, at-risk); solo developer; deadline Dec 4–5, 2026; 2-core server.

---

## 3. Guardrails — what must NOT change

1. **No wire/contract breakage.** `department`, `isDepartmentHead`, `scope`, `/users` and report payloads stay
   as they are. New fields are additive and optional. **No new enum values** that Flutter switches on.
2. **`admin-scope.ts` is untouched.** Institution super-admin behavior is byte-identical.
3. **Students are never blocked by course.** A student's program never restricts which sections they can be
   enrolled in (irregular loads, retakes, shifting — see master-list plan §4.10).
4. **Fail-closed.** A head/registrar with no courses sees/administers nothing (as today with no department).
5. **No classroom writes for oversight accounts.** Heads and the Head of Academic Programs cannot create/update/
   delete sessions, sections, enrollments, QR/PIN, or proofs.
6. **Attendance, scan, ingest, sync, ledger, hash chain, device integrity, auth/session policy: zero changes.**
7. **Existing designees keep working at cutover** (backfill, §4.9) — nobody silently loses or gains access.
8. **Reversible:** `COURSE_SCOPE_MODE=legacy` restores today's behavior exactly (same SQL fragments).
9. **No real student data in fixtures.**
10. **Audit stays fail-open**; scope/designation edits remain audited.

---

## 4. Design

### 4.1 Course identity and catalog

- **Course code** (`BSIT`, `BSHM`, …) is the only key. Stored verbatim in `Section.course` and normalized into
  `User.program` for students.
- **Researched catalog (2026-11-25).** Source: the official campus page
  <https://www.pup.edu.ph/stamaria/> (primary; carries no "last updated" date, © 1998–2026), cross-checked
  against the campus-maintained <https://sites.google.com/view/pupsmb/about-the-campus> (same eight programs).
  The registrar's sign-off remains a release gate because the page is undated and some third-party sites list
  other programs (e.g. BSCE, BSHRM) that the official page does not.

  | Code (used in Polycheck) | Official name | Aliases to normalize |
  |---|---|---|
  | `BSA` | Bachelor of Science in Accountancy | BS Accountancy |
  | `BSCpE` | Bachelor of Science in Computer Engineering | BSCPE, BS Computer Engineering |
  | `BSENTREP` | Bachelor of Science in Entrepreneurship | BS Entrepreneurship, BSEntrep |
  | `BSHM` | Bachelor of Science in Hospitality Management | BS Hospitality Management |
  | `BSIT` | Bachelor of Science in Information Technology | BS Information Technology |
  | `BSEDEN` | Bachelor of Secondary Education major in English | BSED-EN, BSEd English |
  | `BSEDMT` | Bachelor of Secondary Education major in Mathematics | BSED-MT, BSEd Math(ematics) |
  | `DOMTLOM` | Diploma in Office Management Technology – Legal Office Management | DOMT |

  Codes follow the official abbreviations. The two BSED majors are **separate courses** (they are separate
  programs for heads and reports). Legacy section values from the old draft catalog (e.g. `BSEd`, `BSCS`)
  stay readable; a one-time, dry-run-first normalization script maps them where unambiguous (`BSEd` is
  ambiguous between the two majors and is listed for manual choice).
- **No department/organisation grouping.** The catalog is a flat list. The old `department` key on
  `PupCourse` is dropped from new data (kept optional only so `pupCoursesByDepartment` keeps compiling as a
  one-bucket legacy wrapper). `PupCourse` gains `aliases: string[]`. Existing exports (`pupCourseByCode`,
  `pupCourseName`, `pupCoursesByDepartment`) keep working so no consumer breaks.
- **New `normalizeCourse(input): { code?: string; matched: boolean; raw: string }`** in shared: case/spacing/
  punctuation-insensitive match against code, full name and aliases ("B.S.I.T.", "BS Information Technology",
  "bsit" → `BSIT`). Unknown input is returned `matched: false` and **never silently dropped**.
- **Off-catalog values:** the section form's "Other — specify manually" stays for v1 but shows a warning that
  heads cannot be assigned to unknown courses. Phase 2 (DB catalog) lets a super admin add a course properly.

### 4.2 Scope model (additive migration)

```prisma
// User (additive; defaults make every existing row behave as "no course scope")
managedCourses     String[] @default([])
managesAllCourses  Boolean  @default(false)

// Section
@@index([course])          // oversight filters become section.course IN (...) / equals
```

- **Meaning** applies only to designees (`isDepartmentHead`, `isUserRegistrar`); ignored for everyone else.
- **Effective course scope** (one pure helper, shared + mirrored in backend):
  - `managesAllCourses` ⇒ all courses.
  - else `managedCourses` (case-insensitive codes).
  - else **none** (fail-closed).
- **Head of Academic Programs** is not a stored role; it is the *label* shown when a head has
  `managesAllCourses = true`.
- **Validation:** `managedCourses` entries must be catalog codes (normalized on write); `managedCourses`
  non-empty and `managesAllCourses = true` together is allowed but `managesAllCourses` wins; max 20 entries.
- Only **super admins** may write these fields (same rule and `designations_admin_only` error as other
  designation writes); each change is audited with before/after (extend the existing
  `admin.user.designations_changed` metadata; **no new audit action**).

### 4.3 Capability matrix (who can do what)

| Capability | Super admin (institution) | Head of Academic Programs (all courses) | Course Head (own courses) | Registrar | IT Coordinator | Teacher | Student |
|---|---|---|---|---|---|---|---|
| Attendance reports / dashboards | all | all courses | own courses | — | — | own sections | own records |
| At-risk list | all | all | own courses | — | — | own sections | own standing |
| Decide excuses | via lookup only | all courses | own courses | — | — | own sections | request |
| CHED referrals (file/advance) | read | all | own courses | — | — | file for own | — |
| Class-record / master-list docs | all | all | own courses (read) | — | — | own sections | — |
| Create/enroll/edit sections, sessions, QR | **no** (read-only) | **no** | **no** | **no** | **no** | own | — |
| Create/import students | yes | — | — | all courses, or pinned to courses (students by `program`) | — | enroll only (+provision if enabled) | — |
| Create teacher accounts, role/designation edits | yes | — | — | teacher accounts only when all-courses; never roles/designations | — | — | — |
| Server status, maintenance, issue triage | yes | — | — | — | yes | — | — |

This is today's matrix with the scope key changed; D6 keeps the powers identical.

### 4.4 Backend: one course-scope module

New `backend/src/common/course-scope.ts` (sibling of `department-pin.ts`, same shape so reviews are mechanical):

- `isCourseHead(user)`, `isRegistrar(user)` (re-use), `courseScope(user): { kind: 'all' } | { kind: 'courses'; courses: string[] } | { kind: 'none' }`
- `oversightSectionWhere(user): Prisma.SectionWhereInput` →
  - **course mode:** `all` → `{}` ; `courses` → `{ course: { in: courses, mode: 'insensitive' } }` ; `none` → `{ id: { in: [] } }`
  - **legacy mode:** the exact current clause `{ teacher: { department: { equals, mode: 'insensitive' } } }`
- `oversightSessionWhere`, `oversightRecordWhere` (wrap the section clause under `session.section`)
- `registrarStudentWhere(user)` → by `program` (course mode) or `department` (legacy mode)
- `registrarCanAdminister(user, target)` → students by `program ∈ scope`; teachers only when scope is `all`
- `forcedCourseFor(user)` for registrar-created students: the registrar's single course if pinned to exactly one,
  otherwise the value supplied (validated to be inside scope)
- Mode switch read once at module init from `COURSE_SCOPE_MODE`; unknown value ⇒ `legacy` + startup warning.

**Call-site migration (verified list of files that use the old helpers; each gets a spec re-pin):**
`attendance-scope.service.ts` (record/session/filtered scopes), `attendance-at-risk.service.ts`,
`attendance-referral.service.ts`, `attendance.service.ts` (excuse scope), `docs.service.ts` (class-record/
referral PDFs), `dashboard.service.ts`, `users.service.ts` (scope checks, forced department, list filter),
`student-import.service.ts` + `student-import-queue.service.ts` (registrar pin), `section-roles.service.ts`,
and `shared/src/utils/designations.ts` (`oversightDepartment` → add `oversightCourses`; keep the old export).

`department-pin.ts` keeps its exports (legacy mode + any un-migrated caller) but each function delegates to
`course-scope.ts` when `COURSE_SCOPE_MODE=course`, so a missed call site degrades to *legacy* behavior, never
to *no scope*.

### 4.5 Filters, reports and dashboards

- Reports/at-risk/dashboards gain an optional `course` query parameter (additive DTO field,
  `section.course` equality) next to the existing `sectionId`/`subjectId`. The existing `department` admin
  filter stays (legacy) and is hidden in the UI.
- A course head's queries are **always pinned** to their scope regardless of the requested `course`
  (same rule as today's department pin); an all-courses head may filter to any course.
- Course filter option lists come from the actor's effective scope (so a head sees only their courses).
- Dashboard "department" tiles become "course" tiles; group-by uses `section.course`.

### 4.6 Accounts, registrar and students

- **Student creation/import:** the program column is normalized to a catalog code (`normalizeCourse`);
  unmatched values keep the raw text and raise an informational import notice (reusing existing issue codes).
  The legacy required `department` is **auto-filled with the course code** (students) so the DB constraint and
  any legacy path stay satisfied; the form/import no longer asks for it.
- **Registrar:** campus-wide by default (seed `reg.campus` = all courses). A course-pinned registrar can create
  and manage students whose `program` is in scope; teacher-account administration requires all-courses scope.
- **Teacher accounts:** `department` is no longer collected (it was never DB-required); legacy values are
  left as they are.
- **Users console:** designee editor gets a course multi-select (catalog) + "All courses" toggle for heads and
  registrars; designation chips read "Course Head (BSIT)" / "Head of Academic Programs (all courses)".

### 4.7 Imports (ties to the master-list plan)

- The parser maps the program column through `normalizeCourse`; the report groups unmatched programs.
- Enrollment import is unchanged (program is a warning, never a block; master-list plan §4.10).
- `ImportBatch.department` stays populated for audit continuity (course code or null).

### 4.8 Clients

- **Web:** replace "Department" labels/filters with "Course"; Users designee editor; reports/at-risk course
  filter; dashboard tiles; sections create "Course" selector driven by the corrected catalog;
  `canAccessAcademicOversight` unchanged; add `oversightCourses(user)` helper for UI banners.
- **Flutter (`polycheck_mobile`):** additive model fields (`managedCourses`, `managesAllCourses` with defaults),
  label changes in `designations.dart`/`admin_access.dart`, users sheet editor, course filter where the web has
  one, catalog updated in `pup_courses.dart` (mirrors the shared constant; a parity test pins both). No router
  or guard changes.
- **Legacy RN `android/`:** untouched (out of scope; read-only reference).
- **Feature Parity Gate:** designee/course editing is super-admin web+Flutter; the legacy app is exempt.

### 4.9 Data migration and backfill (one additive migration, idempotent)

`backend/prisma/migrations/2026112x120000_course_scope/`

1. `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managedCourses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
   `"managesAllCourses" BOOLEAN NOT NULL DEFAULT false`; `CREATE INDEX IF NOT EXISTS ... ON "Section"("course")`.
2. **Backfill existing designees only** (no other row is touched):
   - The campus has no departments, so there is no meaningful department→course mapping. The migration
     carries **one explicit, reviewable mapping table** for known legacy values only: the seed value `CCIS`
     maps to `BSIT` (the demo head). Any other department value gets an empty scope and is listed.
   - Existing registrars with a department are mapped with the same table; the seeded campus registrar
     (`reg.campus`) is set to `managesAllCourses = true`.
   - Designees whose department matches nothing keep empty scope (fail-closed) and are listed in the
     migration notes/execution addendum for manual assignment in the Users console.
3. Students: **no backfill** (their `department` stays; `program` is already required). Optional follow-up
   script normalizes existing `program` strings to catalog codes in a dry-run-first, reviewable pass.
4. Sections: no backfill. Sections without `course` are visible only to all-courses heads and the owning teacher.
5. Seed updated: demo head `chair.ccis` gets `managedCourses = ['BSIT']`, registrar `managesAllCourses = true`,
   plus a demo Head of Academic Programs account; demo sections/students use only the eight catalog codes.

### 4.10 Deprecation path (post-defense, not in this plan's critical path)
After a release with `COURSE_SCOPE_MODE=course` stable: hide remaining department UI, stop collecting it,
then (separate plan) rename identifiers and drop legacy mode. Super-admin `scope:'department'` is retired
only if a real need disappears.

---

## 5. Security and privacy

| Risk | Mitigation |
|---|---|
| Scope widening (a head sees more than intended) | Fail-closed helper; pinned regardless of query params; per-role spec matrix; legacy/course parity tests; backfill reviewed and audited. |
| Scope narrowing (a head silently loses access) | Backfill of existing designees; list of unmapped designees in the addendum; mode switch for instant rollback. |
| Heads viewing student data | Oversight is read-only and scoped; reads of other teachers' sections by heads are already audited where the existing code audits; no new data exposed beyond current department-head reach. RA 10173 minimization unchanged. |
| Free-text courses creating orphan scopes | Catalog-validated writes; normalization; warning on "Other". |
| Privilege escalation via self-edit | Only super admins may write `managedCourses`/`managesAllCourses` (`designations_admin_only`). |
| Cross-course student exposure | Intended: a student in a BSIT section is visible to the BSIT head, because that is where attendance is recorded; their own-program head does not see out-of-program sections (documented). |

---

## 6. Performance (2 cores)

- Scope clause becomes `section.course IN (…)` (indexed by the new `Section(course)` index) instead of a join
  through `teacher.department`; at worst it removes one join. All-courses scope adds **no** predicate.
- Arrays are tiny (≤20). No new cron, no new queue, no hot-path (scan/ingest) change.
- Dashboard group-by switches from teacher-department to `section.course`; measure the admin overview and
  reports endpoints before/after on the seeded dataset.

---

## 7. Test plan

**Backend unit/service:**
- `course-scope.ts`: matrix of {legacy, course} × {super admin, all-courses head, course head, empty-scope head,
  registrar all, registrar pinned, plain teacher, student}; case-insensitivity; fail-closed; unknown
  `COURSE_SCOPE_MODE` ⇒ legacy.
- Existing specs for `attendance-scope`, at-risk, referral, excuses, docs, dashboard, users, imports re-pinned
  with course fixtures; **a parity test asserts `legacy` mode produces the exact previous Prisma `where`**.
- Cross-program case: BSHM student in a BSIT section appears for the BSIT head and not for the BSHM head;
  the owning teacher and the all-courses head see it.
- Designation writes: only super admin; validation of codes; audit metadata diff; `managesAllCourses` wins.
- Registrar: pinned student create/reset/disable by `program`; teacher-account admin blocked unless all-courses;
  forced course/department auto-fill; import pinned.
- Migration/backfill: applies on a fresh volume and the dev DB; idempotent re-run; unmapped designees stay
  fail-closed.

**Shared/frontend/Flutter:** `normalizeCourse` table tests (aliases, punctuation, unknown); catalog parity test
(shared vs Dart); users designee editor; reports/at-risk course filters; label snapshots; Flutter model
deserialization with and without the new fields (contract snapshot test, DD-C3 style).

**E2E (Playwright, Chromium first):** extend `e2e/designations-maintenance.spec.ts`: course head sees only own
course; head of academic programs sees all; irregular student journey; registrar pinned vs campus-wide; admin
edits a head's courses and the head's view changes on next request.

**Regression gates:** shared, backend, frontend, `pnpm build`, Prisma validate, `flutter analyze` + `flutter
test`, full Chromium E2E. Scan/ingest/sync suites must remain untouched and green.

---

## 8. Rollout, flags and rollback

1. Ship code with `COURSE_SCOPE_MODE=legacy` (default): behavior identical to today; new columns exist but are
   unused.
2. Apply catalog confirmation, run the backfill, assign designees in the Users console, verify with the E2E
   journeys and a manual pass per designee.
3. Flip `COURSE_SCOPE_MODE=course` in staging, then production (env change + restart, no migration).
4. **Rollback:** set `COURSE_SCOPE_MODE=legacy`. Data written meanwhile (new columns) is harmless. The migration
   is additive; no down-migration needed.

**Order (each step independently shippable):**

| Step | Content | Size | Gate |
|---|---|---|---|
| M0 | Registrar sign-off on the eight-program catalog + naming which professor heads which course (calendar-bound, owner action) | S | owner |
| M1 | Shared: corrected catalog, `normalizeCourse`, `oversightCourses`, types (additive) | S | shared tests |
| M2 | Migration + backfill + seed + `course-scope.ts` + mode switch (legacy default) | M | backend specs incl. parity |
| M3 | Re-point the call sites (attendance-scope, at-risk, referral, excuses, docs, dashboard) | M | re-pinned specs |
| M4 | Users/registrar/import re-point + student `department` auto-fill | M | users/import specs |
| M5 | Web: labels, designee editor, course filters, dashboard tiles | M | frontend + E2E |
| M6 | Flutter: models, labels, editor, catalog parity | M | analyze + tests |
| M7 | Flip to `course` in staging → production | S | E2E + manual per-designee check |
| M8 | Post-defense: stop collecting department, hide UI, plan the rename | — | — |
| M9 (optional) | DB-backed catalog + admin UI | M | — |

**Timeline guidance (deadline Dec 4–5; data gathering this week):** this work changes **who can see which
attendance data**, so it must not land mid-gathering. M0–M1 can start now (no behavior change). Merge M2–M6
**after the gathering** with `legacy` as default; flip the mode only after the per-designee verification.
Because the mode is a one-line env change, the flip can happen close to the defense with a rehearsed rollback.

---

## 9. Files expected to change

**New:** `backend/src/common/course-scope.ts` (+ spec), `backend/prisma/migrations/2026112x120000_course_scope/`,
`shared/src/utils/course.ts` (`normalizeCourse`, `oversightCourses`) (+ tests),
`frontend/src/components/admin/course-scope-editor.tsx`, Flutter `course_scope_editor` widget.

**Modified:** `backend/prisma/schema.prisma`, `prisma/seed.ts`, `common/designations/department-pin.ts`
(delegate), `attendance/{attendance-scope,attendance-at-risk,attendance-referral,attendance}.service.ts`,
`docs/docs.service.ts`, `dashboard/dashboard.service.ts`, `users/{users,student-import,student-import-queue}.service.ts`
+ DTOs, `section-roles/section-roles.service.ts`, `common/config/env-validation.ts`, compose/env examples
(`COURSE_SCOPE_MODE`), `shared/src/constants/pup-courses.ts`, `shared/src/types/user.ts`,
`shared/src/utils/designations.ts`, frontend `lib/api-client.ts`, `faculty/{reports,at-risk,users,page}`,
`components/admin/user-profile-dialog.tsx`, `components/layout/sidebar.tsx`, `faculty/sections/create/page.tsx`,
Flutter `core/models/user.dart`, `core/utils/{designations,pup_courses}.dart`, `features/admin/**`,
`features/faculty/presentation/{faculty_at_risk,section_create}_screen.dart`, e2e designation specs, docs
(`AGENTS.md`).

**Explicitly untouched:** `common/admin-scope.ts`, `services/ingest/**`, scan/sync/ledger/sessions/auth/session-policy/
device-binding, `android/**`.

---

## 10. Decisions adopted (change any of them before implementation)

Resolved:
1. **Program list — researched** (§4.1: eight programs from the official PUP Sta. Maria page). Remaining action:
   registrar sign-off, because the page is undated. **Organisations are excluded.**

Adopted defaults (chosen for PUP Santa Maria; tell me if one is wrong):
2. A course may have **more than one head**, and one person may head **more than one course** (list field).
   **Owner-confirmed 2026-11-25.**
3. **Head of Academic Programs** = a head flagged "all courses": sees every course, no classroom writes.
   **Owner-confirmed 2026-11-25.**
4. Course heads **keep approving excuses and filing referrals** for their courses (today's behavior) — they are
   not downgraded to read-only. **Owner-confirmed 2026-11-25, "for now"**: this is an interim policy; keep the
   excuse/referral permissions behind the existing per-capability checks so they can be narrowed later
   (e.g. to read-only) without another scope change.
5. **Registrar sees all courses** (campus-wide); a program coordinator can be limited to specific courses.
6. A head sees **sections of their course** (including irregular students from other programs enrolled there);
   they do **not** see their own program's students sitting in other courses' sections (v1).
7. Existing department-scoped super admins are **left as they are** (deprecated, not migrated).
8. "Other — specify manually" stays in the section form for v1 with a warning, until the DB catalog exists.

---

## 11. Acceptance criteria

- With `COURSE_SCOPE_MODE=legacy`, all existing suites pass and every scope query is byte-identical to today.
- With `course` mode: a BSIT course head sees reports, at-risk, excuses and referrals only for sections whose
  `course` is BSIT (including irregular students from other programs enrolled there) and nothing for other
  courses; a Head of Academic Programs sees every course; a head with no courses sees nothing; none of them can
  write to classroom resources.
- A registrar creates/imports students campus-wide (or only for pinned courses), and a pinned registrar cannot
  touch other programs' students or any teacher/role/designation.
- New students receive a catalog course code in `program` and an auto-filled legacy `department`; imports report
  unmatched programs without failing rows.
- Existing designees keep correct access after the backfill; any unmapped designee is listed and fail-closed.
- Flipping the mode back to `legacy` restores today's behavior without a deploy.
- Attendance, ingest, sync, ledger and login behavior are unchanged (unchanged suites green).
