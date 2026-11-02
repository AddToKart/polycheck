# Institution Settings — Categorized Redesign & AI Availability Controls

> **Status:** Implemented (IS1–IS5). Companion to
> [`ai-assistant-plan.md`](./ai-assistant-plan.md) and
> [`super-admin-console-plan.md`](./super-admin-console-plan.md) (settings currently live
> in the SA console as Institution Settings).

---

## 1. Goal

1. Turn the current one-page, one-card settings dump into a **categorized settings
   experience** (web + Android) that matches the admin-console design language.
2. Ship the **AI Assistant availability controls**: disable the assistant for students,
   for staff, or entirely — when off, the assistant entry point (bubble / tab / More-sheet
   item) disappears for the affected roles, and the backend rejects chat requests
   server-side.
3. Fold in the settings-research findings (below), including one real setting
   (`allow_teacher_student_provisioning`) that exists in the backend but is **hidden from
   both settings UIs today**.

## 2. Verified Current State (facts from the research pass)

| Fact | Evidence |
|---|---|
| Settings storage is a flat key/value table | `backend/prisma/migrations/20260713234500_institution_settings/migration.sql` (`InstitutionSetting`), service whitelist in `backend/src/settings/settings.service.ts` |
| The web settings page renders **10 fields + the API-key block in one card**, no categories, single Save bar | `frontend/src/app/faculty/settings/page.tsx:14-23,83-109` |
| Android renders the **same flat list** in one scroll (no tabs/sections) | `android/app/(faculty)/settings.tsx` `fields` array |
| **`allow_teacher_student_provisioning` exists in the backend but is in NO settings UI** — it silently gates the enrollment-import auto-provisioning feature | `settings.service.ts:14`; consumer `backend/src/sections/enrollment-import.service.ts:85` |
| Setting → consumer map (all live today): `institution_name` → master-list PDF header (`docs.service.ts`); `default_geofence_radius_meters` / `default_qr_validity_minutes` / `default_grace_period_minutes` → session-create prefill on **both platforms** (`faculty/sessions/create` web `:83-85`, android `create.tsx:70-72`); `enrollment_code_expiry_days` → **declared + validated but never consumed** — code expiry is hardcoded `14 days` at `sections.service.ts:108` and `:313`; `attendance_min_rate_percent` → standing evaluator (`standing.service.ts:7`); `ai_base_url`/`ai_model`/`ai_api_key` → provider config (`ai-provider.service.ts`) | per-file cites |
| `GET /ai/capabilities` already serves role/status to the surface; chat start already re-checks capabilities server-side | `ai-provider.service.ts:91-111`, `ai-chat.service.ts:76-79` |
| Assistant entry points today: web bubble (role-gated by auth only, not config), Android student tab + faculty/super More-sheet item; "Assistant unavailable / not configured" panel appears when disabled/unconfigured | `AssistantLauncher.tsx`, `AssistantChat.tsx` disabled states, `(tabs)/_layout.tsx`, `(faculty)/_layout.tsx` MoreSheet |
| Boolean settings already exist as a first-class pattern (`getBoolean` + `'true'/'false'` rows, default fallback) | `settings.service.ts:37-43` |
| Department-scoped admins view settings read-only (institution scope required to save) | `settings.controller.ts`, settings pages |

## 3. Category Structure (locked)

