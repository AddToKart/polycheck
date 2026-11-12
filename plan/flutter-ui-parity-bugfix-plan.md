# Flutter Bug Sweep — UI Parity, Sign-out Crash, Faculty Nav (FIX1–FIX7)

> **Status:** Proposed — not started. Evidence base:
> `documentation/flutter-parity-gap-report.md` + the bug-evidence audit
> (user device reports on the emulator, 2026-11-10, screenshots provided).
> All findings are Dart-side in `polycheck_mobile/` — zero backend/shared/web changes required.
>
> **Scope:** fix the reported device bugs and close the remaining web/RN UX parity gaps
> called out by the owner: student "My Subjects", profile chrome cleanliness, back
> affordances, sign-out crash + its server-revocation consequence, staff-enforcement
> scope guarantee, faculty bottom navigation.

---

## 1. Verified bug inventory (root causes, cited)

| # | Bug (owner report) | Root cause (audited) |
|---|---|---|
| FIX1 | Student dashboard has **no "My Subjects"** / enrolled-subjects view (topics: officers see where their granted session-creation permission windows live) | Dashboard renders today-only (`features/student/data/student_dashboard_data.dart:7-73`); no enrolled-section list; RN parity source: `android/app/(tabs)/dashboard.tsx:283-315` + `subject-info/[id].tsx` (officer permission card + create-CTA already exist in Flutter section detail `student_section_detail_screen.dart:117-191` — nothing is missing server-side) |
| FIX2 | Profile floating maroon pills (Assistant / Notifications / Privacy) duplicate the tab chip row | `profile_screen.dart:396-429` — pills rendered `!compact`; tabs at `:430-463`; Notifications+Privacy are exact duplicates; Assistant is not a tab |
| FIX3 | Profile tab pages (Privacy/Notifications/Reports/Contacts/Device/Password) have **no back to dashboard** | Tab switching calls `SurfaceNavigation.open` → `surface_navigation.dart:44` runs **`router.go`** which replaces the pushed `/profile` match — stack depth 1 → `canPop == false` → leading arrow gone. Deep links land stackless by design |
| FIX4 | **Sign-out crashes** and the server session survives (after wiping phone data, new logins hit `active_session_elsewhere`) | `confirm_sign_out.dart:33,37` pops with the **caller's** context while the dialog rides the **root navigator** (`campus_dialog.dart:77-86`); the student shell is a nested navigator, so `.pop(true)` pops the **dashboard page** — go_router empties the match list (`match.dart:741-771`, `delegate.dart:173-178` debug assert + blank screen), the dialog future resolves `false`, **`logout()` never runs** → token/drift rows/session all survive. The existing test passed because its harness is a flat router (`test/features/student/confirm_sign_out_test.dart:39-70`). Same-class bugs: `faculty_shell.dart:470-499`, `force_password_change_screen.dart:210-226`, profile tile via the same helper. Confirmed NOT the cause: uncaught API throw (`session_provider.dart:261-267` wraps), drift-watch races (all readers guard), notifyListeners-during-build, redirect loops |
| FIX5 | Consequence handling: after app wipe, the student is locked out by the gate with no self-serve path | Not a defect of enforcement — policy is correct (backend-gated). Improvement: gate explainer copy must tell a wiped-device student exactly how the seat frees (instructor Emergency Device Release / instructor reset) |
| FIX6 | Guarantee enforcement stays **student-only** (owner: "no timer no single session shits" for professors) | Already true end-to-end (`session_provider.dart:232-237` sends deviceId harmlessly; gate UI only in `student_login_screen.dart:174-180`; backend emits `auth:session-replaced` only on security revocations — staff never get cooldown/active-session). Need only a **regression test** + device check |
| FIX7 | Faculty dashboard has **no bottom navigation** | `FacultyScaffold` (`faculty_shell.dart:14-80`) is chrome-only; RN parity tabs = Dashboard/Subjects/Sessions/Disputes + More sheet (`android/app/(faculty)/_layout.tsx:238-256`, `android/lib/more-items.ts:66-95`, web sidebar groups) — Flutter `/faculty/*` routes already exist flat (`faculty_routes.dart:25-108`) |

