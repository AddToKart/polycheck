# AI Assistant Chatbot + Standing Evaluation — Plan

> **Status:** Implemented (AI0–AI6) — backends, web and Android clients shipped; verified
> with 593 backend / 160 web / 204 Android tests. Outstanding device/e2e validation and
> follow-ups are listed in §8. Companion to
> [`super-admin-console-plan.md`](./super-admin-console-plan.md) (SA1 nav cleanup + SA7
> realtime channel are assumed context) and [`bulk-import-plan.md`](./bulk-import-plan.md)
> (a separate track — not duplicated here).
> **AI provider:** optional; disabled when `AI_BASE_URL`/`AI_API_KEY` are unset. Base URL and
> model can also be set by a super admin in Institution Settings (`ai_base_url`, `ai_model`);
> the API key can be entered in Institution Settings (sealed at rest) with `AI_API_KEY` as an env fallback.

---

## 1. Purpose — one architecture, three surfaces

| Surface | Role of the bot | File tools |
|---|---|---|
| Faculty chatbot (teacher **and** super admin — **different instructions & tools per role**) | **Extractor** — find sections/sessions by natural language, produce master lists and attendance files | PDF / DOCX / CSV |
| Student chatbot | **Explainer + standing advisor** — "why was I marked X", "will I pass attendance-wise", professor-escalation guidance | none |
| Standing Evaluation (not AI — ships first) | **Dashboard banner** — threshold-triggered warning computed deterministically | — |

Flagship behaviors (agreed examples):

- *"Extract Software Engineering Section 1's master list"* → resolves the section
  (disambiguation candidate-cards if multiple matches), generates a PDF/DOCX master list
  download.
- *"Extract this section's session on Oct 26"* → the thread remembers the resolved
  section, applies the date filter, returns session + attendance records (summary in chat,
  CSV file on request).
- *"Will I pass this subject attendance-wise?"* → server-computed standing narrated in
  numbers, **never a guarantee**.
- *"I'm always absent"* → advisory: current standing, below-threshold callout, suggests
  talking to the professor **with the professor's name**, offers a draft message
  (copy-and-send; the bot never contacts anyone).

## 2. Verified Current State (facts)

| Fact | Evidence |
|---|---|
| Master-list data source exists | `backend/src/sections/sections.controller.ts:54` (`GET :id/students`) |
| Only CSV export exists today (no PDF/DOCX anywhere) | `backend/src/dashboard/dashboard.controller.ts:43-48` |
| No LLM / pdf / docx / exceljs dependencies installed backend-side | `backend/package.json` (grep clean) |
| Professor identity already on the model | `Section.teacherId` / `Section.teacherName` (shared type) |
| Per-student summaries ready for evaluation (`AttendanceSummary` incl. `disputed`) | `shared/src/types/attendance.ts` |
| **No attendance-passing threshold exists in the system** — settings hold only institution name, geofence, QR validity, grace, enrollment expiry | `frontend/src/app/faculty/settings/page.tsx:14-20`, `android/app/(faculty)/settings.tsx:14-20` |
| Redis (rate limit, thread store), BullMQ (async), audit-logs module, Socket.IO gateway all exist to lean on | sync/settings/audit/realtime modules |
| Super-admin-only realtime-room precedent set by SA7 (`server:metrics`) | `plan/super-admin-console-plan.md` SA7 |
| Mobile already has file-sharing capability | `expo-sharing` installed (QR share) |

## 3. Locked Decisions (✔ = agreed with the product owner)

