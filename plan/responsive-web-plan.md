# Responsive Web Plan — every page consistent on phones

> **Status:** IMPLEMENTED (RW-0 … RW-5 executed; responsive harness 28/28 green; full Chromium E2E green).
> **Problem:** Mobile responsiveness is inconsistent across the web app. Some pages work on a
> phone; others overflow, cram 5-column rows into 375px, or demand horizontal scrolling for
> basic reading. Students are the primary in-class users of the PWA, and faculty increasingly
> use phones during class. This plan fixes every route in the web app, mechanically verified.

## 1. Objective + Definition of Done

- **Mechanical gate:** a Playwright spec enumerates **every route, per role**, at **375×812**,
  **390×844**, and **768×1024**, and asserts `document.documentElement.scrollWidth ≤
  window.innerWidth` (small tolerance). Zero assertions may be skipped: every exemption needs
  a code comment + justification and lives in a seed list that starts **empty**.
- Tables either fit or are **deliberately contained** in their own scroll region (never push
  the page wider), and the two admin-critical tables (Users, Audit Log) get a readable stacked
  card layout on `< sm` instead of an 860–900px scroll.
- Stat/filter/header rows collapse coherently (`1 → 2 → 5` columns across sm → md sizes).
- Inputs are ≥16px effective font on touch widths (no iOS auto-zoom), primary icon controls
  have ≥44px touch targets, and safe-area insets are respected in standalone PWA mode.
- Desktop (`md+`) rendering is pixel-identical to today — this is a small-screen retrofit,
  not a redesign. All work is client-side; no backend/contract changes.

## 2. Current-state audit (facts, gathered today)

**Already correct / no action:**
- Shell: `Sidebar` renders a sticky mobile top bar + slide-out drawer `md:hidden`, desktop is
  a persistent `md` sidebar (`components/layout/sidebar.tsx`). Drawer itself is fine.
- Next.js App Router ships the default `width=device-width` viewport meta; themeColor set.
- Session cockpit body content is `max-w-4xl mx-auto` stacked cards; QR card actions already
  `flex-wrap`; session info row already `flex-wrap`.
- `overflow-x-auto` containers already exist around most tables (page never overflows, but
  phones must scroll sideways to read — see per-page fixes).

**Confirmed offenders (evidence):**