## 2. Locked decisions

| # | Decision |
|---|---|
| 1 | **Logout always completes locally** (status quo in provider) and now actually RUNS: dialogs pop with their **own** context (the in-repo pattern `privacy_consent_gate.dart:236-249`); `showCampusDialog` gains a contract note; all three caller sites (confirm_sign_out, faculty confirm, forced-rotation escape, profile tile via helper) share one corrected flow. |
| 2 | **Back affordance rule:** tab content inside `/profile` switches with **pure local state** (`setState`, no `SurfaceNavigation.open` URL sync — the stack-killer). Explicit header back for stackless deep-linked landings: if `canPop == false`, show `BackButton → role home/portal` (admin pattern) on profile screens. Other pushed screens already imply leading (audit found only auth/error screens suppress it — untouched). |
| 3 | **Profile chrome:** remove Notifications+Privacy pills (duplicate chips); keep Assistant as a single distinct affordance (moved into the AppBar actions next to the bell). |
| 4 | **My Subjects (student):** dashboard gains a "My classes" block (up to 4 cards + "View all"), card = subject name + `formatSectionHeading` + teacher + per-section attendance-rate bar + officer chip (from the existing roles snapshot) → push `/student/subjects/:id`; NEW route `/student/subjects` list view (same cards); the section-detail screen keeps officer permission windows + Create-session CTA (current server parity). If the owner later wants permission windows surfaced per-card on the dashboard, surface `GET /session-permissions/:sectionId` state as a chip — flagged as optional follow-up, not required for parity. |
| 5 | **Faculty navigation:** `ShellRoute` wrap (StudentShell pattern) with a **4-tab bottom nav: Dashboard · Subjects · Sessions · Disputes** (active tab highlight, zero-radius, maroon active/gold indicator) + **More sheet** = Schedule · Attendance · Excuses · Reports · At-Risk · Report-an-issue (`/profile?tab=reports`) · Profile & security (`/profile`) · Assistant (`/assistant`) + designation-gated items (IT: server-status/system-reports/settings; registrar: users) mirroring `android/lib/more-items.ts`. Faculty confirm dialogs get the same dialog-context fix. |
| 6 | **Gate explainer copy (FIX5):** on `active_session_elsewhere`, append a lost-device line — "Lost or wiped that phone? Ask any instructor to run an Emergency Device Release from your class page." (matches backend reality; no self-serve bypass is added, by design). |
| 7 | **No backend/shared changes.** All fixes live in `polycheck_mobile/`; no new dependencies; no native changes; hot-restart verifiable. |

## 3. Milestones

| ID | Scope | Acceptance criteria |
|---|---|---|
| **FX1 — dialog/navigation core** | `showCampusDialog`/`ConfirmSignOut` pop w/ dialog context; faculty confirm + forced-rotation dialogs use the fixed pattern; profile tab switch becomes local-state + stackless fallback back; gate copies gain the lost-device line; profile pills removal + AppBar assistant action | Repro harness (nested-shell router test mirroring `app_router.dart`) proves: confirm → `logout()` invoked → portal lands → token cleared (provider state null + drift meta cleared). No go_router asserts. Same test extended to `/profile` tile. Profile: no `router.go` from pushed tab; every profile route shows a back affordance (arrow or explicit BackButton when canPop==false) |
| **FX2 — student My Subjects** | Dashboard "My classes" block + `/student/subjects` list route + card widget | Cards render from `studentSections/Subjects/attendance` providers with per-section rate bar + officer chip; tap → subject detail; list route from "View all N classes"; snapshot data never blocks (empty-state when none) |
| **FX3 — faculty shell nav** | ShellRoute wrap + bottom nav (4 tabs) + More sheet (designation-gated); confirm-dialog fix rides FX1 | Every `/faculty/*` route shows the bottom bar with correct active tab; More sheet navigates each listed route; IT/registrar items hidden unless designation passes (reuse `router_decision` helpers); no route dead-ends |
| **FX4 — enforcement scope regression** | Tests only: staff login never renders gate panels; staff `deviceId` still sent (harmless); monitor reacts only to revocation events | Widget test on faculty login (no gate panels); decision-function test: `ACTIVE_SESSION_ELSEWHERE`/cooldown UFCO copy unreachable for `FACULTY` role paths |
| **FX5 — VER** | Full gates + device smoke script for the owner | `flutter analyze` 0; full suite green (new tests ~15–25); debug APK builds; emulator smoke checklist: sign-out on dashboard+profile ends server session (`/auth/logout` fired, audit row), re-login from web+emulator concurrently as faculty OK, student gate shows lost-device copy, all profile tabs back-navigable, faculty nav reaches every route |