| # | Decision |
|---|---|
| 1 | ✔ **Provider-agnostic via base-URL config.** OpenAI-compatible adapter driven by `AI_BASE_URL` / `AI_MODEL` (env) or the super-admin `ai_base_url` / `ai_model` settings. The API key can be entered by a super admin in Institution Settings — it is sealed with AES-256-GCM (`AI_KEY_ENCRYPTION_SECRET`, falling back to `BETTER_AUTH_SECRET`) and never returned by `GET /settings`; `AI_API_KEY` env remains a fallback. Provider swap = config change, zero code. |
| 2 | **Tool-calling only:** the LLM never answers from memory — it invokes a governed tool registry that calls backend **services directly** with the requesting user's context. It never free-forms data, never writes raw queries, never writes attendance data. |
| 3 | **Privacy boundary:** the LLM sees conversation text + metadata only (section/professor names, IDs, dates). Row-level data (student names, GPS, records) **never crosses the LLM boundary** — files are generated server-side from tool output. |
| 4 | **Read/export only in v1.** No chat-driven writes: attendance submission, session creation, dispute actions. |
| 5 | **Scope enforced in code, one place:** teacher → own sections; super admin → `admin-scope.ts`; student → own records. The LLM cannot widen it. |
| 6 | **Every tool invocation audited** (actor, tool, args, outcome) in the existing audit-log system. |
| 7 | **Abuse controls:** Redis rate limiter + per-user daily message/token caps; provider cost logging. |
| 8 | **Student bot hard rules:** read-only, own data only; explains *outcomes* ("you were outside the check-in area") but **never anti-cheat mechanics** (no geofence coordinates, radii, or validation internals — otherwise the bot becomes a cheating tool). |
| 9 | **No-guarantee rule:** standing answers are estimates citing actual numbers ("one more absence drops you to 76%"), never "you will pass". |
| 10 | **Professor contact = draft-only:** `get_professor` exposes name + subject/section; **email hidden from students**; a drafted message is copy-and-send; the system never sends or notifies (push is out of v1). |
| 11 | **Standing is computed, not narrated:** deterministic backend evaluator; the LLM only paraphrases its output. |
| 12 | **Banner before bot:** the Standing Evaluation milestone is AI-independent and ships first (or in parallel); the student chatbot consumes the same evaluator. Banner appears only below threshold / projected breach; supportive evidence-first tone; disputed-record caveats noted; never punitive. |
| 13 | ✔ **Threshold:** new institution setting `attendance_min_rate_percent` — institution-wide, default **75%**, super-admin editable. Used by the evaluator, the banner, and the bot. |
| 14 | ✔ **Master list = provisional PUP-branded table + signature slots**, with a deliberately **stable, machine-readable layout** (fixed column order, consistent header block) so future OCR/training can consume it cleanly; official PUP-form replication deferred until the template is supplied. |
| 15 | ✔ **Transport: reuse the Socket.IO gateway** (same realtime stack as SA7/ambient features; no parallel SSE mechanism to maintain). |
| 16 | ✔ **Super admin ships in the same Phase 1 — with role-keyed behavior:** separate system **prompt** per role (super admin narrates oversight/institution-scope context; teacher narrates their teaching workspace) + **per-role tool registry** (teachers resolve only their sections; super admin resolves any in-scope section under `admin-scope`). |
| 17 | ✔ **Web placement:** floating chat bubble on faculty pages + "Assistant" sidebar item; Android equivalent via tab/sheet entry. |
| 18 | **Streamed chat requires connectivity:** Android renders a graceful "assistant unavailable offline" state without disturbing offline-first core flows (scan, schedule, cached records). |

## 4. Milestones (AI0–AI6)

