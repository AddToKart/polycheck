# Wave 4 — Notifications, Excuse Workflow, At-Risk Oversight & Dashboard Filters

> **Status:** Implemented (FIL, NF, EXC, RISK). Companion to
> [`ai-assistant-plan.md`](./ai-assistant-plan.md) (standing evaluator reused),
> [`attendance-plan.md`](./attendance-plan.md) (status lifecycle), and
> [`assistant-panel-redesign-plan.md`](./assistant-panel-redesign-plan.md).

---

## 1. Goal

Four features that complete the attendance story — *"attendance → problem detected →
student notified → teacher intervenes → admin oversees"*:

1. **NF — Notifications**: an in-app notification center + realtime badges + mobile push.
2. **EXC — Excuse workflow**: students file leave/excuse requests; teachers approve; an
   `excused` status joins the lifecycle and is excluded from the standing rate.
3. **RISK — Teacher at-risk list**: deterministic "students to check on" widget driven by
   the existing standing evaluator.
4. **FIL — Specification-grade filters**: section/subject/status/date/period filters on
   the teacher and admin surfaces the professor flagged.

## 2. Verified Current State (facts)

| Fact | Evidence |
|---|---|
| Server report endpoint **already supports** `startDate, endDate, teacherId, subjectId, sectionId, sessionId` server-side | `shared/src/types/api.ts:157-164` (`AttendanceReportFilters`), `GET /attendance/report` → `attendance.controller.ts:38` |
| Teacher Attendance Log exposes **date range only** — subject/section/status/student filters missing although the backend accepts them | `frontend/src/app/faculty/attendance/page.tsx:21-22` |
| Teacher Sessions page has **no filters** (grouped list) | `frontend/src/app/faculty/sessions/page.tsx:16-19` |
| Super-admin Reports has subject + teacher + date range; **no section filter, no department filter, no comparison period** | `frontend/src/app/faculty/reports/page.tsx:21-24`; Android same (`reports.tsx:83-84`) |
| Admin dashboard (`admin-overview`) has **no period selector**; teacher/student dashboards use a fixed recent range | `dashboard.controller.ts:57`; `api-client.ts:574-576` |
| Disputes page has pending/resolved tabs + search + subject select (client-side) — no section or date filters | `frontend/src/app/faculty/disputes/page.tsx:86-88` |
| Student history has status filter tabs only | `student/dashboard/page.tsx:95` |
| `AttendanceStatus` (prisma enum) = `present, late, absent, pending, disputed` — **no `excused`** | `backend/prisma/schema.prisma:27-33` |
| Standing evaluator already excludes `disputed/pending` with a caveat — the `excused` pattern exists | `backend/src/standing/standing.service.ts` |
| No notification/push infrastructure anywhere (no `expo-notifications`, no `web-push`, no VAPID) | package.json greps clean |
| Realtime user rooms already exist for per-user delivery (`auth:user:<id>` joined on connect) and an event precedent (`auth:session-replaced`) | `realtime/attendance.gateway.ts` |
| Bulk disputes review UI (accept/reject/override + modals) is a proven pattern to mirror for excuses | `faculty/disputes` web + `(faculty)/disputes.tsx` |
| Auto-absent cron marks stale `pending` records absent and ends sessions | `sessions.service.ts` auto-expiry cron (documented in AGENTS.md) |

## 3. Locked Decisions

