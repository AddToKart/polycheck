# Course-on-Section, Session Slot Selector & Dispute Submit Fixes

> **Status:** Implemented (CS1–CS4, SL1–SL3, DS1–DS2, VER code gates).
> Web-first wave (per requester: "website is our focus now"); Android parity items are
> explicitly deferred with justifications in §9. See §11 for the delivered addendum.

---

## 1. Goal

Three fixes requested together (all report-side, teacher/student facing):

1. **CS — Course on Section.** When creating a *Section* (not the subject), the teacher
   must always attach a **course** chosen from the PUP Santa Maria course list (seeded
   as the default values). The course must **always display** wherever sections are
   identified, because two sections can carry the same subject but belong to different
   courses (e.g., "IT Elective · Section 4-1" exists in both BSIT and BSA).
2. **SL — Session slot selector.** When creating a session for a section whose schedule
   has multiple days (e.g., Mon 08:00–10:30 + Wed 09:00–12:30), the form must expose a
   **class-meeting selector** so the teacher explicitly creates the session for Monday
   and a separate one for Wednesday — most importantly in bulk mode, which currently
   stamps **one** start/end time pair on **every** selected weekday.
3. **DS — Student dispute submit.** The student "Report Issue" dialog's submit button
   does nothing from the student's point of view. Fix validation + error surfacing.

## 2. Verified Current State (facts from the research pass)

| # | Fact | Evidence |
|---|---|---|
| CS1 | `Section` has no course field anywhere | `shared/src/types/subject.ts:19-33`; `backend/prisma/schema.prisma:211-240` |
| CS2 | Section create is subject-scoped only: the form reads `?subjectId=`, shows a read-only "Subject" context card, and offers Section/Room/Semester/Schedule — no course input | `frontend/src/app/faculty/sections/create/page.tsx:39-49,131-144,146-195` |
| CS3 | `CreateSectionDto` validates subjectId/section/room/schedule/semester only | `backend/src/sections/dto/create-section.dto.ts:34-61` |
| CS4 | Web section labels render bare `Section {sec.section}` on at least 12 surfaces; several have the Section object locally available, several only carry composed `sectionName` strings | `faculty/page.tsx:436,500`; `faculty/subjects/page.tsx:100-111`; `faculty/subjects/[id]/page.tsx:123`; `faculty/subjects/[id]/sessions/page.tsx:109`; `faculty/sections/[id]/page.tsx:239`; `faculty/sessions/page.tsx:145`; `faculty/sessions/create/page.tsx:383`; `faculty/attendance/page.tsx:370`; `faculty/search/page.tsx:173`; `StudentsAtRiskCard.tsx:83`; `student/subjects/[id]/page.tsx:84`; `student/subjects/[id]/create-session/page.tsx:149` |
| CS5 | There is no PUP Santa Maria course catalog in the repo; the only campus constant is geographic (`pupSantaMaria`) | `shared/src/map/pup-campus.ts`; `grep` across `shared/`, `backend/`, `frontend/` |
| SL1 | Single-session create prefill matches today's weekday against the section schedule, falls back to `schedule[0]`, and gives no indication of which class slot is being filled | `frontend/src/app/faculty/sessions/create/page.tsx:110-127,159-171` |
| SL2 | **Bulk create applies one `startTime`/`endTime` pair to every selected `daysOfWeek`** — a Mon/Wed section with different times is created with identical times on both days (the observed symptom) | `frontend/.../sessions/create/page.tsx:220-242` (single `startTime` in the payload); backend iterates dates with `startTime: dto.startTime` for all rows `backend/src/sessions/sessions.service.ts:155-208`; DTO requires exactly one pair `backend/src/sessions/dto/create-session.dto.ts:68-91`; shared type `BulkSessionInput` one pair `shared/src/types/api.ts:263-282` |
| SL3 | Row uniqueness is `(sectionId, date, startTime, endTime)` — two same-date sessions with different times coexist legally | `backend/prisma/schema.prisma:338` |
| DS1 | Backend enforces `@MinLength(10)` on dispute description (and `@MaxLength(1000)`) | `backend/src/disputes/disputes.controller.ts:19` |
| DS2 | The web submit handler has **no try/catch and no submitting flag**: `api.submitDispute` throws `ApiHttpError` on 400, the exception escapes `handleSubmitDispute` unhandled, and the dialog renders nothing — the observed "button doesn't work" | `frontend/src/app/student/dashboard/page.tsx:207-219`; error path renders nothing because the throw happens before `setDisputeFeedback` `:210-215` |
| DS3 | The dialog disables Submit only on `!props.reason`; the description textarea has no client-side min length, no counter, no `maxLength` attribute; "Other" maps its value to `device_mismatch` (wrong reason goes into the audit trail) | `frontend/src/components/student/StudentDashboardDialogs.tsx:36-39` |
| DS4 | `post()` throws typed `ApiHttpError` for non-2xx (no silent success possible) | `frontend/src/lib/api-client.ts:294-304,317-332` |

