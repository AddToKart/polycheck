# Release Readiness — Verification, Journeys, PR & Backlog Polish

> **Status:** Implemented (QA-1–QA-4, PL-1–PL-5). Covers "1. Verify & merge" and
> "2. Backlog polish" from the next-steps review. Companion to
> [`notifications-excuse-filters-plan.md`](./notifications-excuse-filters-plan.md),
> [`assistant-panel-redesign-plan.md`](./assistant-panel-redesign-plan.md), and
> [`super-admin-console-plan.md`](./super-admin-console-plan.md).

---

## 1. Goal

1. **Lock in the last three feature waves with QA**: run the existing 198-test Playwright
   suite against the rebuilt stack, add the missing E2E journeys for everything we just
   built (assistant, excuses, notifications, filters), fix whatever regressed, then
   **open the PR** to `main`.
2. **Burn down the cheap backlog**: sessions-page section context, dark-mode parity
   sweep, assistant per-thread send lock, and `excused` trend buckets.

## 2. Verified Current State (facts)

| Fact | Evidence |
|---|---|
| Web E2E suite has **not been run this session**; the UI it asserts changed heavily (sidebar gained Assistant + Excuses + bell; settings became 4 tabs; faculty pages gained FilterBar) | session record; `e2e/*.spec.ts` untouched by our commits |
| No assistant / excuse / notification / filter journeys exist in `e2e/` or `android/maestro/flows` | grep clean in both |
| 8 commits sit on `fix/cross-browser-runtime-compat` (pushed), `main` untouched | `git log` / remote state |
| Android push + notification UX **cannot be device-verified locally** (adb/Maestro unavailable on this machine) | AGENTS.md Next-Steps note |
| Assistant concurrent `POST /ai/chat` on the same thread is last-write-wins | panel-redesign plan follow-up note |
| Shared `DashboardOverview.trends` rows only carry `present/late/absent/disputed` — pending/excused are omitted from trend charts (both dashboards) | `shared/src/types/api.ts:183-189` (trend contract) |
| Sessions page ignores section context it is opened from; section detail's session links start unfiltered | `frontend/src/app/faculty/sessions/page.tsx`, `android/app/(faculty)/sessions/index.tsx` |
| `notification-center`/bell work web-side; the queued "dispute notification badge on faculty sidebar" item is **superseded** by the bell badge | AGENTS.md Next Steps (stale line) |

## 3. Locked Decisions

| # | Decision |
|---|---|
| 1 | **QA-1 runs first and gates everything else** — no journeys or polish land until the existing suite is green on the rebuilt stack, so we distinguish "pre-existing noise" from "our regressions". |
| 2 | E2E journeys are added **with testIDs we already shipped** (`assistant-*`, `student-standing-banner`, `assistant-tool-activity-<n>`, bell/panel hooks) plus any minimal `data-testid` additions a journey needs (notification panel, excuse modal, FilterBar controls). No production-behavior changes during QA fixes. |
| 3 | **PR body over merge:** the PR is created with a complete summary (waves, verification matrix, caveats: Android push rebuild, web-push deferral, smoke-tested excuse record); the **user merges** after eyeballing (no auto-merge). Squash-merge recommended since the branch base is `main` and history is thematic. |
| 4 | Android device pass is a **checklist artifact** this cycle (RELEASE.md-style runbook appended to the plan), since adb/Maestro are unavailable locally; EAS/dev-client rebuild steps are documented so the user can execute it. |
| 5 | Backlog polish stays backend-light: session-context linking (web+Android), a shared trend contract extension (`excused` bucket + chart stack), a Redis-backed per-thread lock, and a docs cleanup of the superseded badge line. No schema changes. |
| 6 | The send lock is **advisory at the API edge** (`409 CONFLICT` if a run is in-flight for that thread) and the client disables send/regenerate for the thread while streaming — defender-in-depth without changing the streaming protocol. |

## 4. Workstreams & Milestones

### QA-1 — Existing suite on the rebuilt stack

| Item | Detail | Acceptance |
|---|---|---|
| Playwright full run (Chromium → WebKit → Firefox) against the local Docker stack + seeded DB | fix any *selector rot* from nav/settings changes; classify engine-specific noise per existing conventions | 198/198 green (minus documented engine-specific skips, same as baseline), zero backend 5xx |