| # | Decision |
|---|---|
| 1 | **Ordering:** FIL first (fastest professor-visible win), then NF infrastructure, then EXC (consumes notifications), RISK anywhere after FIL (shares the new filter primitives). |
| 2 | **`excused` is a real status**, excluded from the standing denominator exactly like `disputed/pending` (with a caveat line) — sanctioned absences must not punish the rate; projections unchanged. A rejected excuse leaves the original status untouched. |
| 3 | **Excuse = record-anchored fields**, not a second table: `excuseStatus ('requested'|'approved'|'rejected')`, `excuseReason (StudentDisputeReason-style enum)`, `excuseDescription`, `excuseEvidencePath?` (reuse the proofs base64 upload pipeline + size cap), `excuseReviewedBy/At`, `excuseReviewNote`. Only `absent` (and `late`, if the teacher agrees after review) records can carry a request; one open request per record. |
| 4 | **Notifications are DB-backed** (new `Notification` model: `userId, type, title, body, link?, readAt?, createdAt`) with realtime fan-out over the existing per-user gateway room (`notifications:new` event) — no new websocket infra. |
| 5 | **Push (v1 scope):** Android gets Expo push (`expo-notifications` tokens stored in a new `PushSubscription` table; send via the Expo HTTPS API, no SDK server dep). Web push (VAPID + sw handler) is **NF-late and env-gated** (`WEB_PUSH_ENABLED=true` + keys) because our hand-rolled `sw.js` needs push/notificationclick handlers; it lands behind the flag with graceful no-op when unset. |
| 6 | **Initial notification types (v1):** `dispute_filed` (→teacher), `dispute_resolved` (→student), `excuse_requested` (→teacher), `excuse_decided` (→student), `attendance_absent` (→student, when cron/session-end marks them absent), `standing_below_threshold` (→student, throttled once/day via Redis), `account_status_changed` & `password_reset` & `role_changed` (→target user, from existing admin flows), `key_provisioned` (→teacher). Every type maps to a deep link. |
| 7 | **At-risk stays deterministic** — no LLM. A scoped grouped computation (teacher's sections / admin scope) reuses the standing rules: rate = (present+late)/counted, `below_threshold` → `at_risk` ordering by (status, lowest rate), plus `absencesBeforeBelowThreshold` so "one away" students surface too. |
| 8 | **Filters are centralized and URL-synced on web** (`?` params → shareable deep links): one `FilterBar` primitive (web) + `FilterChipsRow` (Android) composing existing select styling. All roster-backed filters (section/subject/student) are **server-scoped competitively** — a teacher can never filter into someone else's section (reuse `adminRecordWhere`/teacher scopes). |
| 9 | **Dashboard period selector** (7 days / 30 days / this semester / custom) drives the teacher and admin overview + widgets. `admin-overview` gains an optional range (default: same semester window the widgets use today). |
| 10 | **Parity + conventions:** every surface ships web + Android in the same train; existing Suspense/loading/accessibility rules; no new hex tokens; push never blocked behind offline flows; AGENTS.md conventions for tests/commits. |

## 4. Feature specs & milestones

### NF — Notifications

| ID | Scope | Acceptance criteria |
|---|---|---|
| **NF1 — Backend core** | `Notification` + `PushSubscription` models + migration; `notifications.service` (create/list/unreadCount/markRead/markAll, type + dedupe/throttle helpers); endpoints `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/read` (`{ids?|all:true}`); gateway emits `notifications:new` to the user room on create; audit-free (read-mostly) but every admin-account trigger writes through existing audit paths unchanged | service + gateway tests: fan-out to the user room, unread counts, throttle for `standing_below_threshold`, marshal shapes; suite green |
| **NF2 — Trigger wiring** | emit from: disputes create/resolve, excuse endpoints (NF-EXC contract), auto-absent paths (cron + session end), standing evaluation (below/at-risk status change), admin account mutations (status/role/password) | integration tests per trigger with correct recipients/links; no duplicate storms (per-user per-type minute-window guard) |
| **NF3 — Web center** | Bell + unread badge in the faculty/student shells (sidebar header cluster); dropdown panel (virtualized list, group-by-day, unread bold + dot, mark-one/all, deep-link navigation, empty state); realtime badge updates + optimistic read; reduced-motion/a11y (aria-expanded, keyboard) | Playwright spec: badge increments on a seeded event; open→mark-read persists after reload |
| **NF4 — Android center** | Bell on both dashboards + `(tabs)/notifications.tsx` (hidden route), unread badge, list with relative time, tap → deep link, mark-all; `expo-notifications` install + token registration → `POST /notifications/push-token`; foreground handling quiet (in-app center is source of truth) | Maestro assert on badge + list; jest for helpers; 273 baseline stays green |

### EXC — Excuse workflow

| ID | Scope | Acceptance criteria |
|---|---|---|
| **EXC1 — Schema & contract** | Prisma: add `excused` to `AttendanceStatus`, add the Decision-3 record fields + `EXCUSE_REQUESTED` etc. trigger types; shared types (`excused` status, `ExcuseReason`, `ExcuseInput`), validation schemas, `ApiClient` methods: `requestExcuse(recordId, data)`, `listExcuses(filters)`, `decideExcuse(recordId, decision, note?)`; evidence upload reuses the proofs base64 pattern with the same size cap | migration reversible; shared builds; both clients implement; zod DTOs; scope matrix tests (student-owned only; teacher-in-scope only) |
| **EXC2 — Endpoints & rules** | `POST /attendance/records/:id/excuse` (student, own record, only when status `absent`/`late`, one open request, evidence optional, rate-limited); `GET /attendance/excuses?status=…&sectionId&date` (teacher scope; admin scope read-only); `POST /attendance/records/:id/excuse/decision` (teacher: `approve` → status `excused` + fields stamped, `reject` → unchanged + reason; both fire `excuse_decided`); audit rows (`attendance.excuse.*`) | service tests: happy path, double-request 409, non-own record denial, approve/reject transitions, cron never touches `excused` |
| **EXC3 — Student UI (web+android)** | History rows for `absent/late` get "Request excuse" (modal/sheet: reason select, description, optional photo via the existing upload patterns); "My excuse requests" list with status chips (Requested/Approved/Rejected + review note); standing banner/assistant copy mention excused sessions are excluded | Playwright + Maestro journey; survey chip states; suite green |
| **EXC4 — Teacher UI (web+android)** | "Excuses" workspace mirroring disputes: queue with pending/resolved tabs, subject/section/date filters (FIL primitives), evidence viewer, Approve/Reject + note modal; sidebar item + More-sheet entry (`大河`-style icons consistent with disputes); notifications wired both directions | Playwright + Maestro journey; disputes-parity acceptance; audit assertions |
| **EXC5 — Ripple updates** | Standing evaluator excludes `excused` (+caveat), AI tools/reports/exports include it (`AttendanceReport.totals/summaries`, session CSV status, student dashboard stat card + History "Excused" tab, docs/service status column), `StatusBadge` styles on both platforms, AGENTS/attendance-plan status lifecycle note | contract tests for every consumer; visual QA of badge in both themes |

### RISK — At-risk oversight

| ID | Scope | Acceptance criteria |
|---|---|---|
| **RISK1 — Backend** | `GET /attendance/at-risk?sectionId?&limit` (teacher: own sections; admin: scope) — grouped computation reusing standing rules; returns per student: status, rate, absencesRemaining, lastAbsenceDate, sectionName; sorted worst-first (`below_threshold` first by lowest rate, then `at_risk`, then `on_track` cutoff by limit) | unit + scope-matrix tests; perf: single grouped query set, no N+1 student loop |
| **RISK2 — Teacher surfaces** | Dashboard widget "Students to check on" (top 8 + section filter dropdown via FIL primitives), row → student detail; section detail gains a "Standing" column with the same chips | Playwright widget render + link; android dashboard card list; suite green |

### FIL — Filters

| ID | Scope | Acceptance criteria |
|---|---|---|
| **FIL1 — Primitives** | Web `FilterBar` (labeled selects, date-range pair, status multi-chip, clear-all, URL `?`-sync preserving other params) + Android `FilterChipsRow`; both consume existing token styling | unit tests: param serialization round-trip, clear-all, deep link restore |
| **FIL2 — Teacher surfaces** | Attendance Log: + subject, section, status, student search, presets (Today/7d/30d) — wired to the **already-supported** server filters (contract: `GET /attendance/report` stays; page consumes filtered rows); Sessions list: + subject, section, status, date range; Disputes: + section, date range | every filter URL-round-trips; server-scoped tests prove out-of-scope sections can't leak; suite green |
| **FIL3 — Admin surfaces** | Reports: + section filter, department filter (institution admins), status summary chips, **vs previous period** delta on totals; admin dashboard: period selector driving `admin-overview?range=` (service gains optional range) | Playwright filter journeys; admin-overview range tests; suite green |
| **FIL4 — Student history** | + subject and date-range client filters alongside status tabs | Playwright + Maestro; suite green |

## 5. Testing Strategy

Per-feature unit/integration as listed in each table; monorepo gates at every milestone (`backend 619+`, `web 220+`, `android 273+`, shared); Playwright+Maestro journeys for the three user-facing flows (excuse request→decision, notification badge→read, filter deep links); containerized smoke for migration `excused` + notification fan-out after rebuild.

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `excused` enum migration on existing DBs | PG 16 allows `ALTER TYPE … ADD VALUE`; value not used in the same transaction; idempotent guard via `DO $$ … IF NOT EXISTS` on `unnest(enum_range(NULL::\"AttendanceStatus\"))` |
| Notification spam (cron-driven absence marks) | per-user, per-type Redis throttle; batch cron marks into one digest notification per run |
| Excuse abuse during exam season (evidence-less requests) | optional evidence + teacher decision is authoritative; rate limit per student/day; audit everything |
| Filter perf on large ranges | reuse scoped grouped queries; records caps (`take` + pagination); indexes confirmed in database-plan |
| Push token churn on Android | upsert by token; prune on `expo-notifications` registration errors |
| Old cached frontends still polling while teacher filter changes | filters are read-only until applied; server scope unchanged |

## 7. Out of scope (v1)

Email/SMS digests (needs infra), parent accounts, web push for non-installed PWA users beyond the env-gated NF-late item, AI-drafted excuse decisions, auto-approval rules.

## 8. Open Questions (defaults if silent)

1. May teachers file excuses **on behalf of** students (paper slips)? (Default: no — students file; v1.1 if wanted.)
2. Should `late` records be excuse-eligible, or only `absent`? (Default: both, since a late can be transit-excused; teacher decides.)
3. Notification retention: **30 days**, then pruned by the nightly maintenance job. (Default: yes.)

Say **go** (and override any default) and I'll implement in the locked order — FIL → NF → EXC → RISK — with the full verification gates per milestone.


## 9. Implementation Addendum (delivered)

| Area | Delivered |
|---|---|
| FIL | `FilterBar` + URL-synced filters (web) and `FilterPrimitives` (Android); Attendance (subject/section/presets), Sessions (subject/section/status/date), Disputes (section/date), Reports (section + department + excused totals), student history (subject/date/status), teacher dashboard period selector. Server report gained the `department` filter (institution vs pinned department scope). |
| RISK | `GET /attendance/at-risk` (grouped, scope-checked, no LLM) + teacher dashboard "Students to check on" widget on both platforms with section filters and student-detail links. |
| NF | `Notification` + `PushSubscription` models/migration; list/unread/mark-read/push-token endpoints; realtime `notifications:new` via the per-user gateway room; web bell + panel; Android bell + notification center; Expo push registration/permission/tap routing (dev-client rebuild required). Triggers wired for disputes, excuses, auto-absent marks, standing warnings, account actions, and key provisioning. 30-day retention job. |
| EXC | `excused` status + record-anchored excuse fields; student request (absent/late, evidence via the proofs storage pipeline), teacher queue + approve/reject with note, review stamps, audit rows, notifications both directions; standings exclude excused with a caveat; reports/CSV/AI counts/status badges updated across web + Android; dedicated `/faculty/excuses` workspace + Android screen. |
| Verification | Backend 674 tests / 63 suites; web 254 / 39 files; Android 298 / 21 suites; shared 87; typecheck/lint/format/build clean. Container smoke: request excuse → teacher queue + notification → approve → `status=excused` → student notification (unread 1 → mark-read 0), at-risk endpoint returns ordered students, admin report `department=CCIS` works, totals include `excused:1`. |

### Notes

- Web push (VAPID) is intentionally deferred (env-gated follow-up); the web notification center works in-app with realtime + polling.
- Android push requires a fresh dev client/EAS build (`expo-notifications` plugin + `POST_NOTIFICATIONS` permission).
- Dashboard trend buckets have no `excused` slot in the shared contract, so excused records are omitted from trends (same as `pending`).
- The section-detail Standing column and email digests remain out of scope.