## 3. Locked Decisions

| # | Decision |
|---|---|
| 1 | **Catalog is a shared constant, not a DB table.** `shared/src/constants/pup-courses.ts` exports `PUP_SANTA_MARIA_Courses` (`{ code, name, department? }[]`) + `pupCourseByCode()`; kept in one place for review/updating (no settings-table round trip, no migration for values). Server keeps storing the plain `course` code on the section. |
| 2 | **`Section.course?: string` (program short code, e.g. `BSIT`).** Optional in the shared type/DB for legacy rows; **required in the web form** (submit blocked until chosen). Device/catalog mismatch cases are covered by a free-text "Other…" option in the selector. Display falls back gracefully when absent (legacy sections render as today). |
| 3 | **Server-side DTO accepts course today, hard-requires it later.** `course` is optional+validated in `CreateSectionDto`/`UpdateSectionDto` so the Android composer keeps working until its parity item lands; flipping both to required is a one-line follow-up recorded in §9. |
| 4 | **Course renders at display sites only.** Payload fields composed from `section.section` (`sectionName` in dashboard/at-risk/standing/docs/AI/calendar utils, android `session-context.ts`) stay bare, because every mobile consumer prefixes `Sec {sectionName}` — appending course inside shared compositions would leak half the feature to Android or corrupt those labels. Web display lines that carry the Section (or can look it up locally) append ` · {course}` via a helper. |
| 5 | **Session identity is unchanged.** No new schema column for "which weekday the session belongs to" — `date` already encodes the weekday and the slot selector only drives prefill (date + times + room). Bulk gains an additive `slots` contract instead of changing the one-pair fields. |
| 6 | **Bulk contract is additive.** `BulkSessionInput.slots?: { day; startTime; endTime }[]` overrides `daysOfWeek + startTime + endTime` when present; legacy shape stays valid so the Android create screen is untouched. Backend: legacy shape keeps today's behavior; when `slots` are present they win and `daysOfWeek`/global pair are ignored (documented). |
| 7 | **Dispute fix stays client-side + one small enum addition.** Description min-10/max-1000 enforced in the dialog before submit, submit handler wrapped in try/catch surfacing `ApiHttpError.message`, `submitting` flag prevents double posts. "Other" stops masquerading as `device_mismatch`: `other` is added to `StudentDisputeReason`, the backend allowlist, and the teacher label/icon maps (additive, Android compiles unchanged). |
| 8 | No new tokens/deps/hex; selectors reuse the existing `<select>` + chip primitives already used in these forms. |

## 4. Workstreams & Milestones