## 4. Two-agent file-ownership split (parallel-safe)

| Agent | Owns |
|---|---|
| **Agent A — "Chrome & auth dialogs"** (FX1, FX4, gate copy) | `core/widgets/confirm_sign_out.dart`, `core/widgets/campus_dialog.dart`, `features/faculty/**/faculty_shell.dart` (confirm + NEW shell/nav in-place), `features/auth/presentation/force_password_change_screen.dart`, `features/auth/presentation/**/student_login_screen.dart` (copy only), `features/surface/presentation/profile_screen.dart` (tabs local-state + pills removal + back fallback), `features/surface/data/surface_navigation.dart` (no-go-from-profile guard), tests: `confirm_sign_out_test.dart` (nested harness), `admin_back_fallback_test`, new profile-nav/faculty-nav tests |
| **Agent B — "Student classes"** (FIX1 student data UI) | `features/student/presentation/dashboard/**`, `features/student/data/student_dashboard_data.dart` + new `student_classes_data.dart`, `features/student/student_paths.dart` (add `/student/subjects` only if list route), `core/router/routes/student_routes.dart` (ONLY if adding that route; coordinate — Agent A does not touch student_routes), tests under `test/features/student/**` |
| Sequencing | A and B run concurrently under the boundary above. If Agent B needs `student_routes.dart`, Agent A pre-commits to not touching it (FX1 has no student-route need). Faculty routes file touched only by A. Integration QA (Q1 wave) is the only post-pass owner of everything (compile fixes + gates). |

## 5. Testing strategy

| Layer | Tests |
|---|---|
| Router/widget (new harness) | Nested-shell confirm flow (dashboard + profile), tab-local-state (no URL go), stackless-landing fallback back, faculty nav active-tab matrix + More-sheet routing incl. designation gating, staff-no-gate-panel |
| Unit | `prepareOffline…` untouched; officer permission card unaffected; new my-classes card builder (rate bar math, officer chip merge from roles snapshot, empty states) |
| Regression guard | The flat ConfirmSignOut test is replaced by a nested-shell one (the real bug pattern at the call site — auditing the seam was the whole point) |
| Device smoke (owner/QAI) | `flutter run` on emulator: (1) sign-out from dashboard → no blank screen → lands portal → backend session gone (`/auth/logout` in logs; re-login from fresh context works); (2) same from profile; (3) faculty confirm (end-session override) reproduces fixed dialog; (4) profile back from all 6 tabs; (5) faculty bottom nav reaches every `/faculty/*` + More sheet items; (6) student "My classes" → subject → officer permission card → create session (president on permission); (7) student gate on second-device login shows both existing copy + new lost-device line; faculty login unaffected on both devices |

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Dialog-context fix changes other confirm dialogs' behavior silently | Shared helper only — audit all `showCampusDialog` callers in the fix wave and pop w/ dialog context everywhere; run the whole suite, incl. end-session confirm ID test |
| Tab-local state regresses URL-sync parity for `/profile?tab=…` deep links from notifications | Keep URL for *landing* consistent: deep links still work (`?tab=` parsed on mount); only in-screen switching stops forcing URL transitions. Notification targets keep working via surface_navigation (go) for cold nav |
| ShellRoute wrap around `/faculty/*` could change header behaviors (sticky CampusesHeader) | Reuse the StudentShell pattern; Niagara — verify every faculty screen renders with the shell; keep admin-style fallback leading overrides intact |
| Nesting shells breaks `Navigator.of(context)` pockets not yet audited | Sweep with rg for `Navigator.of(`, `.pop(` patterns; convert any remaining caller-context dialog pops |
| Student dashboard test churn | Update the affected dashboard test only; all other tests untouched |