Four tabs on web (`/faculty/settings?tab=…` deep-linkable; active tab remembered in the
URL, not localStorage since it's a page). Android mirrors them as a segmented top tab row
like the Users screen. Single "Save changes" per tab (scoped saves prevent one bad field
from blocking unrelated sections) + an unsaved-changes dot on tab labels. Square bordered
cards, existing tokens, no new dependencies.

| Tab | Contents (existing → action) |
|---|---|
| **1. Institution** | `institution_name` (moves here). Clean card with the page intro text. |
| **2. Sessions & attendance** | `default_geofence_radius_meters`, `default_qr_validity_minutes`, `default_grace_period_minutes`, `enrollment_code_expiry_days`, `attendance_min_rate_percent` — grouped with short helper captions explaining exactly where each default applies. |
| **3. Accounts & access** | `allow_teacher_student_provisioning` (newly surfaced) as a switch with an honest explanation: "Let teachers auto-provision inactive student accounts when importing a master-list enrollment for a student without an account (bulk import, v2 opt-in)." |
| **4. AI Assistant** | Availability switches (new, §5) on top, then **Configuration**: `ai_base_url` (+ OpenCode hint), `ai_model`, and the encrypted **API key** block (status line + Save key / Clear exactly as today). A status strip summarizes: master state → role availability → configured/missing → ready. |

## 4. Research — what belongs in Institution Settings

**Inventory after this plan** (every key visible in exactly one category):

| Key | Category | Consumer (verified) |
|---|---|---|
| `institution_name` | Institution | master-list PDF header |
| `default_geofence_radius_meters` | Sessions & attendance | session-create prefill (web+android) |
| `default_qr_validity_minutes` | Sessions & attendance | session-create prefill; backend create defaults |
| `default_grace_period_minutes` | Sessions & attendance | session-create prefill; backend create defaults |
| `enrollment_code_expiry_days` | Sessions & attendance | **wired up in IS2** (see decision 6) |
| `attendance_min_rate_percent` | Sessions & attendance | standing evaluator + banner + assistant |
| `allow_teacher_student_provisioning` | Accounts & access | enrollment import auto-provisioning |
| `ai_assistant_enabled` *(new)* | AI Assistant | master switch |
| `ai_assistant_teacher_enabled` *(new)* | AI Assistant | staff/teacher surface |
| `ai_assistant_student_enabled` *(new)* | AI Assistant | student surface |
| `ai_base_url` / `ai_model` | AI Assistant | provider adapter |
| `ai_api_key` (secret, sealed) | AI Assistant | provider adapter |

**Optional candidates evaluated and rejected for v1** (documented for the future, not
implemented): timezone/academic-term dates, campus address/logo for PDF exports, password
policy overrides, data-retention UI (currently `AUDIT_LOG_RETENTION_DAYS` /
`DENIED_SCAN_RETENTION_DAYS` env), late-marking minute policy, notification preferences.
Rationale: each needs backend design or product sign-off; they don't block the ask.

## 5. Locked Decisions

| # | Decision |
|---|---|
| 1 | **Four tabs, per-tab save**, `?tab=` deep links; both platforms same categories. |
| 2 | **Three new boolean settings** (defaults `true` — no behavior change until an admin acts): `ai_assistant_enabled` (master — whole system), `ai_assistant_teacher_enabled` (teachers), `ai_assistant_student_enabled` (students). |
| 3 | **Enforcement is backend-first.** `AiCapabilities` gains `policyBlocked?: boolean`. `describe()` computes: master off → `policyBlocked` for every role, reason `"The AI assistant has been disabled by your administrator."`; master on + role toggle off → `policyBlocked` for that role with a role-specific reason. `POST /ai/chat` rejects with **403** (not just hidden UI) when `policyBlocked`, mirroring the existing capabilities re-check. `GET /ai/capabilities` reflects the caller's role. |
| 4 | **Super admin exemption:** the teacher toggle governs teachers only; super admins keep access whenever the **master** is on (they administer the feature). Master off → the assistant is unreachable for everyone, including super admins. |
| 5 | **Surface gating (hidden means hidden):** web bubble and Android assistant tab/More-sheet item must check capabilities on mount — `policyBlocked` → entry point not rendered at all; unconfigured (`missing`) → hidden for teachers/students (they can't fix it), shown for super admins (who get the existing "Open Institution Settings" affordance). Master off → hidden for everyone including super admins (re-enable via Institution Settings). |
| 6 | **Wire the orphaned setting:** `enrollment_code_expiry_days` actually consumed — section creation and `resetEnrollmentCode` read the setting (with a 14-day fallback) instead of the hardcoded `2 weeks`. |
| 7 | Docs endpoints (`/docs/*`) stay **independent of the AI toggles** — they are standalone teacher/admin exports. |
| 8 | Threads endpoints (`/ai/threads*`) remain available (history is harmless); only chat + capabilities carry policy. |
| 9 | Seed/migration: ship default `true` rows for the three new booleans in the next migration (idempotent backfill), so `GET /settings` lists them and the UI renders switches with persisted values; runtime fallback also defaults true. |
| 10 | No new tokens, deps, or hex; switches are built from existing primitives (square track/knob, maroon = on, zinc = off, golden focus ring). Department-admin read-only behavior preserved across all tabs. |

## 6. Milestones

| ID | Scope | Acceptance criteria |
|---|---|---|
| **IS1 — Backend enforcement & keys** | 3 boolean keys (+ validation/ranges), `policyBlocked` in shared `AiCapabilities`, `describe()` policy matrix + role check, `POST /ai/chat` 403s when policy-blocked, `enrollment_code_expiry_days` consumed by sections service, idempotent migration seeding default rows, tests (describe/chat matrix across roles × master/role toggles × configured/unconfigured; code expiry uses setting) | `pnpm -C backend typecheck`; full backend suite green; matrix tests assert every combination; chat blocked with 403 even though the surface never showed |
| **IS2 — Web settings tabs** | Rebuild `faculty/settings/page.tsx` into 4 tabs (deep-linked), per-tab save + unsaved-changes indicator, switches component for the 4 booleans, AI tab layout with availability switches + config + key block + status strip; keep department read-only behavior; update `role-pages`/settings tests | all four tabs render with persisted values; saving one tab does not touch others; toggles round-trip; department admin sees read-only state; web tests green |
| **IS3 — Web assistant gating** | `AssistantLauncher`/`AssistantChat` consume `policyBlocked`/`missing` per Decision 5 (hide bubble per role/state); "not configured" admin affordance unchanged when master on | master off → no bubble for anyone + chat 403; student toggle off → no bubble for students while teachers unaffected; unconfigured → hidden for teacher/student, shown for admin with setup link; unit tests for the visibility matrix |
| **IS4 — Android parity** | Settings screen rebuilt with the same 4 sections (segmented tabs like Users screen), switch rows, per-section save; assistant tab + More-sheet item gated by the same rules; status strip on the AI tab | parity with web categories; student toggle off hides the student Assistant tab; master off hides all assistant entries; typecheck + android tests green |
| **IS5 — Docs & polish** | AGENTS.md critical-context/settings inventory + plan addendum; helper captions reviewed; final typecheck/lint/tests/build; rebuild Docker and smoke: master off → capabilities policyBlocked + bubble gone; per-role toggles; re-enable | documented; smoke matrix passes against the containerized stack; suites green (backend/web/android counts recorded) |

*(Android assistant gating rides IS4; IAM-style separate milestone not needed.)*

## 7. Testing Strategy

| Layer | Approach |
|---|---|
| Backend unit | `describe()`/chat policy matrix (roles × master × role toggles), boolean round-trip via `getBoolean`, migration seed defaults, code-expiry consumption (create + reset paths) |
| Web (vitest) | tab routing/saving semantics, switch states, visibility matrix for the launcher (pure helper extracted), AI tab status strip conditions |
| Android (jest) | gating helper matrix (same logic), section save behavior, switch helpers |
| E2E/manual smoke | containerized: master off → bubbles/tabs disappear + 403; role toggles; re-enable; department-admin read-only |

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hiding the bubble while a user has a thread open | Gating evaluates on mount/focus; open panel already handles capabilities; document "panel closes when disabled" as accepted |
| Policy toggle confusion (teacher toggle vs master) | UI groups them under an explicit hierarchy (Master → staff → students) with caption text; status strip narrates current state |
| Old cached frontend shows bubble with dead chat | Backend 403 is authoritative; client surfaces the policy reason |
| Regenerate path bypassing policy | Regenerate flows through the same `start()` capabilities check — covered in tests |
| Migration backfill on dirty DBs | Idempotent upsert-style backfill consistent with the repo's self-healing migration conventions |

## 9. Open Questions (defaults if silent)

1. Default state of the new switches: **all enabled** (current behavior unchanged) — confirm?
2. When master is off, should super admins still see the bubble with a "disabled by admin" panel, or **no bubble at all**? (Default: **no bubble at all**, re-enable via Institution Settings — matches "disappear in the bottom right corner".)
3. Should the AI tab show a "Test connection" probe button (server-side ping of the provider)? (Default: defer to v1.1.)

Say "go" and I'll implement IS1 → IS5 in order with the full verification gates.


## 10. Implementation Addendum (delivered)

| Area | Delivered |
|---|---|
| Settings keys | `ai_assistant_enabled` (master), `ai_assistant_teacher_enabled`, `ai_assistant_student_enabled` (all default true) + idempotent migration `20261027120000_ai_availability_settings`; `allow_teacher_student_provisioning` surfaced; `enrollment_code_expiry_days` wired into section create + code reset. |
| Backend enforcement | Role-aware `AiCapabilities` with `policyBlocked` (master → all roles; teacher toggle → teachers; student toggle → students; super admin exempt from the teacher toggle), `POST /ai/chat` 403 when blocked (including regenerate), capabilities precede provider-config checks so setup details never leak to disabled roles. |
| Web settings | Four deep-linkable tabs (`?tab=institution|sessions|accounts|ai`), per-tab save + unsaved dots, switch rows, AI availability hierarchy + status strip, encrypted key block preserved, department-admin read-only preserved. |
| Web gating | `shouldShowAssistantEntry` matrix; launcher resolves capabilities before rendering, hides for policy-blocked roles and for unconfigured non-admins, closes when policy changes; super admins keep the setup affordance while master is on. |
| Android | Same four categories with segmented tabs + `CampusSwitchRow`, per-section save, policy/status strip; student Assistant tab and faculty/super More-sheet entry gated by the same visibility helper. |
| Verification | Backend 619 tests / 58 suites, web 220 / 34, Android 273 / 18; typecheck/lint/format/build clean; containerized smoke: migration seeded the three rows, master-off returns `policyBlocked` for admin+teacher and `403` on chat, teacher-only disable blocks teachers while the admin stays enabled, all toggles restored. |

### Notes

- Settings are read per request; changes take effect on the next capabilities/chat call without a restart.
- Super admins retain assistant access while the master switch is on (they administer the feature); master off hides the entry point for everyone.
- Student surfaces update on next foreground/app open (mobile) or on launcher capability refresh (web).
