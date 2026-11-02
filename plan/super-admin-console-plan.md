# Super Admin Console — Scope Fix, Dashboard v2, Account & Role Management

> **Status:** Implemented (SA1–SA5 + SA7). SA6 intentionally deferred (Option A chosen).
> Companion to
> [`bulk-import-plan.md`](./bulk-import-plan.md) (another agent is building import — this
> plan does **not** own import UI or the web client's missing import methods) and to
> [`mobile-improvement-plan.md`](./mobile-improvement-plan.md) (whose Parity Gate, MP6,
> governs simultaneous rollout of every SA change below).

---

## 1. Goal

Turn the super admin experience on **both platforms** into an intentional
**administration console**: account control, role management, institution settings,
audit, reports — not a read-only echo of the teacher UI.

1. Remove classroom-data surfaces (Subject Directory, Session/Attendance/Dispute
   Monitoring, Schedule) from the super admin's navigation and dashboard on web **and**
   Android.
2. Rebuild both super admin dashboards on a shared admin-overview contract (no inherited
   teacher components, no hardcoded "System Health: Nominal").
3. Ship the missing account-management capabilities: edit profile, change role,
   filtered/paginated user lists, super-admin provisioning — backend + both clients.
4. Live feedback: a real-time **Server Status page** continuously updated over the
   existing Socket.IO gateway (charts ticking live in the console), not a poll-a-JSON
   endpoint — see SA7.

## 2. Verified Current State (facts from the audit)

| Fact | Evidence |
|---|---|
| Super admin rides the **entire teacher route tree** on both platforms — web `/faculty/*`, Android `(faculty)/*` — and is differentiated with scattered `isSuper` ternaries | `frontend/src/components/layout/sidebar.tsx:52-63` (`superAdminNav` = 10 items, 4 of them classroom monitoring); `android/app/(faculty)/_layout.tsx:16-46` (More sheet duplicates monitoring items) |
| **Android super dashboard is the teacher dashboard**: tiles labeled "Subjects/Students/Sessions Today/Pending Disputes", a "Session Monitoring" today-events feed, and a "Subject Directory" listing **every institution section**, tappable into rosters | `android/app/(faculty)/dashboard.tsx:45-57` (`loadDashboard` fetches ALL sections when `role === 'super_admin'`), `:138-236` (tiles + directory) |
| Web super dashboard is admin-styled but includes "Total Subjects", a "View Global Subjects" action card, and a **hardcoded** `System Health: Nominal` string | `frontend/src/app/faculty/page.tsx:358-363` (`value: 'Nominal'`), `:489-498` (Global Subjects card) |
| Web **blocks** super admin from `/faculty/schedule` entirely; Android **admits** super admin to "Campus schedule" (institution calendar) — contradicting "no schedules for admins" | `frontend/src/app/faculty/schedule/page.tsx:446-448` (super → redirect); `android/app/(faculty)/schedule.tsx:33` (`useAuthGate(['teacher','super_admin'])`), `:94-96` |
| Android `attendance.tsx` and `search.tsx` have **no role gate at all** (any logged-in user deep-linking lands there; only backend scopes data) | `android/app/(faculty)/attendance.tsx:27`, `android/app/(faculty)/search.tsx:29-37` |
| User management today = create teacher/student + reset password + enable/disable. **No account edit, no role change, no way to create another super admin** | `frontend/src/app/faculty/users/page.tsx`; `android/app/(faculty)/users.tsx`; backend surface is exactly: `GET /users` (paginated, unused by any client), `GET /users/teachers`, `GET /users/students`, `POST /users/teachers`, `POST /users/students`, `PATCH /users/:id/password`, `PATCH /users/:id/status` — `backend/src/users/users.controller.ts:17-78` |
| There is no `PATCH /users/:id` profile edit and no role-change endpoint anywhere | `backend/src/users/users.controller.ts` (full controller read confirms) |
| Roles are fixed at creation (`CreateTeacherDto`/`CreateStudentDto`); `UserRole = 'super_admin' \| 'teacher' \| 'student'` | `backend/src/users/dto/manage-user.dto.ts`; `shared/src/types/user.ts:1` |
| Super admin self-service is deliberately blocked (no password reset or disable for `super_admin` targets), which means **super admins can only come from seed** | `backend/src/users/users.service.ts:274,313`; `backend/prisma/seed.ts:33` |
| `GET /users` supports `limit/offset` but **no client uses it**; both UIs call unpaginated `getTeachers()`/`getStudents()` with zero search/filter | `users.controller.ts:17-21` + `users.service.ts:20-26`; callers: `frontend/src/app/faculty/users/page.tsx:44-48`, `android/app/(faculty)/users.tsx:79-83` |
| Frontend `api` object lacks the 4 bulk-import methods the shared `ApiClient` interface now requires while asserting `api satisfies ApiClient` | `frontend/src/lib/api-client.ts:968`; interface: `shared/src/types/api.ts:306-309`; **owned by bulk-import-plan BM1** (which re-frontends the shared contract) |
| Import pipeline exists backend-side + Android-client-side with **no UI anywhere** | `backend/src/users/users.controller.ts:35-49`, `android/services/api-client.ts:701-711`; **owned by bulk-import-plan** |
| Dispute resolution, cockpit mutations, section management are already correctly teacher-only; backend forbids super-admin resolution | web `disputes/page.tsx:566`, app `(faculty)/disputes.tsx:239`, app `sessions/[id].tsx:119,286`; `backend/src/disputes/disputes.service.spec.ts:218` |
| Android-only plans previously granted super admin Schedule on mobile | `plan/mobile-improvement-plan.md` Locked Decision 4 + MP2 **— superseded by this plan (SA1)** |
| `DashboardOverview` already carries `counts.{faculty,students,subjects,sections,sessionsToday,pendingDisputes}` + trends + recent activity | `shared/src/types/api.ts:173-204` |

## 3. Locked Decisions

| # | Decision |
|---|---|
| 1 | **Super admin surfaces = admin console only.** Navigation on both platforms shrinks to: Dashboard · User Management · System Reports · Audit Log · Institution Settings · Global Search. Subject/Session/Attendance/Dispute Monitoring and Schedule are removed from super admin nav **and** from the super admin dashboard on both platforms in the same release (Parity Gate). |
| 2 | **Route access policy (Option A, recommended):** the shared `(faculty)` route tree stays; classroom screens keep working if a super admin reaches them via Global Search result or deep link (read-only, backed by existing admin-scope read authorization). What we delete is every *proactive* surface (nav items, dashboard feeds). Rationale: search journeys (find a student → open their section) are a lookup tool, not a monitoring feed, and stripping routes benefits nothing — the backend already scopes every read. Option B (strict lockout: classroom routes bounce super admin + search returns students only) is kept as SA6, decision-gated. |
| 3 | **Shared route group stays in v1** — no new `(admin)` route group; the parity risk left over from the `isSuper` sprinkling is handled by removing the super-specific surfaces and a stronger e2e gate, not a giant route refactor. |
| 4 | **Dashboard contract first:** a new shared `AdminOverview` type + `GET /dashboard/admin-overview` (or extension of the existing overview) is defined before either UI is rebuilt; both dashboards consume it. Counts needed: active/disabled faculty, active/disabled students, active sessions right now, pending disputes, recent admin/audit activity, health probe result. The attendance trend chart moves out of the dashboard — it remains available on the super-admin-only Reports page. |
| 5 | **System Health is real data:** dashboard reads `GET /health` (existing health module) instead of the hardcoded `'Nominal'`. |
| 6 | **Role changes are constrained:** `PATCH /users/:id/role` supports `student ↔ teacher` only — a teacher with existing sections cannot become a student; a `super_admin` cannot be role-changed by this endpoint; the actor cannot change their own role. Department scoping follows `admin-scope.ts` (`adminCanAccessUser`). Student→teacher requires a department on the target. |
| 7 | **Super-admin provisioning:** new `POST /users/admins` — institution-scope admins only, password-policy enforced, target must currently be a teacher (or fresh creation), audited like every other account mutation. No self-service role elevation. |
| 8 | **Account edit** (`PATCH /users/:id`) covers: `fullName`, `department`, and role-specific fields (`email` for teachers; `program`, `yearLevel` for students). No student-number mutation (identity key), no email swap to an address already in use, every change audited. |
| 9 | **Supersession:** this plan reverses `mobile-improvement-plan.md` Locked Decision 4 ("Super admin gets Schedule on mobile"); the implementing PR must remove the super-admin Schedule item/gate on Android and record the supersession in that file. |
| 10 | **AGENTS.md update at implementation time** (docs-only edit inside the implementing PRs): the Super Admin capability bullet changes from "read-only access to classroom resources" to "account administration, reports, global lookup, audit; classroom routes are reachable only via explicit lookup (Global Search), never via feeds". |
| 11 | **Server Status is streamed, not fetched:** metrics snapshots are pushed by the backend over the existing Socket.IO gateway (`server:metrics` room) on a 3–5 s tick that only runs while at least one super admin is subscribed; the client keeps its own rolling history and renders charts. The role-gated JSON snapshot (`GET /dashboard/server-status`, initial load + reconnect fallback) is an internal detail, never the page's update mechanism. `GET /metrics` (Prometheus text, token-gated) stays untouched for external scraping — Grafana remains the Ops-depth option and the page is built for the in-console view. |

## 4. Milestones (SA1–SA6)

| ID | Scope | Key files | Acceptance criteria |
|---|---|---|---|
| **SA1 — Navigation & scope cleanup (both platforms)** | Web: `superAdminNav` reduced to the 6 admin items (sidebar.tsx). Android: More-sheet super list drops Schedule / Session / Attendance / Dispute Monitoring (settings/audit/search stay); super tab bar keeps Dashboard · Users · Reports · More. Route hardening: every `(faculty)` Android screen calls `useAuthGate` with an explicit role list — fixes `attendance.tsx` and `search.tsx` having **no gate**; web pages with teacher-only gates get explicit comments. Remove the "View Global Subjects" action card from the web super dashboard (superseded by SA2's full rebuild). Update `e2e/auth.spec.ts` (super admin journeys) and the Maestro `03-super-admin-journey.yaml` to assert the new visible set; record the MP2-LD4 supersession note in `plan/mobile-improvement-plan.md`. | `frontend/src/components/layout/sidebar.tsx`, `android/app/(faculty)/_layout.tsx`, `android/app/(faculty)/attendance.tsx`, `android/app/(faculty)/search.tsx`, `e2e/auth.spec.ts`, `android/app/*maestro*`, `plan/mobile-improvement-plan.md` (docs note) | super admin sidebar/More-sheet show exactly the 6 admin items on both platforms; every Android `(faculty)` screen has an explicit gate; `pnpm lint`/typecheck green; web auth E2E + android tests pass |
| **SA2 — Super admin dashboard v2 (both platforms)** | Shared contract first: `AdminOverview` type + `GET /dashboard/admin-overview` (super_admin-only, scoped via `admin-scope.ts`). Web: rebuild `SuperAdminDashboard` — stat tiles (Active Faculty, Active Students, Active Sessions Now, Pending Disputes), accounts panel (active/disabled splits + link to User Management), Recent Administrative Activity widget fed by the **existing** audit-logs service (no new table), real `GET /health` status tile, quick-actions (Manage Users · Reports · Audit · Settings). Android: dedicated `SuperAdminDashboard` component — same tiles + activity list + actions; **stops loading all sections**, drops the Subject Directory surface. Remove the dashboard attendance trend (stays on Reports). | `shared/src/types/dashboard.ts` (new), `shared/src/types/api.ts` (ApiClient method), `backend/src/dashboard/*` (+ spec), `frontend/src/app/faculty/page.tsx:317-508` (rewrite), `android/app/(faculty)/dashboard.tsx` (rewrite) | super admin dashboards on both platforms show zero classroom feeds (no sections list, no today-events-class flow, no "Total Subjects"); `GET /health` drives the health tile; backend tests cover scoping (institution vs department) + non-admin rejection; both dashboards hit the same endpoint with no duplicated fetches |
| **SA3 — User list & edit & role endpoints (backend)** | Extend `GET /users` with `role`, `q` (name/email/student-id), `department`, `status` filters + `limit/offset` (admin-scope-filtered). Add `PATCH /users/:id` (profile edit per Locked Decision 8; whitelist DTO; `forbidNonWhitelisted` style consistent with the rest). Add `PATCH /users/:id/role` per Locked Decision 6 (transactional guard: teacher→student blocks while `Section.teacherId` rows exist; student→teacher requires department). Add `POST /users/admins` per Locked Decision 7. Emit audit events for edit/role/create-admin (existing audit-logs integration). Keep existing hard rules: never reset/disable super admins. | `backend/src/users/users.controller.ts` (new routes), `users.service.ts` (find filters, edit, role, createAdmin), `users/dto/*` (new DTOs), `backend/src/audit-logs/*` (event kinds if needed) | service + integration tests: filter matrix, scope matrix (department admin vs institution), guard matrix (own-role change rejected, super_admin target rejected, teaching teacher demotion rejected, weak password rejected on admins); `authorization-policy.spec.ts` updated so every new admin method lists exactly `['super_admin']` |
| **SA4 — Users screen v2 (web)** | Search bar (debounced `q`), role/department/status filter selects, server-side pagination on `GET /users`; Edit profile dialog (fields per role); Change-role action with confirm + explicit consequence copy; "Add Super Admin" button (visible only when actor is institution scope; hidden for department admins); keep reset-password / enable-disable flows. Department admins see a "department-scope" hint. | `frontend/src/app/faculty/users/page.tsx` (+ components if the page grows; cap file size), `frontend/src/lib/api-client.ts` (new methods) | table loads ≤ pageSize rows per request; search hits the server (debounce + abort); edit/role actions roundtrip and reflect immediately; department admin cannot see Add-Super-Admin; Playwright spec for edit + role-change + filters added to the web E2E suite |
| **SA5 — Users screen v2 (Android)** | Same capability set on mobile primitives: search field with debounce, filter chips/filters sheet, `FlatList` pagination (`onEndReached` → next page), Edit sheet, role-change confirm sheet, "Add Super Admin" (institution scope only); keep existing create/reset/disable. Dust off `CampusToast` for feedback (alerts stay for destructive confirms per MP2 conventions). | `android/app/(faculty)/users.tsx` (+ small components), `android/services/api-client.ts` (new methods) | capability parity with SA4 (Parity Gate); Maestro super-admin journey extends with: search → edit → role change; 135+ android tests stay green |
| **SA6 — (Optional, decision-gated) strict classroom lockout** | Only if the product owner chooses Option B after SA1–SA5: flip classroom-shared gates from `['teacher','super_admin']` → `['teacher']` for schedule / sessions / sections / attendance / disputes on both platforms; Global Search for super admin returns students only (backend `search()` filters + both search pages); remove the remaining super-admin branches in those screens (dead `isSuper` code cleanup). | `android/app/(faculty)/schedule.tsx`, `sessions/[id].tsx`, `sections/[id].tsx`, `disputes.tsx`, `attendance.tsx`, `search.tsx`; `frontend/src/app/faculty/{schedule,sessions/[id],sections/[id],disputes,attendance,search}`; `backend/src/dashboard/dashboard.service.ts` (search) | super admin deep-link to any classroom route bounces; search returns students only; no `isSuper` remnants in classroom screens (grep gate) |
| **SA7 — Real-time Server Status page (web)** | Backend: `MetricsService.snapshot()` (metric values extracted from the existing `prom-client` registry — no new metric definitions) + interval publisher (3–5 s, runs only with subscribers) that emits `server:metrics` to a gateway room; room join restricted to `super_admin` in the gateway (same auth path as the admin realtime features, `attendance.gateway.ts:127`); one-shot `GET /dashboard/server-status` (`@Roles('super_admin')`) for initial paint + reconnect fallback. Web: new `/faculty/server-status` page + "Server Status" sidebar item — live charts as **in-house SVG sparklines/gauges** (same pattern as the Reports donut, no chart dependency): HTTP req rate + error rate, latency p50/p95, event-loop lag, RSS/CPU%, DB + Redis readiness gauges, BullMQ queue depth + failed jobs, active sockets. Rolling ~15-min client-side history survives tab visibility with livedata on reconnect; theme tokens + `aria-live` status line. Parity Gate justification: web-only, an ops console feature ("super-admin-only" is the mobile plan's accepted exception type). | `backend/src/observability/metrics.service.ts` (snapshot + publisher), `backend/src/realtime/*` (room), `backend/src/dashboard/*` (snapshot endpoint + roles), `frontend/src/app/faculty/server-status/page.tsx`, `frontend/src/lib/api-client.ts`, `frontend/src/components/layout/sidebar.tsx`, `e2e/auth.spec.ts` | super admin sees live-ticking charts (visible change within one tick); teacher/student denied at page and room level (unit + gateway test); snapshot endpoint 403s non-super-admins; publisher emits nothing when zero subscribers (idle test); page renders from snapshot alone on first paint; all 375+ backend / 93+ frontend tests stay green |

## 5. Non-Goals

- **Bulk import UI / web client import methods** — owned by `bulk-import-plan.md` (BM1–BM6). This plan depends on its contract, never duplicates it.
- No new `(admin)` route group or URL rename (Locked Decision 3; revisit later if `isSuper` intrusion recurs).
- No redesign of Reports, Audit Log, or Settings pages (already correct).
- No department/organizational-hierarchy data model, no new tables.
- No dispute/attendance *management* powers for super admin (existing prohibitions stand).
- No dark-mode or design-token work here.

## 6. Sequencing & Dependencies

1. **SA1** — pure UI/gate surgery, no backend dependency; ship first (immediate fixes to the "unnecessary info" complaint).
2. **SA2** — depends on nothing except its own contract; parallelizes with SA3.
3. **SA3 → SA4 → SA5** — backend lands before the two clients; SA4 and SA5 can follow together once SA3 merges (Parity Gate: web + android ship users v2 in the same train).
4. **SA6** — decision-gated; only after SA1–SA5 are stable.
5. Run `pnpm typecheck` across the workspace before starting: confirm the `satisfies ApiClient` state reported in §2 (if it already fails, BM1 landing first unblocks the tree — do not merge SA milestones on a red base).

## 7. Testing Strategy

| Layer | Approach |
|---|---|
| Unit (backend / jest) | `users.service`: filter/scope/guard matrices for list-edit-role-createAdmin; `dashboard.service`: admin-overview scoping + non-admin rejection |
| Unit (web / vitest + jest shared) | admin-overview mapping (percentages, health states), users-table filter/pagination logic |
| Unit (android / jest) | dashboard component logic (no sections fetch for super), users screen search debounce + pagination |
| E2E (Playwright) | `auth.spec.ts`: super admin sees exactly the 6 nav items; users-page flows (edit, role change, filters, Add Super Admin visibility); dashboard render check (no classroom feeds) |
| E2E (Maestro) | `03-super-admin-journey.yaml` updated for SA1 nav set + SA5 user flows |
| E2E (Playwright, SA7) | auth spec: Server Status page 403/redirect for teacher+student; super admin sees initial snapshot render (websocket exchange over Playwright only verified reachable, chart delta asserted cheaply with two polls) |
| Realtime unit (backend) | gateway room join matrix (admin/teacher/student); publisher idle-with-no-subscribers; snapshot extraction from registry |
| Policy regression | `authorization-policy.spec.ts`: every newly added admin endpoint restricted to `['super_admin']`; classroom-mutator list still excludes `super_admin` |
| Existing suites | 375 backend / 93 frontend / 135 android tests stay green at every milestone |

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Removing monitoring surfaces may hide legitimately useful oversight | Reports page (super-admin-only) already exports/summarizes attendance institution-wide, and Global Search remains the explicit lookup path; SA6 documents the stricter variant if the team opts in |
| Role-change semantics surprise downstream code (dashboard scopes, enrollments) | Constraints in Locked Decision 6 keep role flips simple (no super_admin involvement, no demotion while teaching); one integration test per transition; audit event includes before/after role |
| `GET /users` filters become an enum/leak vector (e.g., department filter bypassing scope) | All filters compose **inside** `adminUserWhere()` — scope cannot be widened by query params; tests assert a department admin cannot filter outside their department |
| Parity drift between SA4 and SA5 | Ship both in the same train per Parity Gate; e2e specs land with their client milestone |
| Android extras from old decisions (super Schedule from MP2) conflict with SA1 | Locked Decision 9 + implementing PR notes the supersession in `mobile-improvement-plan.md` |
| SA7 doubles socket pressure during peak attendance traffic | Publisher runs one tick with a single-payload fan-out per room (not per socket), pauses with zero subscribers; snapshot is read-only registry access, no DB/Redis round-trips per tick |
| SA7 numbers reflect only one backend process behind a load balancer | v1 documents the limitation on-page ("this instance"); multi-node aggregation via the existing Redis Pub/Sub path is a listed upgrade, not a blocker |
| Web typecheck red from the shared-contract/import mismatch | Pre-gate typecheck; if red, time the branch behind BM1 and never commit SA milestones on a broken base |

## 9. Open Questions (owner must answer before SA3)

1. Should super admins be able to change their **own** department/other profile fields, or is super-admin self-edit deliberately out (currently only password reset exists and it is blocked too)? *(Default: out — consistent with "super_admin accounts are managed by DB ops/seed".)*
2. For `POST /users/admins`: pre-rebuilt from existing teachers, direct creation with full form, or both? *(Default: both — promote existing teacher (audited) or create fresh.)*
3. SA6 Option B — strict lockout of classroom deep links for super admin, or keep Option A lookup access? *(Default: Option A, revisit after SA1–SA5 ship.)*
4. SA7 tick cadence: 3 s or 5 s, and should history persist across reloads (Redis ring buffer, ~24 h) or stay session-local (client rolling window)? *(Default: 5 s tick, session-local history — persistence is a cheap follow-up.)*

---

## Addendum — Implementation Record

**Open questions resolved with the plan defaults:** Q1 super-admin accounts are not editable through the console (create/promote only); Q2 `POST /users/admins` supports both promotion and fresh creation; Q3 Option A (no SA6); Q4 5s ticks with session-local history.

**SA1–SA5 + SA7 shipped:**
- Web nav now: Dashboard · User Management · System Reports · Audit Log · Server Status · Institution Settings · Global Search. Classroom monitoring items removed. Android super tab bar: Dashboard · Users · Reports · More; super More sheet: Global Search · Institution Settings · Audit Log.
- Web + Android super dashboards consume `GET /dashboard/admin-overview` only (no teacher feeds/sections fetches); real DB/Redis health; recent audit activity; account splits; quick actions.
- Users API: filtered/paginated `GET /users`, `PATCH /users/:id`, `PATCH /users/:id/role`, `POST /users/admins`, all super-admin scoped and explicitly audited (`admin.user.updated|role_changed|promoted|created`).
- Web + Android Users v2: server search/filters/pagination, role-specific edit, guarded role change, institution-only Add Super Admin (promote/fresh), department-scope hint. Existing bulk import, inactive/provisioned filters, and bulk activation were preserved.
- SA7: `server:subscribe` room (`server:metrics`, super_admin only), 5s publisher that idles with zero subscribers, `GET /dashboard/server-status` initial paint, web `/faculty/server-status` with SVG sparklines/gauges and 15-minute rolling history. `GET /metrics` untouched. Web-only per the plan's accepted parity exception.
- Every `(faculty)` Android screen now has an explicit `useAuthGate` role list; `attendance`/`search` were the previously ungated screens.

**Deviations / notes:**
- Role transitions validate the existing DB domain constraints to avoid 500s: student→teacher also requires the target to have an email (teacher rows require one); teacher→student requires the account to already carry student identity fields (studentId/program/yearLevel/department). Most teacher-only accounts therefore cannot be demoted without creating a student account — reported as a clear 400 rather than a DB failure. Plan LD6 only mentioned sections/department; this is an additive safety guard.
- `PATCH /users/:id` refuses super-admin targets (Q1 default) and rejects clearing a student department (DB constraint).
- The WebKit users-admin spec blocks service workers because the production SW bypasses Playwright route interception (test-only change).
- Local production-container cross-browser note: Firefox flags the known Zod CSP eval-probe console message; Chromium passes the full suite (66/66) and WebKit passes auth/users-admin incl. the new console journeys.