## 7. Out of scope (recorded)

- Web parity still missing: faculty `?sectionId=` context banner deep-link already handled in routes; faculty search route (Flutter ↑ admin-only) stays as recorded deviation.
- Server changes: none (all bugs Dart-side). `student_paths` extension is the only contract-adjacent seam.
- Offline PIN/queue rework, push registration: already fixed/deferred in the hardening wave.

## 8. Open questions (defaults if silent)

1. Faculty bottom-nav set: Dashboard · Subjects · Sessions · Disputes — acceptable? (Default: yes; Report/Stats/Calendar live in More.)
2. My Subjects default: 4 cards + "View all" (like RN) vs all cards inline — default: 4 + View all + dedicated list route.
3. Officer permission-window chips on dashboard cards (beyond RN): **not in scope** unless requested again — the section detail already holds them.

Say **go** and Agents A/B standard swift parallel run, then FX5 QA sweep, all gates enforced.

## 9. Implementation Addendum (delivered)

| Fix | Delivered |
|---|---|
| FIX4 sign-out crash | `showCampusDialog` now supports `actionBuilders` receiving the **dialog's** context; `confirmSignOut`, faculty confirm, forced-rotation, and the remaining surface/admin dialogs pop with the dialog context. Root cause (caller-context pop on nested shell nav → go_router empty match → dialog disposed → logout never ran) eliminated; nested-shell harness replaces the flat test that hid it. |
| FIX5 gate copy | Active-session panel appends the lost/wiped-device line (instructor Emergency Device Release). |
| FIX2 profile pills | Duplicate Assistant/Notifications/Privacy pill row removed; Assistant moved to the AppBar actions (policy-gated). |
| FIX3 profile back | Tab switching is pure local state (no `router.go`); stackless landings get a fallback BackButton → role dashboard/console; `SurfaceNavigation` no-ops when already on the target. All profile tabs are back-navigable. |
| FIX1/FIX2 my classes | Dashboard "My classes" block (max 4 + "View all N classes") + `/student/subjects` list route; cards show subject, `formatSectionHeading` + teacher, per-section rate bar, officer chips from the cached roles snapshot; empty state wires the enrollment dialog. Officer permission windows remain on the section detail (server parity). |
| FIX6 staff enforcement | Regression tests prove gate panels never render for faculty and gate widgets mount only on the student login; monitor remains revocation-event-driven. No policy changes. |
| FIX7 faculty nav | All `/faculty/*` routes ride one ShellRoute with a detached zero-radius bottom bar (Dashboard · Subjects · Sessions · Disputes, parent-tab resolution) + More sheet (Schedule, Attendance, Excuses, Reports, At-Risk, Report an issue, Profile & security, Assistant, IT/registrar-gated consoles, Sign out). |
| FX5 integration | Date-bound month test made deterministic via injectable clock (off-schedule make-up sessions now plot instead of crashing); remaining caller-context pops converted (profile unregister, assistant delete, admin user sheet), sweep shows none left. |

**Verification:** `flutter analyze` 0 issues · **620/620 tests** (any day of the week) · debug APK builds · `android/` byte-identical. Device smoke checklist (sign-out both surfaces, profile back, faculty nav/More, My classes officer card, second-device gate copy) remains for the emulator.