| Symptom | Where (file:line) | Effect on a phone |
|---|---|---|
| Fixed-width tables | `users/page.tsx:482` `min-w-[860px]`, `audit-logs/page.tsx:113` `min-w-[900px]` | Sideways scroll to read any row |
| Fixed-width week grids | `faculty/schedule/page.tsx:258`, `student/schedule/page.tsx:254` `min-w-[700px]` | Entire timetable unreadable without scrolling |
| Un-adapted column grids | `grid-cols-7` attendance presets, faculty/student calendars; `grid-cols-5` dashboards/ID card/chips; `grid-cols-3/4` section detail, server status, reports, cockpit stats, BulkImport steps | Cramped columns, truncated text |
| Low responsive density | ~20 route files contain only **1** `md:` variant while carrying 3–7-col grids (settings, search, excuses, sessions list, sections/[id], students/[id], attendance, reports, create forms, student subject pages) | Breakpoints are effectively desktop-only |
| Toolbar overflow risk | Filter rows using `min-w-[12–14rem] flex-1` without a wrapping parent (some pages wrap, some don't) | Selectors push page width |
| Desktop-only captures | `e2e/visual-capture.spec.ts` snapshots only 3 pages at 375px, **no assertions** | Nothing catches regressions |

## 3. Non-goals

- No visual redesign, token changes, or dark-mode rework (dark classes ride along only where
  a rule is touched).
- No new backend endpoints or shared-contract changes.
- Native Android is covered by `plan/mobile-improvement-plan.md`; this plan is web-only.
- No support below 360px beyond not crashing (360px must pass; older devices are out of scope).

## 4. Workstreams

### RW-0 — Responsive audit harness (build first, everything else measured against it)

**Files:** `e2e/responsive.spec.ts`, `e2e/helpers.ts` (nothing else).

Enumerate routes explicitly in the spec (name → path → role); do not scrape the router.
Coverage list = every page in §6 (auth/mixed 4 + student 6 + faculty 18).

- Per role, login via current `apiLoginFaculty` / `apiLoginStudent` helpers, drive `page.goto`
  to each route, wait for network idle + a route-defined ready selector (e.g. `getByRole`
  heading), then evaluate:
  `document.documentElement.scrollWidth <= window.innerWidth + 1`.
- Viewports: 375×812 (iPhone mini), 390×844 (iPhone 14), 768×1024 (iPad portrait).
- Failed route → collect `{ route, viewport, docWidth, innerWidth, widestChild }` into a
  printed table so fixes get exact numbers, not screenshots eyeballing.
- Extend `visual-capture.spec.ts` to snapshot every route at 375×812 into
  `e2e/captures/mobile/` replacing the single 3-page mobile test, for manual review evidence.
- **Acceptance:** harness runs green against the *current* seed where the app is already OK,
  red where this plan says pages are broken — the diff is the fixed scope.

### RW-1 — Foundations (shared primitives + PWA touch alignment)

**Files:** `app/layout.tsx`, `globals.css`, `components/layout/sidebar.tsx` + `NotificationBell.tsx`, small shared helpers.

1. **Safe-area (standalone PWA):** `viewport-fit=cover` via the existing `Viewport` export +
   `env(safe-area-inset-*)` padding on the mobile top bar, drawer bottom, sticky footers, and
   the Assistant theater/dock chrome. `black-translucent` stays.
2. **iOS auto-zoom kill:** form inputs/selects render at 16px on `< sm` via one utility class
   (`.input-touch` or Tailwind `text-base sm:text-sm` convention) applied at the shared Input,
   and the handful of hand-rolled inputs in filter rows / search / date pickers.
3. **Touch targets:** min 44px hit area for icon-only controls (bell, menu, close, per-row
   cycle buttons, QR action icons) — via `p-2 -m-2` style padding or `size-11` wrappers.
4. **FilterBar wrap contract:** `FilterBar` row default `flex-wrap gap-3` and children stack
   `min-w-0 flex-1 basis-full sm:basis-0` so selectors occupy full rows on phones. Updated
   once in `FilterBar.tsx` + the per-page rows that bypass it.
5. **No design change check:** every rule behind `sm:`/`md:`/`lg:` so desktop output is
   byte-identical.

**Acceptance:** hovers untouched at md+, `pnpm -C frontend test` green (no snapshot changes
expected), safe-area verified by the RW-0 harness navigation bars not clipping under notch.

### RW-2 — Heavy tables → readable on phones (selective, not a rewrite)

**Files:** `faculty/users/page.tsx`, `faculty/audit-logs/page.tsx`, plus convention doc note.

- Pattern: keep the desktop `<table>` as-is; add `<md` stacked "row cards" built from the same
  row data (name/chips/primary action), rendered from one shared local helper per page (no
  cross-page abstraction weak enough to become a second source of truth). Column priority:
  1. Users → name/email, role + status badges, department, actions.
  2. Audit log → action + actor, target, timestamp, tenant badge.
  3. Teacher dashboard "recent activity" 3-col table: keep `overflow-x-auto`
     (fits 375px fine).
- Roster tables (sections/[id], cockpit) stay scroll-contained; cockpit roster gets sticky
  first column on `< md` so the name stays visible while cycling status.
- **Acceptance:** no `min-w-[8-9]00px` table reachable on phones without a contained scroll
  and a stacked alternative; RW-0 green at 375px; existing e2e users/admin selectors still
  resolve (they target labels/buttons, not table geometry).

### RW-3 — Weak-density page pass (the twenty "1 `md:`" routes)

Coherent breakpoints, page by page (approach per page in §6): collapse stat grids `5→2→1`,
`4→2→1`, `3→1`; preset chip rows `7→≤4→1`; calendar month `7-col` cell content hides day
numbers below `4-dot stacking`; settings tab bar becomes a horizontally scrollable pill row
(`overflow-x-auto` + snap); dialogs widen check (`max-w-*` verified ≤ 92vw). No page ships a
below-375px assumption; every change adds `sm:`/`md:` tokens only.

### RW-4 — Schedule & calendar mobile UX (the only structural change)

Faculty + student schedules:
- **Month calendar:** on `< md` keep the 7-col grid (it fits 375px with 48px cells) but
  collapse cell content to dots; tapping a day switches to the existing day-detail listing
  (no new data needed — reuse `generateCalendarEvents`).
- **Week timetable:** keep `min-w-[700px]` but wrap in a contained, snap-scrolled region with
  a subtle "scroll" hint gradient; auto-scroll to the current day column on mount.
- Student weekly schedule: same rules via `StudentWeeklySchedule.tsx`.

**Acceptance:** no page-level horizontal scroll (only the week region scrolls), today's
column visible on mount at 375px.

### RW-5 — Regression integration

- Add `responsive.spec.ts` to the standard CI Playwright project list (Chromium only) so
  overflow regressions fail CI; document in AGENTS.md verification counts.
- Plan addendum records final per-page status grid and CI numbers.

## 5. Verification

| Layer | Gate |
|---|---|
| RW-0 harness | All enumerated routes × 3 viewports: zero page horizontal overflow |
| Unit tests | `pnpm -C frontend test` green; new tests only where a shared primitive gains logic (FilterBar compose, safe-area padding helper) |
| Typecheck/lint/build | Clean |
| Existing E2E | Full Chromium suite still 69 passed / 0 failed (no selector/geometry regressions) |
| Manual | PWA standalone on a real phone: header under notch, drawer, scan, schedule scroll, cockpit roster cycles |

## 6. Every-route matrix (the "cover every page" contract)

Legend: **OK** = already responsive, verified by grep/read; **FIX** = this plan changes it;
**VERIFY** = harness-only confirmation expected. Route count matches `frontend/src/app` pages
(30 rendered pages + 2 redirects skipped).

### Auth / shared (4)

| Route | State | Action |
|---|---|---|
| `/` (auth-landing) | OK | VERIFY (already `md:`-aware hero) |
| `/login`, `/login/faculty`, `/login/student` | OK | VERIFY (role cards are 1-col stacking already) |
| `/privacy` | OK | VERIFY |
| `/offline` (PWA fallback) | OK? | VERIFY + safe-area bottom padding |

### Student (6)

| Route | State | Action |
|---|---|---|
| `/student/dashboard` (+`?tab=subjects|attendance`) | FIX | Stat rows: `5→2→1`; recent-activity table contained; enroll/scan modals ≤92vw; ID card `grid-cols-5` chips → wrap |
| `/student/schedule` | FIX | RW-4 rules via `StudentWeeklySchedule` (`grid-cols-7` cell collapse + contained scroll + autoscroll) |
| `/student/subjects/[id]` | FIX | 2-col → 1-col below sm; audit table kept contained (already wrapped) |
| `/student/subjects/[id]/sessions/[sessionId]` | FIX | 3-col stats → 2 → 1; dispute form fields stacked |
| `/student/subjects/[id]/create-session` (officer) | FIX | Form 2-col → 1-col; geofence map height bounded (`h-[240px]` instead of desktop tall) |
| `/student/assistant` | FIX | RW-1 inputs; message actions wrap (already `flex-wrap`); Focus geometry reuse |

### Faculty — teacher (13)

| Route | State | Action |
|---|---|---|
| `/faculty` (dashboard) | FIX | Teacher stats `2x?` and admin `grid-cols-5` row → wrap small; recent-activity table OK |
| `/faculty/subjects` | FIX | Subject/section cards `grid-cols-3` → `1 base, sm:2, lg:3` |
| `/faculty/subjects/create` | FIX | 2-col form → stacked |
| `/faculty/subjects/[id]` | FIX | 3-col info → stacked; sections grid `3→1` |
| `/faculty/subjects/[id]/sessions` | VERIFY | List only; header wraps already |
| `/faculty/sections/create` | FIX | Schedule builder / 4-col → stacked |
| `/faculty/sections/[id]` | FIX | Stats `4→2→1`; role chips 5-col wrap; roster contained; enrollment panel stacked |
| `/faculty/students/[id]` | FIX | ID card + `grid-cols-5` chips wrap; roster cycle buttons 44px |
| `/faculty/sessions` | FIX | Filter row `flex-wrap` + full-basis selects on phones; session cards `2→1` |
| `/faculty/sessions/create` | FIX | Bulk recurring block `4→2→1`; map height bounded; form 2-col → stacked |
| `/faculty/sessions/[id]` (cockpit) | FIX | Roster: sticky first column + contained scroll; stat `3→2` row; map + proof cards OK; QR modal ≤92vw |
| `/faculty/attendance` | FIX | Preset chips `7→wrap`; stat cards `5→2→1`; report table contained (already); CSV row wraps |
| `/faculty/schedule` | FIX | RW-4 rules |
| `/faculty/disputes` | FIX | Filter selects full-basis on phones; dispute cards single-column stack |
| `/faculty/excuses` | FIX | Filter row wrap; review modal fields stacked; status chips wrap |
| `/faculty/assistant` | FIX | Same shared chat fixes as student assistant |

### Faculty — super admin console (5)

| Route | State | Action |
|---|---|---|
| `/faculty/users` | FIX | RW-2 stacked cards on `< sm`; search/filter toolbar wraps; `grid-cols-4` stats → `2→1` |
| `/faculty/reports` | FIX | Report tables contained (already); donut/legend stack; `grid-cols-7` breakdown → wrap; department/section selects full-basis |
| `/faculty/audit-logs` | FIX | RW-2 stacked cards on `< sm`; filter row wrap |
| `/faculty/server-status` | FIX | `grid-cols-3` gauge cards → `1 base, sm:2, lg:3`; sparkline widths fluid; subscribe state bar wraps |
| `/faculty/settings` | FIX | 4-tab bar → scrollable pills; field rows `2→1`; AI status card stacks |
| `/faculty/search` | FIX | Result cards `3→1`; search bar full width |

## 7. Committee of risks

- **E2E selector drift:** all Playwright journeys target roles/labels/buttons, never grid
  geometry — but every RW-3 row change must re-run `e2e` Chromium before commit.
- **Component library inputs:** shadcn `Input` is shared; the 16px touch rule must live in a
  variant, not by mutating the global component (desktop text-sm stays).
- **Safe-area on non-standalone browsers:** `env()` fallbacks keep current behavior when
  unsupported (padding 0).
- **Harness flake:** ready-selectors must be explicit per route; any route that intermittently
  exceeds is not exempted silently — it's a real finding logged in the addendum.

## 8. Open questions (answer before execution)

1. Approve the `< md` stacked-card approach for Users + Audit Log (vs. keeping
   scroll-contained tables everywhere)? Default: stacked cards — these are the admin's
   highest-frequency mobile surfaces.
2. Do we ship RW-4's month-grid dot collapse, or switch month view to a plain agenda list on
   phones? Default: dot collapse (less code, keeps calendar muscle memory).
3. Any device matrix requirement beyond 375/390/768 (e.g. 412×915 Android)? Default: add it,
   it's one array entry.

## 9. Addendum (post-implementation)

Executed after the campus-designations wave, so the inventory includes the new designation
surfaces (`/profile`, `/faculty/at-risk`, `/faculty/system-reports`,
`/faculty/settings?tab=system`, registrar `/faculty/users`).

### Workstream results

- **RW-0 harness:** `e2e/responsive.spec.ts` now runs **7 role groups × 4 viewports = 28 tests**
  (anonymous, faculty, super admin, student, department head, IT coordinator, registrar),
  every rendered route enumerated in `e2e/responsive-routes.ts` (37 routes; `/student` redirect
  excluded). No exemptions. `e2e/visual-capture.spec.ts` captures all mobile routes at 375×812
  into `e2e/captures/mobile/` (gitignored evidence).
- **RW-1 foundations:** `viewportFit: 'cover'`; a `<640px` 16px form-control rule (kills iOS
  auto-zoom); shared `Input` is now `text-base sm:text-sm`; `FilterBar` children go full-row
  on phones; sidebar mobile chrome gets safe-area top/bottom padding and ≥44px menu/close/bell
  targets. Desktop unchanged.
- **RW-2 heavy tables:** Users and Audit Log render the desktop table only at `md+`
  (`hidden md:block`; their 860/900px min-widths are no longer reachable on phones) and a
  stacked card layout below `md`. Users actions are shared through one `UserRowActions`
  component; the breakpoint is also gated with `useSyncExternalStore(matchMedia)` so only one
  layout exists in the DOM (prevents duplicate text-based E2E matches). Registrar restrictions,
  pagination, filters, and status/role actions are preserved.
- **RW-3 density pass:** stat grids collapse 5→2→1 / 4→2→1 / 3→1 below md (with `md:`
  restoring the previous desktop breakpoints); filter rows wrap with full-width fields on
  phones; dialogs cap at ≤92vw; rosters/tables stay in contained scroll regions; cockpit QR/PIN
  dialogs fit; touch targets ≥44px for primary icon controls. Admin reports kept the previous
  tablet/desktop 3-up breakdown and only expands to 7-up at `lg` (a literal `md:7` would have
  changed 768–1023px).
- **RW-4 schedules:** month cells collapse to day number + three event dots below md; tapping a
  day opens a phone-only day-detail panel built from the existing `EventPopoverContent` data;
  week timetables keep `min-w-[700px]` inside a snap/overscroll-contained region with a
  phone-only fade + hint, and auto-scroll today's column into view on mount (phone widths
  only). `StudentWeeklySchedule` now uses the same contained 7-column week on phones instead
  of stacked day cards.