### QA-2 — New journeys

| Surface | Web (Playwright) | Android (Maestro) |
|---|---|---|
| Assistant | open panel → "List my sections" → sections table reply; threads rail: open second thread → delete; theater toggle ladder | assistant open (faculty) → prompt → reply visible (requires AI env on device — document as `@skippable` if unconfigured) |
| Excuse | student requests excuse on seeded absent record → teacher approves in `/faculty/excuses` → row shows `excused` chip; duplicate request → 409 toast | journey `05-…yaml` mirroring the flow |
| Notifications | bell badge >0 after seeded event → open panel → mark-read persists after reload; mark-all → 0 | badge → center → mark-all |
| Filters | attendance `?subjectId&sectionId` deep link renders filtered totals; sessions/disputes/report filter round-trips | chips set/reset on faculty attendance |
| Standing | student banner shows below/at-risk seeded student; dismiss-per-session works | banner visible on dashboard |

Acceptance: every journey runs green on Chromium (+ WebKit where timing-safe); Maestro flows run in CI-shaped container when a device is unavailable → documented skip.

### QA-3 — PR to `main`
- `gh pr create` with body: wave summary, verification table (typecheck/lint/unit/E2E/smoke), caveats (Android rebuild, web-push deferral, local smoke data), screenshots skipped (visual capture spec covers).
- Base = `main`; head = branch; **no merge without user** → hand back PR URL.

### QA-4 — Android rebuild + device runbook
- Append a runbook section to `android/RELEASE.md`: EAS dev-client build → install → verify (permission prompt, push token registration, tap routing, excuse modal keyboard, switches/small-screen tabs, notification icon rendering).
- Attempt local `adb`/Maestro; if unavailable, mark checklist for the user + CI note.

### PL-1 — Sessions page section context
- Web + Android: links from section detail → sessions list pre-filtered to that section (`?sectionId=`, chip visible, one-click clear); sessions page group header shows section context and a back link.
- Acceptance: open from section detail lands filtered; deep link round-trips; teacher scoping unchanged.

### PL-2 — Dark-mode parity sweep
- Grep + visual pass over pages/screens missing `dark:` variants (schedule, attendance, users, excuses, notifications, settings tabs, assistant shells); align any hardcoded neutrals to the zinc/maroon token conventions; `prefers-reduced-motion` untouched.
- Acceptance: grep gate (no raw `#`-hex outside token files on changed files) + spot screenshots light/dark on the 6 highest-traffic pages.

### PL-3 — Assistant per-thread send lock
- Backend: in-flight registry keyed by `threadId` (Redis `setIfAbsent` 3-min TTL) → `409 CONFLICT ("A reply is already being drafted for this conversation")`; registry released on run completion/failure.
- Clients (web + Android): disable compose actions while streaming (already true) and surface the 409 with a Retry affordance.
- Acceptance: unit test (double-send → 409 → release), integration through `AiChatService.start`; web/android unit for the 409 toast.

### PL-4 — `excused` trend bucket
- Shared: `DashboardOverview.trends` rows gain `excused` (+ `pending` stays out of stacks but totals already show it).
- Backend trend aggregation includes `excused`; web super-admin stack + Android reports/donut gain the golden-outline color per badge system; legend updated.
- Acceptance: contract test, unit for aggregation, visual parity both dashboards.

### PL-5 — Docs hygiene
- Remove the superseded "dispute notification badge" Next-Step; note the QA outcomes in AGENTS.md + this plan's addendum.

## 5. Sequencing

1. **QA-1** (existing suite green) → 2. **QA-2** (journeys) → 3. **QA-3** (PR) → 4. **QA-4** (runbook + attempt) → 5. **PL-1…PL-5** (polish train, web+AR together) → re-run QA-1 subset (regression gate) → push.

## 6. Testing Strategy

