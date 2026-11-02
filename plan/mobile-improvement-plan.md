# Mobile Improvement & Sync Plan — Bug Fixes, Parity + Release Hygiene

> **Status:** Complete (MP1–MP6). Addendum below records results and deviations.
> Companion to
> [`bulk-import-plan.md`](./bulk-import-plan.md) (which now includes mobile import — BM6)
> and [`offline-web-pwa-plan.md`](./offline-web-pwa-plan.md). This file covers everything
> mobile needs **besides** import: verified parity fixes, UX/tooling parity, store-release
> hygiene, and a governance gate that keeps web and mobile at the same capability level from
> now on.

---

## 1. Goal

1. Fix every verified gap between the mobile app and the web dashboard (the full audit came
   back "at parity overall" — the gaps below are the entire remainder).
2. Ship Play-Store-grade release hygiene before the first public upload.
3. Institutionalize a **Feature Parity Gate** so no future feature lands on one platform
   without the other (the reason this folder needs to exist).

## 2. Verified Current State (facts from the parity audit)

| Fact | Evidence |
|---|---|
| Mobile is at **feature parity** with web across auth, subjects, sections, sessions, cockpit, attendance, disputes, reports, schedule, search, users, settings, audit logs, student flows, scan (3 channels), officer flows, dark mode, realtime | full matrix audit (this repo, this cycle) |
| Mobile adds what web lacks: offline-first SQLite + sync queue, offline QR signing/activation/end, trusted timestamps, device-security evidence, screen-capture block, GPS pins on session map, native share sheets, scanner UX | `android/services/*`, `android/app/(tabs)/scan.tsx` |
| **Gap 1:** mobile Schedule is teacher-only — super admin has no Schedule access (web super admin has it) | `android/app/(faculty)/schedule.tsx` → `useAuthGate(['teacher'])`; super More-sheet list has no Schedule item (`(faculty)/_layout.tsx` / `more-tab.tsx`) |
| **Gap 2:** no toast/notification system — all feedback is blocking `Alert.alert`; web has a toasts provider | `android/**` grep: zero toasts; `frontend/src/lib/notifications.tsx` |
| **Gap 3:** Reports distribution renders a stacked bar, web renders an SVG donut chart | `android/components/AttendanceReportCards.tsx:107`; `frontend/src/app/faculty/reports/page.tsx` |
| **Gap 4:** map divergence — web shows a campus-buildings overlay + status-colored check-in pins; mobile shows student GPS pins but no building overlay | `frontend/src/components/CampusMap.tsx`; `android/components/MapView.tsx` |
| **Gap 5:** `debug.tsx` dev screen is deep-linkable in production builds | `android/app/debug.tsx` (static style-baseline screen) |
| **Gap 6:** `id-card.tsx` route is shadowed by `IdCardModal` and only reachable by deep link | `android/app/(tabs)/id-card.tsx` |
| **Gap 7:** store build hygiene unverified: `versionCode` still 1, QR-fallback gates default-enabled on mobile (`EXPO_PUBLIC_ALLOW_QR_FALLBACKS !== 'false'`), Sentry DSN wiring to confirm | `android/app.json`, `android/services/api-config.ts`, scan fallback gate |
| No `expo-document-picker` and no toast lib installed (needed by BM6 mobile import + Gap 2) | `android/package.json` |
| 132/132 android tests pass, 9/9 suites | `pnpm -C android test` |
| Web-only extras that are **fine** (explicitly not gaps): persistent sidebar, global search box in chrome, CSV Blob download vs native share, Runtime guards | audit notes |

## 3. Locked Decisions (from the parity review — not open questions)

| # | Decision |
|---|---|
| 1 | Feature parity target is **"same features and capabilities"** — neutral chrome differences (floating tab bar vs sidebar) are accepted; capability differences are not. |
| 2 | Import capability parity: bulk import **ships on mobile** (owned by `bulk-import-plan.md` **BM6** — this plan no longer duplicates it). MP1 (store hygiene) runs first because the store upload is imminent; the polished import UX lands on MP2's toast infrastructure. |
| 3 | Toasts: build a minimal in-house `CampusToast` provider (no new dependency) matching the existing `Campus*` primitives + `pupColors` tokens; `Alert.alert` stays for **destructive confirms only** (delete/disable/end-session), toasts for feedback. |
| 4 | ~~Super admin gets Schedule on mobile (gate + More-sheet item).~~ **Superseded by `super-admin-console-plan.md` SA1/LD9 — the super-admin Schedule More-sheet item is removed (Option A deep links remain).** |
| 5 | `debug.tsx` is deleted; `id-card.tsx` route is **kept** (deep-link surface, 1-line doc note). |
| 6 | Release hygiene (MP1) is the **first** milestone here — the store upload is imminent. |