| ID | Scope | Key files | Acceptance criteria |
|---|---|---|---|
| **AI0 — AI foundation** | `backend/src/ai/` module: OpenAI-compatible client (base-URL-driven, mock provider for tests), `AiChatService` (Redis threads + TTL), `AiToolRegistry` (**per-role registries + system prompts**, typed tool schemas, per-call scope checks), `AiAudit` (per-invocation events), rate/cost caps. Shared contract first: chat/tool/stream types + zod schemas + `ApiClient` methods + Socket.IO channel (`ai:chat`, per-user thread rooms). | `backend/src/ai/**`, `shared/src/types/ai.ts`, `shared/src/validation/ai.ts`, `shared/src/types/api.ts`, `backend/src/common/config` env add | registry scope-matrix tests (teacher cross-section denied; student cross-student denied; institution super admin full scope; department super admin constrained); audit row per invocation; caps enforced; mock provider in every test; typecheck green workspace-wide |
| **AI1 — File generation service** | `backend/src/reports/docs.service.ts` — `pdfkit` + `docx` (new deps): **master-list renderer** (stable PUP-branded header: university name, subject, section, professor; fixed student table: No., student number, name, program, year; signature block) per Decision 14; session-attendance renderer; CSV reuse of the existing export pipeline; authenticated downloads (streamed attachment or short-lived URL). | `backend/package.json`, `backend/src/reports/docs.service.ts`, client `ApiClient` file hooks | PDF/DOCX of the same section are content-equivalent (snapshot tests); layout stability assertions (columns never drift); auth-checked downloads; web e2e extraction → download |
| **AI2 — Faculty chatbot (web, teacher role)** | Floating chat panel + "Assistant" sidebar item on the faculty shell; tools: `find_my_sections(q)`, `get_section_master_list(id, format)`, `get_section_sessions(id, date?)`, `get_session_attendance(id)`; disambiguation candidate-cards flow; streaming replies; file attachments; teacher system prompt. | `frontend/src/app/faculty/page.tsx`, `frontend/src/components/Assistant/**`, sidebar + faculty layout | Playwright: "extract software engineering section 1's master list" → resolves → download offered; ambiguity → cards; out-of-scope request → real tool-layer denial + polite chat copy |
| **AI3 — Super admin role unlock (same train)** | Super-admin registry + system prompt: institution-wide lookup via `admin-scope` (any in-scope section's master list, sessions, attendance); audited admin extractions; **AI endpoint input (base URL + model) and encrypted API-key field added to Institution Settings** (web + Android). | `backend/src/ai/**` (super registry), `frontend/src/app/faculty/settings/page.tsx`, `backend/src/common/admin-scope.ts` reuse | department admin limited to own department; institution admin full; audit events carry scope; settings input round-trips and never persists the API key |
| **AI4 — Standing Evaluation (non-AI; parallel to AI0–AI3)** | New setting `attendance_min_rate_percent` (75 default, institution-wide, SA-editable); deterministic evaluator endpoint (`rate`, recent-window trend, "absences remaining before below-threshold" projection, disputed-record caveats); **student dashboard banner** (web + Android): triggers only below threshold / projected breach, **dismissable per session** (Decision: stays hidden until next session/app start), supportive copy + "talk to Prof." action; feeds AI5 thrifting | `backend/src/settings/**` (+ DTO + seed default), new `backend/src/standing/**` (or dashboard extension), `shared` types, `frontend/src/app/student/dashboard/page.tsx`, `android/app/(tabs)/dashboard.tsx` | projection math unit-tested (threshold edges, disputed exclusion); hidden above threshold; Android renders from SQLite cache offline; teacher surfaces unaffected; dismissal honored per session |
| **AI5 — Student chatbot (web + Android)** | Read-only tools: `get_my_subjects`, `get_my_attendance_summary(sectionId)`, `evaluate_attendance_standing(sectionId)` (consumes AI4 evaluator), `get_professor(sectionId)`, `draft_professor_message(sectionId, concern)`; FAQ how-to (enroll, QR, schedule). Student system prompt enforces Decisions 8–10; Android dry offline state (18). | `backend/src/ai/**` (student registry), `shared` student DTOs, `frontend/src/app/student/**`, `android/app/(tabs)/**` | redaction guard suite (no geofence mechanics in any sampled answer/payload); no-guarantee phrasing enforced (prompt + tool framing tests); professor email absent from all payloads; cross-student and write attempts denied at the registry |
| **AI6 — Mobile completion + journeys** | Faculty chatbot on Android with `expo-sharing` file handoff; Maestro flows: master-list extraction (faculty), standing question (student); offline degradation polish; Parity Gate sign-off. | `android/app/(faculty)/**`, `android/app/(tabs)/**`, `android/services/api-client.ts`, Maestro specs | files share via the native system sheet; 375 backend / 93 frontend / 135 android existing tests stay green + new suites |

## 5. Non-Goals (v1)

- Chat-driven **writes/actions** (attendance submission, dispute resolution, session activation) — future, separate decision.
- The broader AI backlog from the evaluation matrix (fraud radar, audit-log anomaly, NL analytics, teacher at-risk list, import copilot, settings advisor, student digest, schedule concierge) — individually re-add later.
- **OCR of handwritten sheets / official-form template replication** — explicitly deferred per Decision 14 until the template/training work matures.
- Push notifications / automated messaging to professors.
- Per-section threshold overrides (v2 option); LLM-computed standings (never); plaintext API keys at rest (never — the settings-stored key is AES-256-GCM sealed).

## 6. Testing Strategy

| Layer | Approach |
|---|---|
| Unit (backend, jest) | evaluator math (rate, trend window, "absences remaining", threshold edges, disputed exclusion); tool-registry scope matrix; PDF/DOCX content snapshots + layout-stability; rate/cap enforcement; per-role registry/prompt selection |
| Unit (web / vitest, android / jest) | chat panel streaming state machine, file-attach UI, banner trigger conditions + session dismissal, offline states |
| Backend integration/e2e | chat endpoint auth across roles; audit rows per invocation; daily cap behavior; download authorization; settings round-trip (key stays env) |
| E2E (Playwright) | AI2/AI3 journeys + denial tests; banner + dismissal persistence on web |
| E2E (Maestro) | AI6 flows (faculty extraction, student standing), offline assistant state |
| Guard suite | system-prompt + tool-output redaction scans on the student surface; no-guarantee phrasing tests |
| CI hygiene | mock provider everywhere; key never returned by `GET /settings`; existing suites stay green |

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| PUP policy on external AI endpoints undecided | Base-URL adapter is swap-ready; a self-hosted endpoint works without code change; AI4 ships AI-independent so the student-facing value isn't blocked |
| Hallucinated answers damage trust | tools-only answering; verbatim tool errors; no-guarantee rule; per-answer audit trail |
| Cost overrun at semester peaks | daily/per-user caps (D7), Redis TTL thread GC, idle shutdown, cost logs reviewable via audit |
| Chat surfaces on the shared `(faculty)` tree repeat the `isSuper` sprawl | lands after SA1 nav cleanup; role branching lives in backend registries; minimal client branching |
| Students probe the bot for cheating workarounds | Decision 8 + redaction guard suite; answers reference recorded outcomes only |
| Provisional master-list template may need rework for OCR | stable machine-readable layout (D14); regeneration centralized in `docs.service` so rework is one renderer |
| Threshold guess wrong (research pending) | constant is institution-editable; research only changes the seeded value |

## 8. Sequencing

1. **AI0** foundation → **AI1** file service → **AI2 + AI3** (one train — the proof of value).
2. **AI4** Standing Evaluation runs **parallel** (pure deterministic, zero AI dependencies) and must precede AI5.
3. **AI5** student bot → **AI6** mobile completion.
4. Assumes SA1 nav cleanup context; reuses the SA7 Socket.IO channel pattern for `ai:chat`.

## 9. Resolved Questions (from the review — no longer open)

Base-URL-driven provider adapter (settings-stored key sealed at rest, env fallback) | provisional + stable-layout master-list template | bubble + sidebar placement | super admin same Phase 1 with distinct instructions/registry | 75% institution-wide default | Socket.IO transport | banner dismissible per session.

## 10. Remaining Open Item

- **Threshold research:** the product owner is validating the correct passing rule; until then the seeded default is 75% and it is institution-editable in the meantime.

## 11. Implementation Addendum (delivered)

| Area | Delivered |
|---|---|
| Shared contract | `shared/src/types/ai.ts`, `shared/src/types/standing.ts`, `shared/src/validation/ai.ts`, `ApiClient` methods (`getAiCapabilities`, `sendAiChatMessage`, `getAiThread`, `getMyStanding`). |
| Backend AI (`backend/src/ai/`) | OpenAI-compatible provider (settings/env base URL + model, settings key sealed with AES-256-GCM or env fallback, SSE streaming, tool-call assembly, timeout), role-keyed system prompts and tool registries (teacher, super admin, student), Redis threads (7-day TTL, ownership checks), Socket.IO `ai:thread:*` channel, daily message caps, fail-open per-tool audit rows, `/ai/capabilities`, `/ai/chat`, `/ai/threads/:id`. |
| Files (`backend/src/docs/`) | `GET /docs/master-list/:sectionId?format=pdf|docx` and `GET /docs/session-attendance/:sessionId?format=csv|pdf` — PUP-branded stable-layout master list with `MASTER_LIST_COLUMNS`, formula-safe CSV, scoped to the requesting teacher / admin scope. |
| Standing (`backend/src/standing/`) | Deterministic evaluator (`GET /me/standing`), `attendance_min_rate_percent` setting (default 75, clamped 0–100), projection + disputed/pending caveat; consumed by the student bot. |
| Web | Sidebar + floating launcher + full-page assistant (streaming, attachment downloads, retry/watchdog), students route `/student/assistant`, student standing banner (per-tab dismissal), settings fields for threshold + AI base URL/model (key never in UI). |
| Android | Assistant tab (student) + faculty/super-admin entry via the More sheet, shared `AssistantChat` with streaming/attachments via `expo-sharing`, student standing banner (process-lifetime dismissal), API client + realtime helpers. |
| Verification | Backend typecheck + 58 suites / 593 tests + eslint + prettier clean; web tsc + 160 tests + eslint clean; Android tsc + 15 suites / 204 tests; shared rebuilt. |

### Known follow-ups

- Maestro flows for the faculty extraction → share sheet and the student standing question are not yet written; Playwright AI journeys likewise not added to `e2e/`.
- Android file share and keyboard layout need a physical-device pass.
- Concurrent `POST /ai/chat` calls on the same thread are last-write-wins; a per-thread lock/409 is the hardening follow-up.
- Thread restoration on Android is session-scoped (no persistence) by design for now.
- Provider retries/backoff are not implemented; the client surfaces a retryable error.
- The threshold value still awaits the product owner’s policy research; the seeded default (75%) is institution-editable.


### Role-tuned assistant follow-up (delivered)

- Super admin assistant now has a distinct system prompt, web/Android UI copy, starter prompts, and three admin-only read tools: `get_institution_overview`, `find_users`, `get_recent_audit_activity` (all scope-enforced via `admin-scope.ts`, audited, no row-level data returned to the LLM).
- Teacher assistant browses own sections with `find_sections` (query optional) and defaults master lists to PDF; student assistant unchanged (own-data explainer).
- Fixed provider 400s after a tool call: assistant tool-call messages now use the OpenAI `type: "function"` shape, and provider rejection bodies are logged (sanitized) for diagnosis.
- `find_sections` tokenizes natural-language queries (stopword-filtered) so phrases like "Extract the master list for Software Engineering CCIS 3104 Section A as PDF" resolve correctly.
- Verified end-to-end with the configured provider: institution overview (admin), list-my-sections (teacher), and master-list PDF generation + authenticated download.
