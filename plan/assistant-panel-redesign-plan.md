# Assistant Panel Redesign — Dock, Theater & Full-Panel UX

> **Status:** Implemented (AP1–AP5 + AM1 Android parity). Verified with 615 backend /
> 183 web / 214 Android tests; Docker stack rebuilt and endpoints smoke-tested
> (thread list → regenerate → delete). Companion to
> [`ai-assistant-plan.md`](./ai-assistant-plan.md) (which owns the assistant backend and
> role-tuned features). This file owns the **web assistant panel UI/UX redesign** and the
> Android parity follow-up.

---

## 1. Goal

Turn the current functional-but-flat assistant surface into a designed experience:

1. A **beautiful, brand-faithful panel** (PUP maroon/golden tokens, Lora headings, square
   bordered aesthetic) instead of today's generic zinc slide-over.
2. **Three geometry states** for the same chat: **Dock** (compact right panel),
   **Theater** (large centered overlay that *partially expands the window*), and **Focus**
   (the existing full-page routes, rebuilt on the same chrome).
3. Real chat-UX features: proper markdown (tables/bold), per-message actions
   (copy/regenerate/stop/retry), collapsible tool activity, attachment file cards, smart
   scroll, and a **threads rail** (list/delete past conversations).

## 2. Verified Current State (facts)

| Fact | Evidence |
|---|---|
| One geometry only: fixed bubble → 28rem right slide-over; full-page routes exist separately with different chrome | `frontend/src/components/Assistant/AssistantLauncher.tsx`, `frontend/src/app/faculty/assistant/page.tsx`, `frontend/src/app/student/assistant/page.tsx` |
| Replies render raw markdown — `**bold**` and tables appear as literal text (no renderer installed) | `frontend/package.json` (no `react-markdown`); visible in product screenshots |
| Tool activity chips are always-on inline rows; no collapse | `AssistantChat.tsx` message render |
| No conversation list — only `GET /ai/threads/:id`; "New chat" abandons history permanently | `backend/src/ai/ai.controller.ts:21` |
| No per-message actions: no copy, no regenerate, no stop; retry is restart-only | `AssistantChat.tsx` |
| Auto-scroll hard-jumps `scrollTop` on every event; `ArrowDownToLine` icon present but no jump-to-latest pill | `AssistantChat.tsx:359,707` |
| Header is a generic zinc bar with one role subtitle string | `AssistantChat.tsx:516-534` |
| Android already has role-tuned copy/prompts but no message actions, activity collapse, or table rendering | `android/components/AssistantChat.tsx` |

## 3. Locked Decisions