| ID | Scope | Acceptance criteria |
|---|---|---|
| **CS1 — Shared contract** | `PupCourse` type + `PUP_SANTA_MARIA_COURSES` constant (draft list in §5.1 for requester review) + `pupCourseByCode()` + `formatSectionHeading()` helper in `shared/src/utils/section-label.ts` (`Section {section} · {course}`, course omitted when absent); `Section.course?: string` in `shared/src/types/subject.ts`; `SectionCreateSchema.course` optional string (1–30, trim); `SectionUpdateSchema.course` | shared typecheck/tests green; helper unit tests: with/without course, unknown-code fallback to raw string |
| **CS2 — Backend persistence** | Prisma `Section.course String?` + idempotent migration (nullable, no backfill); `CreateSectionDto`/`UpdateSectionDto` gain `@IsOptional @IsString @MinLength(1) @MaxLength(30) course?`; sections service persists + returns it; scope/`adminSectionWhere` untouched (course joins the returned rows via the model) | migration applies on the dev/staging DB idempotently; create/update round-trip course; old clients still pass validation (course omitted) |
| **CS3 — Web create-section form** | `/faculty/sections/create` gains a required **Course** select (maroon-titled card "Course", catalog options grouped by `department`, `pupCourseName()` shown alongside the code) + "Other — specify manually" option revealing a text input; state stores the code; submit blocked until a course exists; works alongside the existing `?subjectId` subject context card (subject stays the parent row) | form blocks submit without course; choosing a catalog course submits `course` code; "Other" submits the typed value; tests assert the disabled gate + payload |
| **CS4 — Web display surfaces** | Adopt `formatSectionHeading()` at the display sites that hold the section (or a section-by-`sectionId` lookup) locally: dashboard "My Subjects" rows + Today's-Schedule cards (`faculty/page.tsx:436,500`), subject card footer deriving the covered course set ("Sections: BSIT, BSA" derived from its sections on `faculty/subjects/page.tsx`), sections grid (`faculty/subjects/[id]/page.tsx:123`), per-section selects in `faculty/subjects/[id]/sessions`, `faculty/sessions/page.tsx`, `faculty/sessions/create/page.tsx:383`, section header `faculty/sections/[id]/page.tsx:239`, attendance page, search page, `StudentsAtRiskCard.tsx:83` (course lookup via its `sections` prop), student subject pages `student/subjects/[id]` + create-session | every listed render shows `Section X · COURSE` (course present) and degrades to today's labels (course absent); snapshot/unit tests on 2–3 representative components; no Android label text changed |
| **SL1 — Shared contract** | `BulkSessionInput` gains `slots?: Array<{ day: DayOfWeek; startTime: string; endTime: string }>`; `BulkSessionCreateSchema` additively: `slots` validated (`1–7` entries, `endTime > startTime` per slot, no duplicate `day+time` pair), legacy shape unchanged, crossref: `slots` ⇒ `daysOfWeek`/`startTime`/`endTime` optional; `daysOfWeek` derived from slots for count display | shared tests: legacy payload valid, slots payload valid, both ⇒ slots wins, invalid slot times rejected |
| **SL2 — Backend bulk slots** | `CreateBulkSessionsDto.slots?: SlotDto[]` (`@ValidateNested` `@Type`, each `day/start/end`); validation resolves the shape first (slots xor legacy; neither ⇒ 400); `createBulk` sweeps each *slot's* weekday over the requested range with the slot's own times (createBulk's `assertTimeRange`/conflict-skip/dedupe preserved per row) | slots payload creates Mon 08:00–10:30 **and** Wed 09:00–12:30 series; legacy payload byte-identical behavior; duplicate-row skip unchanged; unit tests follow `createBulk` spec (`sessions.service.spec.ts:1556-1627`) |
| **SL3 — Web slot selector + per-slot bulk** | Single create: a **"Class meeting"** slot select is rendered when the section has schedule entries — options `Mon 08:00–10:30 (room)` etc., defaulting to the entry matching the currently chosen date's weekday (existing logic), else first slot; picking a slot refills start/end/room and moves `date` to that slot's next occurrence (today stays if it matches); times/date stay manually editable; changing date auto-selects the matching slot. Bulk: the flat "Days of Week" checkboxes become per-slot checkboxes in the same UI position, each with its own editable start/end pair prefilled from the section schedule, the start/end date range stays global, and the count line sums per-slot occurrences; payload sends `slots` | 2-slot section produces two independently created sessions (single create twice) with correct times; bulk with 2 slots creates both series; per-slot time edits honored; contract tests assert the `slots` payload |
| **DS1 — Dispute dialog fix (web)** | `StudentDisputeDialog`: description required with `min 10 / max 1000` (textarea `maxLength` attr + live counter), Submit disabled until reason **and** valid description; page handler wraps submit in try/catch, adds a `submitting` flag, renders `ApiHttpError.message` (and generic network fallback) in the existing feedback slot; success path unchanged (feedback + records refresh); dialog closes only on explicit close (current behavior) | empty description ⇒ button disabled (no dead click); short description ⇒ disabled; valid submit ⇒ success feedback + refreshed record; forcing a 400 (e.g., via test mock) ⇒ error message visible inside the dialog; no unhandled rejection (promise test) |
| **DS2 — "Other" reason union** | `shared/src/types/attendance.ts`: `StudentDisputeReason += 'other'`; backend `SubmitDisputeDto` allowlist += `'other'`; web dialog "Other" option value → `other`; teacher disputes page `DISPUTE_LABELS`/`DISPUTE_ICONS` += `other`; security dispute badge maps where reason unions surface | teacher dispute rail renders "Other" rows with correct label/icon; backend accepts `other`; student submit posts `other` |
| **VER — Gates & docs** | Package gates: shared/backend/frontend `typecheck`, `lint`, `test`, `build`; backend `format:check`; full Chromium E2E; rebuild Docker Compose and smoke the three journeys live | all suites green with counts recorded in AGENTS.md "Progress"; new E2E spec passes (§6); containers rebuilt; AGENTS.md gains this wave's summary + Key Decisions |

## 5. Design Details

### 5.1 Course catalog draft (CS1 — populate + confirm)

The catalog ships as a constant so the requester can review/adjust a literal list. Draft
entries below are placeholders modeled on typical PUP Santa Maria program offerings and
**must be confirmed against the official PUP Santa Maria program list during CS1**
(registrar/official offerings page) — data entry is a review task, not schema work:

```ts
export interface PupCourse {
  code: string            // 'BSIT' — stored on Section.course
  name: string            // 'BS Information Technology'
  department?: string     // 'CCIS' — groups options in the <select>
}
export const PUP_SANTA_MARIA_COURSES: PupCourse[] = [
  // CCIS
  { code: 'BSIT', name: 'BS Information Technology', department: 'CCIS' },
  { code: 'BSCS', name: 'BS Computer Science', department: 'CCIS' },
  { code: 'BSIS', name: 'BS Information Systems', department: 'CCIS' },
  // Business / Accountancy / Education / Industrial Technology groups follow,
  // filled in from the official list during CS1.
]
export const pupCourseByCode = (code: string) => /* exact / case-insensitive lookup */
```

Choosing a course stores only `code`; display prefers `pupCourseName(code)` and falls
back to the stored code.

### 5.2 Display helper (CS4)

```ts
// shared/src/utils/section-label.ts
export const formatSectionHeading = (
  section: Pick<Section, 'section' | 'course'>,
): string =>
  section.course ? `Section ${section.section} · ${section.course}` : `Section ${section.section}`
```

Composed `sectionName` payloads (`dashboard.service.ts:145`, at-risk/standing/docs/AI
tool registry, `shared/src/utils/calendar.ts`, `frontend/src/lib/calendar-utils.ts:125`)
**keep bare values** (Decision 4) — their "Sec …"-prefixed consumers (including all
Android ones) stay byte-identical. Surfaces that only receive such strings and cannot
look the section up locally (calendar popovers, standing banner, referral rows) are
tracked in §9's deferred table for the mobile-parity wave.

### 5.3 Slot interaction model (SL3)

| Interaction | Effect |
|---|---|
| Section selected | Slot select appears (≥1 schedule entry); default = slot matching current date's weekday, else first; times/room prefilled (current behavior preserved) |
| Slot picked | `date` → today if that weekday else next occurrence; `startTime/endTime/room` ← slot (still editable after) |
| Date changed | If that weekday matches a slot → auto-select it (current `handleDateChange` logic becomes slot-driven) |
| Submit (single) | One session, one slot — Monday and Wednesday are created as separate submissions |
| Bulk selected | Global pair replaced by per-slot rows (checkbox + times + room, prefilled from section schedule, editable); count = Σ per-slot occurrences in range |
| Conflict check | Existing same-date warning and duplicate-row skip behave per date+times (uniqueness `schema.prisma:338` already distinguishes slots) |

## 6. Testing Strategy

| Layer | Approach |
|---|---|
| Shared (vitest) | catalog lookup, `formatSectionHeading` with/without course, `BulkSessionCreateSchema` slots matrix (legacy/slots/both/invalid) |
| Backend (jest) | create/update round-trip `course`; DTO acceptance with omitted course; `createBulk` slots sweep + legacy equivalence + per-slot conflict skip; dispute `other` reason accepted |
| Web (vitest + RTL) | create-section: course gate + "Other" free text + payload; create-session: slot selection/refill/date-coupling + per-slot bulk payload + count; dispute dialog: disabled gate, counter, error/success feedback, `other` mapping |
| E2E (Playwright, Chromium) | new `e2e/section-session-fixes.spec.ts`: (1) faculty creates a section with course → course visible on subject page; (2) section with Mon+Wed schedule → bulk per-slot creation asserts two series with distinct times; (3) student dispute: short description blocked, valid submit reaches the teacher rail as `other` |
| Live smoke | containerized stack: section create → course round-trip; slots bulk → dashboard calendar shows both day/time pairs; dispute submit end-to-end |

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Requester's exact PUP SM course list differs from the draft | §5.1 gates CS1 on requester confirmation; codes are free to edit (plain strings stored, "Other" fallback exists) |
| Legacy sections without course create mixed-label UI | `formatSectionHeading` degrades to today's labels; no backfill forced |
| `slots` contract drift with Android composer | Legacy shape remains valid and untouched; a shared-type regression test asserts legacy payloads still parse |
| Bulk per-slot conflicts double-count the skip path | Per-row dedupe reuse from today's loop (`sessions.service.ts:203`) + `createBulk` spec extension covering two same-weekday-slot collisions |
| Dispute feedback previously invisible (silent 400s) | Promise-rejection test asserts feedback renders; regression E2E clicks submit with both empty and valid inputs |
| `other` widens teacher-side maps only on web | Additive enum — Android label maps tolerate unknown reasons (`unknown` fallback exists); web maps exhaustive with `other` |

## 8. Out of Scope (this wave)

- Backend hard-requiring `course` on section creation (after Android parity, §9).
- Editing course on existing sections from the web UI (update DTO accepts it; dedicated edit surface deferred).
- Server-side `day/slot` column on `Session`, kiosk/cockpit slot badges, calendar course rows.
- Mobile fixes (Android dispute sheet, Android course picker/slot selector, mobile label parity).

## 9. Deferred (mobile parity justifications, per the Feature Parity Gate)

| Item | Justification |
|---|---|
| Android create-section course select | Contract stays backward-compatible (optional field); Android form untouched — parity fast-follow after web sign-off |
| Android create-session slot selector / per-slot bulk | Android bulk composer keeps the legacy single-pair shape (still valid); parity fast-follow |
| Android dispute sheet min-length + error surfacing | Same latent `@MinLength(10)` issue exists on Android; fix rides the parity wave (small) |
| Course on composed-`sectionName` surfaces (calendar/alerts/referrals) | Protects every mobile "Sec …" composition from double prefixes (Decision 4); revisit together with mobile label parity |

## 10. Open Questions (defaults if silent)

1. Course list source — confirm the official PUP Santa Maria program list during CS1 (default: the §5.1 draft ships and is marked for requester review).
2. Should "Other" courses be normalized (e.g., uppercase prefix match against the catalog)? (Default: store exactly what the teacher typed, trimmed.)
3. For bulk mode, may the teacher edit per-slot times, or must they equal the section schedule? (Default: editable — matches today's editable prefill philosophy.)
4. When a date's weekday matches no schedule slot (make-up class), keep the current free date behavior with the neutral slot label. (Default: yes — choose "Not a scheduled day (custom)" explicitly shown in the select.)

Say "go" and I'll implement CS1 → VER in order with the full verification gates.

## 11. Implementation Addendum (delivered)

| Area | Delivered |
|---|---|
| Shared contract (CS1/SL1/DS2) | `shared/src/constants/pup-courses.ts` (`PUP_SANTA_MARIA_COURSES` draft catalog + `pupCourseByCode`/`pupCourseName`/`pupCoursesByDepartment`), `Section.course?: string`, optional `SectionCreateSchema.course`, `formatSectionHeading`/`sectionCourseLabel` (`utils/section-label.ts`), `BulkSessionSlot` + optional `slots` on `BulkSessionInput`, `BulkSessionSlotSchema` + slot-aware `BulkSessionCreateSchema` (legacy shape still valid), `StudentDisputeReason += 'other'`. Tests: catalog/helper/schema matrix (shared 17 files / 198 tests). |
| Backend (CS2/SL2/DS2) | `Section.course String?` + idempotent migration `20261110120000_section_course`; create/update DTOs + service persist trimmed course (`null` clears) and `presentSection` returns it; slot-aware `CreateBulkSessionsDto.slots` with nested validation; `createBulk` resolves slots (slots win; legacy required otherwise), sweeps each slot's weekday with its own times, dedupes identical rows within a request, and preserves the existing date-level conflict + P2002→409 behavior; disputes accept `reason='other'`. New tests (backend 82 suites / 1002 tests). |
| Web — course (CS3/CS4) | Create-section page: required Course `<select>` grouped by department from the catalog + "Other — specify manually" (trimmed, ≤30); submit blocked until resolved. Displays adopt `formatSectionHeading` on faculty dashboard (today cards + My Subjects), subject cards ("Courses: BSIT, BCA" derived from sections), sections grid, subject sessions select, section header, sessions list, attendance, search, at-risk section filter, and the student subject detail + officer create-session headers. Legacy sections render unchanged. |
| Web — session slots (SL3) | New `frontend/src/lib/session-slots.ts` pure helpers (`nextOccurrenceDate`, `slotLabel`, slot/date matching, per-slot counting, payload shaping) with 26 tests. Create-session page: "Class meeting" selector (slot defaults to the date's weekday, else first; picking moves the date to the next occurrence and refills times/room; custom option for unscheduled dates), and bulk mode replaced the single weekday/time pair with one editable row per section schedule slot, sending `slots` and omitting the legacy pair. Count line sums per-slot occurrences. Section options now append the course. |
| Web — dispute (DS1/DS2) | `frontend/src/lib/student-dispute.ts` constants/validation + typed error describer; dialog requires a 10–1000-char trimmed description with counter, inline hint, `aria-invalid`/roles, submitting state, and `'other'` reason; dashboard handler wraps submit in try/catch/finally (typed `ApiHttpError` message surfaced, no unhandled rejection, records refresh failure cannot mask success); teacher disputes rail labels/icons include `other`. Dialog/helper tests added. |
| Android (compile-required only) | Dispute label/icon maps gained `other` (the widened shared union made the exhaustive `Record<DisputeReason, …>` fail `tsc`). No mobile course/slot parity yet — deferred per §9. |
| E2E | `e2e/section-session-fixes.spec.ts` (course display, class-meeting selector + per-slot bulk creation, dispute validation/submit) and the existing faculty section-create journey updated for the required course. |
| Verification | Shared 198, backend 1002 / 82 suites, web 442 / 65 files, Android 661 / 36 suites; backend `typecheck`/`lint:check`/`format:check`, frontend `tsc`/`lint` (0 problems)/`vitest`, Android `tsc`, and `pnpm build` (shared + backend + Next) clean. Playwright E2E was not executed locally because no Docker daemon/stack was available; the spec is ready for CI. |

### Deviations / follow-ups

- **Catalog values are a draft.** The list in `shared/src/constants/pup-courses.ts` must be reconciled with the official PUP Santa Maria program offerings; codes are plain strings, so updates need no migration.
- **Per-row room not sent.** Bulk slot rows display the meeting room for context but the payload keeps the single global `room` (the shared slot contract is `{ day, startTime, endTime }`).
- **Duplicate-session warning stays date-based** (pre-existing behavior) so two different-time slots on the exact same date still warn.
- **Section unique key unchanged** (`subjectId + section + semester + teacherId`). Two courses reusing the *same* section label under one subject still collide; distinct labels (the reported case: 1-1, 2-1, 4-1) are fine. Adding `course` to the unique key is a future migration decision.
- **Android parity** (course picker, slot selector/per-slot bulk, dispute sheet min-length/error surfacing) remains deferred per §9.