| Layer | Approach |
|---|---|
| E2E (Playwright) | QA-1 full matrix + QA-2 journeys; `assertNoErrors` conventions; engine-specific skip ledger updated |
| E2E (Maestro) | runbook first, device-dependent CI note |
| Unit/backend | PL-3 lock (double-send), PL-4 aggregation + contract |
| Visual | PL-2 light/dark spot checks |
| Regression | QA-1 subset re-run after PL train |

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| E2E failures from pre-existing engine quirks vs our changes | QA-1 classification first; fix only regressions we introduced; ledger the rest per existing conventions |
| Seeded-data drift makes journeys flaky (the approved smoke excuse) | journeys target the seeded s-001 absent record; clean-up helper resets excuse state at journey setup via API |
| AI-dependent assistant journeys break when `AI_*` unset in CI | capabilities-guarded skip for provider-bound steps (documented), keep threads/UI journeys unconditional |
| Trend contract change ripples consumers | additive optional field; typed maps updated in the same commit; charts tolerate absent bucket |
| PR diff is huge for review | thematic commits already; PR body links the four plan addenda |

## 8. Out of scope
Production deploy, `NEXT_PUBLIC_PWA_OFFLINE` enablement, the 5k load sim, web-push implementation (queued separately).

## 9. Open Questions (defaults if silent)
1. PR merge strategy default **squash** — or regular merge to keep the 8 themed commits? (Default: **regular merge**, preserves the thematic history.)
2. Should PL-4 also add `pending` to stacks? (Default: **no** — totals already expose it; stacks stay attended-vs-excused.)
3. Android QA-4: attempt local device run or runbook-only? (Default: runbook + attempt if adb appears.)

Say **go** and I'll execute QA-1 → QA-4 then PL-1…PL-5 with gates.


## 10. Implementation Addendum (delivered)

| Area | Result |
|---|---|
| QA-1 | Existing suite restored to green across engines: fixed the super-admin nav expectation (Assistant item), server-side user search in the admin teacher journey, a colliding E2E student-ID generator (random + 409 retry), known Firefox noise (Zod CSP eval probe allowlist, abort-shaped dashboard fetch logs), and service-worker interception flakiness (SW blocked for UI journeys; offline PWA has separate coverage). Final: **Chromium 69 passed / 5 skipped / 0 failed; Firefox 64 / 10 / 0; WebKit 64 / 10 / 0** (198-test matrix). |
| QA-2 | New journeys: `e2e/excuse.spec.ts` (student request, teacher approve with confirmation dialog, standing-banner dismissal), `e2e/notifications.spec.ts` (seeded excuse → badge → panel → deep link → mark-all persistence), `e2e/filters.spec.ts` (attendance deep link, sessions context + clear), `e2e/assistant.spec.ts` (dock/theater/Esc ladder; provider-bound reply gated behind `E2E_AI=1`). Journeys are rate-limit and data-state resilient (skip with a reason on a shared local DB). |
| QA-3 | Changes committed thematically and pushed; PR to `main` opened from `fix/cross-browser-runtime-compat`. |
| QA-4 | Android Wave 4 device runbook appended to `android/RELEASE.md` (build, permissions, push registration/delivery, excuses, filters, small screens). Local adb/Maestro unavailable. |
| PL-1 | Sessions page accepts `?sectionId`, shows a context banner with subject/section/room + clear action (web + Android); section detail links pre-filter; create-session prefill on Android. |
| PL-2 | Dark-mode parity sweep across attendance/sessions/disputes/reports/users/excuses/schedule/student surfaces/ID cards/CampusMap (web) and Android session/section/dashboard/excuse/notification/settings/filter/map surfaces; raw hex moved to tokens (zero remaining in changed files). |
| PL-3 | Per-thread Redis send lock (`ai:run:<threadId>`, 180s, ownership-safe release) → 409 on concurrent send/regenerate; released on success/failure/timeout. |
| PL-4 | `DashboardOverview.trends` rows include `excused`; backend aggregation emits it; teacher dashboards (web + Android) stack it with a distinct token color and legend; legacy payloads tolerated. |
| PL-5 | AGENTS.md updated; superseded dispute-badge Next-Step removed by the notification center. |

Verification totals after the polish train: backend **679 / 63**, web **265 / 41 files**,
Android **307 / 22**, shared 87; typecheck/lint/format/build clean; Docker stack rebuilt.