| # | Decision |
|---|---|
| 1 | **Both geometries ship: Dock AND Theater** (+ the Focus full-page routes). Dock keeps today's compact panel; Theater is a centered overlay `min(1120px, 92vw) × min(760px, 86vh)` with a dimmed, blurred scrim. The header carries a toggle (⤢ expand / ⤡ collapse); **the user's choice is remembered per device** (`localStorage`, default **Dock**). Esc walks the ladder Theater → Dock → Close. |
| 2 | **No global hotkey.** Geometry and open/close are controlled by in-panel controls (bubble, header toggle, Esc) only. |
| 3 | **Bubble (owner decision):** keep the label **"Assistant"** (icon + text, hidden text on small screens) with a role-aware `aria-label` ("Open faculty assistant" / "Open administrative assistant" / "Open student assistant") and a `title` tooltip showing the role eyebrow ("Faculty assistant", "Administrative assistant", "Student assistant"). No hover-menu extras. |
| 4 | **Brand-faithful visual contract** — zero new hex tokens: header strip light `bg-maroon`/dark `bg-surface-dark` with a golden icon chip and Lora title; transcript on `bg-background`; user bubbles maroon-filled (light) / golden-bordered surface (dark); assistant bubbles bordered cards; `text-[10px] font-bold uppercase tracking-widest` for micro-labels; everything square-edged (`rounded-none`), matching the console. |
| 5 | **Markdown rendering:** `react-markdown` + `remark-gfm` (CSP-safe — no eval, no `dangerouslySetInnerHTML`), token-styled component map: tables (maroon header row, zinc stripes), bold, lists, inline code. Prompts already emit compact markdown tables; with a renderer they become an asset. |
| 6 | **Tool activity collapses** into a per-message disclosure ("Used 2 tools ▾"), chips colored by outcome (succeeded = emerald, denied = amber, failed = red) with detail tooltips; collapsed by default. |
| 7 | **Message actions:** **Copy** on every message; **Regenerate** on the last assistant message (re-posts the same user turn; the fresh `done` replaces the in-flight draft); **Retry** inline on errors (replaces the restart-style banner); **Stop** while streaming (client unsubscribes and marks the draft stopped, then reconciles via `GET /ai/threads/:id` — server keeps its authoritative result; a server-side abort endpoint is a v1.1 item). |
| 8 | **Threads rail:** new backend endpoints `GET /ai/threads` and `DELETE /ai/threads/:id` backed by a per-user Redis index (TTL 7 days). Rail visible in Theater/Focus at `lg:` (w-64; below `lg` a dropdown sheet), hidden in Dock. Items: title (first user message, ≤60 chars, server-derived), role chip, relative time, delete. No rename in v1. |
| 9 | **Smart scroll:** stick to bottom only when already at bottom; otherwise a floating "Jump to latest ↓" pill with an unread count; smooth scrolling gated on `prefers-reduced-motion`. |
| 10 | **Composer upgrade:** auto-grow textarea (≤7 rows), square send button (maroon → golden hover) that becomes **Stop** while streaming, char counter, "ENTER TO SEND · SHIFT+ENTER FOR A NEW LINE" hint retained, attachment-count chip when the thread has files. |
| 11 | **Sizable empty state:** role hero (golden icon chip + Lora headline), 2×2 prompt-card grid from the existing `suggestions.ts` (already role-keyed), plus a per-role "can / can't" two-column list (admin: can overview/accounts/audit/exports, can't mutate; teacher: own-sections only; student: own-data only). |
| 12 | **Header content:** Assistant title, role eyebrow, thread title (first user message), model chip from `capabilities.model`, live/connected dot, geometry toggle, New chat, (Theater/Focus) history toggle, Close. |
| 13 | **Keyboard & a11y:** focus trap in Dock and Theater (`aria-modal` in Theater), Esc ladder, `/` focuses the composer while open, `role="log"` + `aria-live` retained, all controls labeled, contrast verified in both themes. |
| 14 | **Parity:** Android parity is its own milestone (AM1): message copy (Clipboard API), collapsible activity, attachment progress/check states, stop + reconcile, markdown tables via `react-native-markdown-display` (single new mobile dependency, justified in the PR per the Parity Gate). Theater is N/A on mobile (native full-screen is the Focus equivalent). |
| 15 | **Out of scope v1:** thread rename, uploads, voice, server abort endpoint (v1.1), pinned threads, multi-model switching. |

## 4. Architecture (files)

```
frontend/src/components/Assistant/
  AssistantShell.tsx         (NEW — geometry state machine, header toolbar, scrim, focus trap)
  AssistantChat.tsx          (slims: transcript + streaming/composer logic, consumes shell)
  Markdown.tsx               (NEW — react-markdown wrapper with token component map)
  MessageActions.tsx         (NEW — copy / regenerate / stop)
  ToolActivityDisclosure.tsx (NEW)
  AttachmentCards.tsx        (NEW)
  ThreadsRail.tsx            (NEW — list / open / delete)
  EmptyState.tsx             (NEW — hero, prompt grid, can/can't)
frontend/src/lib/           (assistant state helpers extended: geometry preference, stick-to-bottom hook)
backend/src/ai/             (thread index + list/delete routes)
shared/src/types/ai.ts      (AiThreadSummary + ApiClient methods)
```

## 5. Backend contract additions

```ts
export interface AiThreadSummary { id: string; title: string; createdAt: string; updatedAt: string }

// ApiClient additions
listAiThreads(): Promise<AiThreadSummary[]>            // GET /ai/threads
deleteAiThread(threadId: string): Promise<boolean>     // DELETE /ai/threads/:id
```

- Index key `ai:user-threads:<userId>` (Redis zset scored by `updatedAt`, TTL 7d, cap 20); lazily rehydrated from existing thread docs if the index is missing/expired.
- Title = first user message, trimmed to 60 chars.
- Delete = ownership-checked removal of thread doc + index entry + the user's localStorage pointer handled client-side; audited like every other AI action.

## 6. Milestones

| ID | Scope | Acceptance criteria |
|---|---|---|
| **AP1 — Foundation & markdown** | deps + `Markdown.tsx`; transcript uses it; activity disclosure; smart scroll + jump-pill; grouped timestamps | tables/bold/list render correctly in light+dark; zero raw `**`/pipe text; disclosure collapsed by default; scroll sticks only at bottom; pill appears when scrolled up; existing web tests green + unit tests (markdown map, scroll hook, disclosure) |
| **AP2 — Message actions & composer** | copy w/ "Copied" feedback; regenerate-last; inline retry; stop-while-streaming + reconcile; auto-grow composer + stop-mode | regenerate → new assistant `done` replaces the draft; copy works and announces state; stop shows a clean "Stopped — retry?" state and reconciles on next open; composer grows, buttons swap; a11y labels verified |
| **AP3 — Threads** | Redis index + `GET /ai/threads` + `DELETE /ai/threads/:id`; shared types; both clients implement; `ThreadsRail` in Theater/Focus (`lg:`) and sheet elsewhere; open/delete flows | list is newest-first with previews; open switches rooms cleanly (leave/join, restore); delete removes from rail and clears the stored pointer if current; scope matrix tests (cannot list/delete another user's threads); backend suite green |
| **AP4 — Theater + shell refactor** | `AssistantShell` (Dock/Theater/Focus), remembered preference (default Dock), Esc ladder, scrim, focus trap + `aria-modal` + body scroll lock, reduced-motion transitions; bubble opens last-used geometry; full-page routes adopt the shell (threads rail included) | same chrome renders in all three states; preference persists across reloads; focus returns to the bubble on close; no jank in dock; Playwright smoke: open → theater → esc → close ladder |
| **AP5 — Empty state & polish** | role hero + 2×2 prompt grid + can/can't list per role; header model chip/connection dot/thread title; dark/light visual QA, hover states, contrast pass; launcher tooltip per role; docs update | visual checklist complete in both themes; role-specific empty states match the tool registries; E2E assistant spec updated; AGENTS.md + this plan's addendum record delivery |
| **AM1 — Android parity** | copy, activity collapse, attachment progress, stop + reconcile, markdown tables (`react-native-markdown-display`), role empty-state parity | Parity-Gate justification in PR (theater N/A on mobile); all Android tests green; Maestro assertions for copy + activity collapse |

## 7. Testing Strategy

| Layer | Approach |
|---|---|
| Unit (web/vitest) | markdown component map, stick-to-bottom hook, disclosure toggling, geometry preference storage, thread summary mapping |
| Unit (backend/jest) | thread index rehydration/cap, list/delete ownership matrix (user A vs B), title derivation, audit rows |
| Integration (backend e2e) | `/ai/threads` auth matrix; delete round-trip with Redis index updates |
| E2E (Playwright) | open/close ladder, theater geometry, regenerate/stop happy paths, threads rail open/delete; existing assistant specs stay green |
| Visual QA | light+dark screenshots for dock/theater/focus/empty states at 1440px, 1024px, 768px |

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `react-markdown` bundle weight / rendering edge cases | small, no-eval, wrapped in an ErrorBoundary with plain-text fallback |
| Regenerate doubles provider spend | explicit user action; existing per-user daily caps bound it; labeled in UI |
| Stop leaves server work running | documented behavior + reconcile-on-open; v1.1 abort endpoint tracked |
| Redis index drift/expiry | lazy rehydration from thread docs; missing threads filtered from the rail |
| Theater cramped at small widths | geometry switching gated at `lg:`; dock fallback verified at 768px |
| Focus-trap regressions across states | single shell owns focus management; Playwright assert on ladder |

## 9. Resolved Questions

- Hotkey: **none** (all geometry/visibility via in-panel controls).
- Geometries: **Dock + Theater both ship** (+ Focus pages), preference remembered, default **Dock**.
- Bubble: **"Assistant"** label, role-aware `aria-label`, role-eyebrow tooltip — no extra menu.

## 10. Implementation Addendum (delivered)

| Area | Delivered |
|---|---|
| Web UI | `AssistantShell` (Dock/Theater/Focus with remembered geometry, Esc ladder, focus trap, `aria-modal`, body scroll lock, reduced-motion transitions), `Markdown` (react-markdown + remark-gfm, token-styled tables), `MessageActions` (copy/regenerate/inline retry), `ToolActivityDisclosure`, `AttachmentCards` (spinner/check), `ThreadsRail` (list/open/delete/new), `EmptyState` (role hero + 2×2 prompts + Can/Can't), smart scroll + jump pill, auto-grow composer with Stop, header model chip/connection dot/thread title. Launcher keeps the "Assistant" label with role-aware aria/tooltip and opens the remembered geometry. Focus pages adopt the shell. |
| Backend | Per-user Redis thread index (`ai:user-threads:<userId>`, 7-day TTL, cap 20, newest-first, title = first user message ≤60 chars) updated from the single thread-save path; `GET /ai/threads`, `DELETE /ai/threads/:id` (ownership-checked, non-disclosing 404 for foreign threads, audited `ai.thread.delete`); `POST /ai/chat` `regenerate: true` re-runs the last user turn without duplicating it. |
| Android | Copy-message action (expo-clipboard + toast), collapsible tool activity, attachment cards with progress/check, stop + reconcile, GFM tables via `react-native-markdown-display`, role empty-state parity. |
| Verification | Backend 615 tests / 58 suites, web 183 / 30, Android 214 / 16; typechecks, lint, format clean; web production build succeeds; live smoke: list → regenerate (single user turn) → delete works against the rebuilt Docker stack. |

### Notes

- Thread index starts at deploy time; conversations created before this change are not listed (their ids still resolve via `GET /ai/threads/:id`).
- Regenerate appends a fresh assistant message and drops the previous assistant turn; the user turn is reused.
- Stop is client-side; the server run continues to completion and the authoritative result is reconciled on the next open (server abort endpoint remains a v1.1 item).
- Android requires the same JS bundle rebuild only (no new native modules).