- **RW-5 regression:** the harness is part of the default Chromium Playwright project; the
  mobile capture loop is evidence-only.

### Verification

- Responsive gate: **28/28 passed** at 375×812, 390×844, 412×915, and 768×1024 for all seven
  role groups; zero page-level overflow, zero exemptions.
- Full Chromium suite: **122 passed / 3 skipped / 0 failed** (includes 28 responsive + 11
  visual-capture tests). Firefox/WebKit were not rerun this wave.
- Web unit suite: **304 passed / 48 files**; `eslint`, `tsc --noEmit`, and `next build` clean.
- Impeccable detector: 18 advisory "side-tab" warnings, all pre-existing `border-l-4` house
  style (sidebar active state, existing student cards); no errors and no new antipatterns were
  introduced by the responsive variants.

### Deviations / notes

1. **Breakpoint fidelity:** several "literal" matrix instructions (e.g. `md:grid-cols-7`) would
   have changed 768–1023px rendering. Where the original used `lg`, the responsive pass keeps
   `lg` and only adds below-md steps, honoring the pixel-identical desktop promise.
2. **`StudentWeeklySchedule` phone strategy:** the plan expected stacked day cards there; the
   implementation instead uses the same contained, auto-scrolled 7-column week for consistency
   with the faculty/student schedule pages.
3. **Users page DOM gating:** a `matchMedia` gate is used in addition to `md:` classes because
   rendering both layouts would duplicate names/buttons in text-based E2E locators. The desktop
   path is unchanged; SSR renders the desktop table and switches after hydration on phones.
4. **Map heights:** the shared `MapPicker` has no height props; a wrapper supplies bounded phone
   heights and restores the existing desktop height at `md`. If MapPicker gains a height/wrap
   API later, replace the wrapper.
5. **Cockpit roster:** the roster is a wrapped list, not a table; it is contained rather than
   given a sticky first column (no horizontal scroll exists to stick against).