## 4. Milestones (MP1–MP6)

| ID | Scope | Key files | Acceptance criteria |
|---|---|---|---|
| **MP1 — Release hygiene (store-ready)** | delete `debug.tsx`; audit `EXPO_PUBLIC_*` for production defaults (`EXPO_PUBLIC_ALLOW_QR_FALLBACKS` must be explicitly `"false"` in the release build — flip the parity with the web policy `NEXT_PUBLIC_ALLOW_QR_FALLBACKS=false`); versionCode/versionName bump strategy (document `versionCode` monotonic rule in app.json); Sentry DSN wiring check for native SDK; verify `eas.json` production profile (no `--local`-only flags, digest-pinned images if base images are used); icon/adaptive-icon + splash final check | `android/app/debug.tsx` (delete), `android/app.json`, `android/eas.json`, `android/services/api-config.ts`, build docs | release build (`eas build --profile production`) passes; `adb shell monkey` smoke on release variant; no dev screens reachable; `npx tsc` + all 132 tests green |
| **MP2 — Toast parity + super admin Schedule** | minimal `CampusToastProvider` (variants: success/error/info/warning; auto-dismiss; `accessibilityLiveRegion`; stacked at top under `useSafeAreaInsets`; NativeWind classes only); migrate **feedback-style** `Alert.alert` call sites to toasts (keep destructive confirms as Alerts); add super admin to schedule gate + More-sheet Schedule item | new `android/components/CampusToast.tsx` + provider in `android/app/_layout.tsx`; `android/app/(faculty)/schedule.tsx`; `more-tab.tsx` sheet list; feedback call-site sweep (`Alert.alert(...)` grep) | toasts render in light+dark via tokens; no `Alert` feedback prompt remains (destructive only); `super_admin` can open Schedule and sees events; jest snapshot/logic tests for provider |
| **MP3 — Reports donut parity** | donut chart via `react-native-svg` arcs (same `pupColors` palette as web `colors.ts`), animated sweep on data change; keep legend + rate bar | `android/components/AttendanceReportCards.tsx` | visual parity with web donut (presents/late/absent arcs + counts center); unit test arc math |
| **MP4 — Map capability parity** | add campus-buildings GeoJSON overlay to the mobile Leaflet WebView consuming the same asset/source the web `CampusMap` uses; keep student GPS pins + geofence circle; verify `invalidateSize` behavior unchanged | `android/components/MapView.tsx`, shared buildings asset, `frontend/src/components/CampusMap.tsx` (source of record) | buildings render on mobile session/create maps; GPS pins still show; no WebView reload churn (existing stability rules hold) |
| **MP5 — Standing fixes sweep** | triage the open items in `documentation/bug-audit-2026-10-08.md` against mobile (`sessions/create.tsx` router import note, section roster `417` item → re-verify fixed), plus grep sweep for stale TODO/FIXME in `android/**`; resolve or ticket each with rationale in this file's addendum | `android/**` per triage output | zero unresolved M-items affecting mobile; `TODO/FIXME` count in android reduced to 0 or each mapped to a Next-Steps entry |
| **MP6 — Parity gate (governance, permanent)** | add to `AGENTS.md` Dev Conventions: **Feature Parity Gate** — (a) every feature change to the shared `ApiClient` starts with the shared contract (types/schemas) before either UI exists; (b) every UI feature PR lists both platforms — either both implemented or an explicit one-line justification ("super-admin-only", "native-only", "PWA follow-up") recorded in the PR body; (c) role journeys get paired E2E: Playwright spec ↔ Maestro flow; (d) quarterly re-run of the parity audit matrix (rerun of this cycle's audit agents) with results appended to this plan's addendum | `AGENTS.md` (docs-only change), PR template note | AGENTS.md updated; next feature PR demonstrably follows the gate |

## 5. Non-Goals

- No backend work in this plan (import backend belongs to the bulk plan; offline sync infra exists).
- No OS background-sync or push notifications here (already in `AGENTS.md` Next Steps; on-web it's the PWA plan's §14 note).
- No UI redesign — this plan aligns capabilities and hygiene only.

## 6. Testing Strategy

| Layer | Approach |
|---|---|
| Unit (Jest) | toast provider lifecycle (enqueue/dismiss/auto-expire/variant), donut arc math, schedule gate matrix (teacher/super/student rejection) |
| E2E (Maestro) | extend `03-super-admin-journey.yaml`: open Schedule as super admin; `04-bulk-import.yaml` lives in the bulk plan; toast assertions via `assertVisible` on accessibility testIDs |
| Regression | all 132 existing android tests remain green after each milestone; typecheck gate on every PR (`pnpm -C android typecheck`) |
| Release check (MP1) | production EAS build + manual device matrix check (fresh install → login → scan with fallbacks OFF → offline scan → sync) |

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Toast migration sweep touches many files → regression churn | migrate feedback-style alerts in per-screen commits behind MP2 scope list; testIDs + snapshot coverage; keep destructive `Alert.alert` untouched |
| GeoJSON overlay bloats WebView memory on low-end devices | compress/simplify geometry to building outlines only (same as web usage); load once per WebView session |
| Fallbacks-off release blocks legit recovery flows | manual-token entry stays available under a distinct explicit setting; document the remediation path for teachers (web cockpit remains fully online-authoritative) |
| `versionCode` mistakes on first store upload | document monotonic increment rule + reserve published codes; CI builds read version from app.json only |

## 8. Sequencing (master roadmap view across the three plans)

```
[MP1 release hygiene]  ← store upload imminent: do first
[offline PWA M1–M4]
[bulk import BM1–BM2 backend] → BM3/BM4 web wizards
[BM6 mobile imports]          ← needs BM2/BM4 endpoints; lands on MP2 toasts
[MP2–MP5 in parallel windows as capacity allows; MP2 gates BM6 UI polish]
[MP6 gate: active from the next feature PR onward — permanent]
```

## 9. Open Decisions (resolve before each milestone's kickoff)

| # | Milestone | Decision | Options | Recommendation |
|---|---|---|---|---|
| A | MP1 | `debug.tsx`: delete vs `__DEV__`-gate route | delete vs runtime gate | **delete** (locked §3) |
| B | MP2 | toast duration + stacking depth (2 vs 3 visible) | — | 3.5s success/info, 5s error, max 2 visible |
| C | MP4 | buildings GeoJSON: shared package asset vs per-platform copies | — | shared `@polycheck/shared/map-assets` |
| D | MP6 | enforce via AGENTS.md only vs CI checklist bot step | docs vs automation | docs first; revisit automation after 2 features |

## 10. References

- Audit inputs: this cycle's parity audit (agents) + `documentation/bug-audit-2026-10-08.md`
- Mobile: `android/app/**`, `android/components/**`, `android/services/**`, `android/package.json`
- Web counterparts for parity targets: `frontend/src/app/**`, `frontend/src/components/**`
- Related plans: [`bulk-import-plan.md`](./bulk-import-plan.md) (BM6 = mobile import),
  [`offline-web-pwa-plan.md`](./offline-web-pwa-plan.md) (web offline parity),
  [`realtime-infra-plan.md`](./realtime-infra-plan.md), [`sync-plan.md`](./sync-plan.md)

---

## 11. Implementation Addendum

- **MP1:** debug screen deleted; QR fallbacks opt-in (`hooks/qr-fallback-policy.ts`, exact `"true"`);
  EAS production pins fallbacks + E2E off; splash/monochrome icon config; `android/RELEASE.md`.
- **MP2:** in-house `CampusToast` (max 2, 3.5s/5s, accessible) + pure queue module with Jest tests;
  feedback Alerts migrated, destructive confirms preserved; super admin Schedule enabled with a
  Maestro assertion. Also added the forced-password-change screen/gate for provisioned accounts.
- **MP3:** SVG donut distribution card (same palette family as web), totals centered; legend/rate bar kept.
- **MP4:** no change required — the mobile Leaflet WebView already consumed `pupSantaMaria.buildings`
  (the audit claim was stale).
- **MP5:** calendar trailing-week fix + validation drift fixed in shared; mobile audit items fixed:
  section/session cache fallbacks, student-detail loading/finally, creation `sectionId` prefill,
  terminal-scan phantom removal, authoritative activation caching, cold-start splash bound,
  and mutation error feedback. `TODO/FIXME` scan in `android/**` is clean.
  - **MP6:** Feature Parity Gate + offline-first contract added to `AGENTS.md`.
- **Supersession (super-admin console plan, SA1/LD9):** the MP2 super-admin Schedule More-sheet item was removed; the schedule screen/gate remain for Option A deep links. The console plan also replaced the super dashboard, user management, and added account/role management + live Server Status.
- **Verification:** android typecheck clean, **142 tests / 11 suites** pass; backend 457; frontend
  112; shared 87. Maestro was not run locally (Maestro/adb unavailable); release build/device
  checks remain in `android/RELEASE.md`.
