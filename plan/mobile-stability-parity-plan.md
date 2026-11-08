# Mobile Stability & Parity Plan

**Trigger:** device report — "data's disappear again like class schedule and shit won't render again… unstable asf."

**Status:** investigation notes + execution plan. **Nothing is edited yet** — this document is the plan. Root causes for *this* newest report are **hypotheses, not facts** (same discipline that caught the textAlign crash took two hours and one wrong first theory; we instrument first here).

---

## 1. Incident inventory — what we actually know

| # | Symptom (user words) | Which build | Confirmed root cause? |
|---|---|---|---|
| 0.1 | Unstyled release APK | pre-`8e750c1` | **Yes** — gitignored `metro.config.js`; fixed + CI gates |
| 0.2 | "Inputs won't get accepted", "QR generation crashes the app" | `f9bcd4c` line (expo 57.0.32 + styles first release) | **Yes** — `react-native-css` `nativeStyleMapping` runs `.split()` on boolean `true`; any `TextInput` with `className="text-center"` crashed on render (fixed `7d7f846`) |
| 0.3 | "Feels like Electron", slow, white page on every navigation | same | **Yes** — detail screens live in hidden tabs (no push animation), white platform default background, no press feedback, splash handoff race (fixed `803a831`) |
| 0.4 | **"Class schedule and data won't render again"** | **`86603a8` (nav wave)** | **No — hypothesis board below** (§3) |

Evidence timeline for 0.4 (why it deserves instrumentation, not vibes):
- Build `a5a83299` was verified on the emulator with a **data-rich student dashboard** (64% attendance rate, attendance snapshot, schedule sections — pixel + a11y evidence).
- The only changes between `a5a83299` and `86603a8` are: root-Stack `contentStyle`/`animation`, Tabs `animation: 'fade'` + `sceneStyle`, removal of the `key={isDark}` navigator remount, skeleton gates on three *faculty* screens, Reanimated toast, `router.back()` swaps. **No data-fetch code changed.**
- The user's phone was also logged in during the `a5a83299` test (session preserved by upgrade), so a session-loss angle is unlikely — but it is *checkable* (§3 H1).
- Device archaeology hazards we hit: the AVD compositor wedge (black screenshots ≠ proof — reboot first), `pm clear` wiping the user's real login (never do this on a user device), blind taps landing on the IME instead of the button (repro first, tap second).

---

## 2. Non-negotiables for this wave (learned the hard way)

1. **Observability before fixes.** Every EAS release log warned `[@sentry/react-native/expo] Missing config for organization, project` — which means **the "unstable" builds ship without crash/error telemetry**, and every debugging session so far has been emulator archaeology instead of reading a stack trace. Setting up Sentry is step zero.
2. **One bisect lever per build.** No "fix + feature + refactor" bundles. The nav wave shipped 4 changesets together (§2 of AGENTS addendum) which is why 0.4 has four suspects instead of one.
3. **Every fix ships with a Maestro flow.** The repo already has `pnpm --dir android e2e` + 4 flows; instability must be CI-gated, not device-TC'd.
4. **Never test root-causes against the user's only device.** Ask for one demo login (any role) for the emulator; keep the user's phone out of the loop until the fix is verified.
5. **Do not touch dependency engines again without a device check** (`5.0.0-rc.1` was reverted for exactly this; the boolean `nativeStyleMapping` bug remains upstream in rc — the fix stays app-side).

---

## 3. Hypothesis board — "data disappears / schedule won't render" (build `86603a8`)

Each hypothesis has a discriminator: a cheap test whose outcome confirms/kills it. Ordered by prior.

| H | Hypothesis | Why plausible | Discriminator (no code change to test) |
|---|---|---|---|
| **H1** | **Clock/date-range skew**: schedule + trends fetch a calendar window computed from the *device/campus date range*; if the range computation drifted (offline clock offset, month rollover on 2026-11-08, or a missing `lastSyncOffset`), the request returns an empty window for the seeded data and the screen renders "empty" — which the user reads as "data disappeared". | Both waies of the schedule screen compute date ranges (`getRecentCampusDateRange`, `getDateRangeForMonth`); seed data is historical; the same screens worked when the demo data was *recent*. | Open the schedule screen → screenshot + `uiautomator` dump; then run the same `/calendar` request manually via curl with the app's own EXPO_PUBLIC_API_URL and compare the window; check the "REPORT ISSUE" metadata (route + `deviceInfo`) of one submission. |
| **H2** | **Focus-gated fetch lost to scene-freeze**: screens fetch in `useFocusEffect`; with `animation: 'fade'` + `sceneStyle`, react-native-screens may keep the previous scene *frozen* (no unfocus callback on a screen that never committed), leaving data-less screens after the first visit. | New in `86603a8`: `animation` + `sceneStyle` on both Tabs groups. | On any one build with EXPO_PUBLIC scene-animations toggle OFF (ST3 flag below), repeat the same journey. If data renders, the regime is the cause. |
| **H3** | **Removed `key={isDark}` remount hides a latent reset**: screens previously re-mounted (and refetched) when the theme changed; without it, a screen entering with stale/empty state never refires its mount effect if focus timing skips commit. | New in `86603a8`: `key={isDark}` removed from both Tabs. | Same flag pair as H2 but toggling `restoreThemeRemount=true` instead; repeat journey. |
| **H4** | **Splash handoff now gates render on `sessionReady` + fonts** and a focus race blanked an early frame *into* a fade — screen *looks* empty but the list is there one scroll later. | New in `86603a8`: mount-time `hideAsync` removed. | screencap burst (5 frames / 300 ms) while opening the schedule; if any frame shows data, this is perceived only. |
| **H5** | **Server-side empty window for the user's account** (staging data changes), not app code at all. | The user copies "again" — the same report appeared on `a5a83299`? (unverified) | curl the exact endpoints from a machine with the app's env; compare with an earlier successful device session's screenshot. |
| **H6** | **Reanimated-at-provider edge**: mounted AnimatedPressable from CampusToastProvider at root; if its worklet registry fails in release on some devices, React can unmount subtrees (a11y may survive). | New in `86603a8`. | Capture `adb logcat -s ReactNativeJS` during the broken journey; check Sentry events after ST1. |

**H1 and H5 are priors; H2/H3/H6 are regime-change suspects.** The flags built in ST3 let us bisect H2/H3/H6 across **one build each** instead of days of archaeology.

---

## 4. Phases

### ST1 — Observability first (no device time needed) — ~0.5 day
| ID | Task | Files | Done when |
|---|---|---|---|
| ST1.1 | Create/confirm the Expo Sentry project + set `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` on the **EAS `preview` environment** (release docs already list them; the EAS release log proves every build is currently missing them) | EAS dashboard only | Build log no longer prints `Missing config for organization, project` |
| ST1.2 | Confirm the app's Sentry init is env-gated (it is — `_layout.tsx`) and that `beforeSend` still strips PII | none (verify) | A device error section appears in Sentry with symbols; **crash-free rate visible per build** |
| ST1.3 | Document the "unstable-asf" intake path in `android/RELEASE.md`: what to capture first (Sentry issue → device logcat → Maestro replay), so nobody patches on vibes | `android/RELEASE.md` | Runbook section merged |

### ST2 — Reproduce loop (works with the user's environment, not on vibes) — ~0.5 day
| ID | Task | Done when |
|---|---|---|
| ST2.1 | Ask the user (1) which screen shows what — phone screenshots of the empty schedule + the exact list sections visible; (2) whether it is the same device build `86603a8` — the QR/`boj…` artifact they have; (3) a throwaway demo login for the emulator (any role), **not** their real credentials | Repro steps in hand |
| ST2.2 | Manual em-ul journey: fresh install (`boj…` artifact) → login → dashboard → schedule → record `uiautomator` + screenshots + `logcat -s ReactNativeJS` — and **one more journey after an `AVD cold boot`** (the compositor wedge pitfall; never trust black screenshots) | One confirmed repro (red loop) |
| ST2.3 | Cross-check the very same journey via the **API**: curl the endpoints the schedule consumes using the app's own EXPO_PUBLIC_API_URL and see if the *server-side window* is empty (separates app bug from server state) | H1/H5 confirmed or dead |
| ST2.4 | Sentry event check per journey (ST1 prerequisites) — the user's phone mention of QR gen crash on `86603a8`, schedule blank — thank Sentry for stacks instead of archaeology | Stack recorded for each symptom |

### ST3 — Bisect levers (min-diff flags) — ~1 day
| ID | Task | Notes |
|---|---|---|
| ST3.1 | Add `EXPO_PUBLIC_DISABLE_SCENE_TRANSITIONS` read in `_layout.tsx`, `(tabs)/_layout.tsx`, `(faculty)/_layout.tsx` — when `=== 'true'`, `animation: 'none'` and **no** `sceneStyle`; tested via one flag-flip in `eas.json` or `.env`, no code re-write | Discriminates **H2** |
| ST3.2 | Add `EXPO_PUBLIC_RESTORE_THEME_REMOUNT=true` lever reproducing the old `key={isDark}` remount exactly (the `Tabs key` line restored conditionally) | Discriminates **H3** |
| ST3.3 | Add `EXPO_PUBLIC_DISABLE_ANIMATED_TOAST` lever (skip AnimatedPressable; render plain `<Pressable>`) | Discriminates **H6** |
| ST3.4 | One build per lever (preview profile, `--no-wait`) + a 5-minute Maestro run per artifact with the user's demo login | Proven bisect table in the plan doc |

### ST4 — Stability fixes that are correct *regardless* of which hypothesis wins — ~2 days
These make the app "not unstable" even when data is missing, i.e. failures degrade to a visible state:
| ID | Task | Files |
|---|---|---|
| ST4.1 | **Student + shared screens get loading/error gates** exactly like the faculty trio: student dashboard, student schedule, history, sections list, disputes, excuses, at-risk, users, subjects ([id]) — each with `CampusSkeleton` + error `CampusEmptyState` retry | their `*.tsx` |
| ST4.2 | **`LoadFailurePanel`** primitive (title + auto `Mount occurs on error` retry) + a `CampusErrorBoundary` per route level so a render throw shows a PUP-styled retry screen **instead of white/blank**; expo-router screen error boundary (from SDK 57, per nov `57.0.17` note in expo-router changelog) | `CampusPrimitives.tsx`, screen files |
| ST4.3 | Make the date windows **explicit and assertable**: a `lib/date-window.ts` that formats + logs the start/end it requests, and a dev-only banner on schedule/report screens showing the exact range used (flags-gated, e.g. `EXPO_PUBLIC_DATE_DEBUG`) — the same trick that made the textAlign crash obvious | `android/lib/*` |
| ST4.4 | If **H2/H3/H6** wins a bisect: fix root cause in that regime (e.g. correct focus callbacks under scene-freeze), or roll that layer back and land the fix as a separate commit + flow | layouts |
| ST4.5 | Add the 2 Maestro flows the repo is missing as shipped flows: a faculty "session cockpit opens latency check" and a student "schedule renders after login" — run by CI after each build | `android/maestro/flows/*` |

### PX — Identity & parity wave (after ST4) — ~1–2 weeks
Ordered by the parity audit (§6 below) and the user's "feels like Electron":
| ID | Task | Files |
|---|---|---|
| PX1 | **Real push stack for detail screens** (the C-tier structural fix): move tab-level screens into `app/(group)/(tabs)/**`, wrap in `Stack` whose child is `Tabs`; detail routes become actual edges with back gesture + slide animations. Approx ~30 call sites of href strings to update; adds native-transition life everywhere | layout restructure |
| PX2 | Skeleton/error gates for *all* remaining screens (ST4.1 tail) | whole app |
| PX3 | Haptics (`expo-haptics`) + selection tick on CampusButton/card taps; requires the EAS rebuild (native module) | `CampusPrimitives.tsx`, new dep |
| PX4 | Horizontal-snap stat cards on both dashboards (replaces wrap grid feel) | dashboards |
| PX5 | Assistant threads sheet + Regenerate (MT parity audits #1–2) | `AssistantChat.tsx` |
| PX6 | Designations editor in Users (parity #3) | `users.tsx` |
| PX7 | Audit-log search + custom dates (parity #4), dashboard trend period selector (parity #5) | screens |
| PX8 | Server-status history/sparklines (parity #7), users `provisioned` filter (parity #8), bulk import failed-rows CSV (parity #9), attendance drill-through (parity #10), history custom dates (parity #11), SR filters (parity #6), `expo-network` telemetry (parity #12) | screens |
| PX9 | Motion polish: staggered list entrance (`FadeInDown` per card), animated counters, calendar event switches | dashboards |

### Exit criteria ("stable asf")
- **Two consecutive capture builds** on EAS, each with the full Maestro journeys passing 3× (login renders, schedule renders, cockpit opens, QR modal opens, enroll submits — covering the exact symptoms), no `FATAL`, and **zero user-reported render data-loss** over a week.
- Sentry crash-free sessions ≥ 99.5% on the preview build with > 10 sessions.
- `plan/apk-readiness-plan.md` addendum closed with repro table + root cause of each of the original five symptoms mapped to its Maestro flow + fix commit.

---

## 5. Explicit non-goals / rollback discipline
- **No dependency upgrades mid-wave** (`nativewind`/`react-native-css`/expo paddles stay pinned; rc evaluation stays CLOSED until upstream stable ships the `nativeStyleMapping` fix).
- Each bisect flag ships in `eas.json` preview env only — **production env untouched**.
- Every change lands with: repro table row, Maestro flow, and rollback note (revert commit id).
- The user's device is off-limits until ST2.1 gives a demo login; screencaps on the AVD must be post-reboot (compositor pitfall documented in AGENTS).
- `pm clear` is banned on user devices; only on the AVD.

## 6. Evidence references
- Root causes fixed this far: `8e750c1` (metro config), `7d7f846` (textAlign crash), `803a831` (nav/regime), docs commit `4b973e1`.
- Suspect-set for 0.4 with discriminators: §3.
- Device pitfalls: black screenshots (AVD wedge), IME covering taps during repro, `pm clear` wipes the session, staging password ≠ local seed password (401 toast on `jmdelacruz`).
- Parity root: full matrix is the "web↔app cross-reference" from the earlier session; the top 12 gaps are PX5–PX8 above.

---

## Execution record — 2026-11-08 (stability wave 1, commit `073f108`)

**Landed:**
- `useLoadState` (`android/hooks/use-load-state.ts`) + `CampusLoadError` retry primitive.
- **Silent-swallow removal + gates** on: student schedule, student dashboard, student history, faculty schedule, faculty dashboard, faculty subjects, faculty sessions list, and the session cockpit (now retries in place instead of bouncing to `/`). Loading = skeleton; failure = readable retry panel; empty state only when the load actually succeeded.
- Faculty-dashboard regression fixed (the previous skeleton gate stayed forever on error).
- **Themed expo-router `ErrorBoundary` at the root** (`components/CampusRouteError.tsx` + export in `app/_layout.tsx`): render throws show a retry screen and are reported to Sentry (when configured) + `console.error`.
- **Device-bisect levers (default off, no behavior change)**:
  - `EXPO_PUBLIC_DISABLE_NAV_TRANSITIONS=true` — root Stack animation `none`, both Tabs `animation: 'none'` with no `sceneStyle`.
  - `EXPO_PUBLIC_RESTORE_THEME_REMOUNT=true` — re-adds the old `key={isDark}` navigator remount.
  - `EXPO_PUBLIC_DISABLE_ANIMATED_TOAST=true` — plain toast without the Reanimated wrapper.
  These target hypotheses H2/H3/H6 in §3 so one preview build per flag bisects them.
- **Verified**: Android 656/656, typecheck clean, styled-bundle gate green; EAS preview `64172483-2a8e-4c4d-8cb3-aaef22555799` finished, artifact fingerprint-verified (`twsa-safe-area=4`), installed on the AVD (cold start 1.95 s, portal renders 95.4% maroon / 178 color buckets, zero fatal).

**Blocked / still open:**
- **Sentry remains unconfigured** — `eas env:list --environment preview` returns “No variables found”. Without `EXPO_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) every future crash still produces no stack trace. Owner action: create/point the Sentry project and set the preview env; the app code already consumes it.
- **Device repro of the schedule/data-loss syndrome still needs a demo login.** The AVD password for the staging seed differs from `.env.docker.local`; without a valid staging credential the emulator cannot exercise authenticated screens. Provide one throwaway login (any role) to close ST2.
- Remaining ST4 gates: faculty attendance, reports, at-risk, disputes, excuses, users, system-reports, assistant thread list, student subjects list, subject-info (has a spinner but maps errors to “not found”). Mechanical, same pattern.
- PX wave (push-stack restructure, haptics, parity items PX5–PX8) remains per §4.

---

## Execution record — 2026-11-08 (stability wave 2, commit `05d89fa`)

**Two compositing defects that can show rounded UI over another screen's text, both fixed:**
1. **Tab cross-fade default removed.** A stuck/queued `animation: 'fade'` transition leaves the outgoing scene composited under the incoming one (its rounded cards and text remain visible over the new screen). Navigation is now **instant by default**; the slide/fade set is opt-in via `EXPO_PUBLIC_ENABLE_NAV_TRANSITIONS=true`. Themed `contentStyle`/backgrounds stay (no white flash). Previous lever `EXPO_PUBLIC_DISABLE_NAV_TRANSITIONS` is superseded.
2. **ID-card 3D flip rewritten (3 places).** `backfaceVisibility: 'hidden'` is unreliable on Android/Fabric; both absolutely-positioned faces can render at once, producing exactly "rounded corners overlapping text" (front + mirrored back inside `rounded-[26px]` cards). `IdCardModal`, the student ID tab and the faculty student-detail card now mount **one face** and fade through the swap (reduced-motion aware). No 3D transforms remain.

**Retry gates completed** on the remaining data screens: attendance, reports, users (initial/empty load), disputes, excuses, at-risk (fake "everyone on track" empty state replaced), system-reports, student subjects, subject-info (network failure no longer reported as "class not found"). Every data screen now has loading → skeleton, failure → `CampusLoadError` with working retry, empty → only after a successful load.

**Verified:** Android 656/656, typecheck clean, styled-bundle gate green; EAS preview `f763cd1c-1d6d-42f3-a1c6-85a6c912047d` finished; artifact fingerprint checked (`twsa-safe-area=4`); installed on AVD (cold start 1.75 s, portal 95.4% maroon / 178 buckets, zero fatal).

**Still blocked on owner:** Sentry DSN/org/project on the EAS preview environment (no variables configured) and one throwaway demo login for authenticated device repro. A screenshot of the remaining overlap (when available) will map to either the flip card (already fixed), a specific sheet/overlay, or the build-identification issue.
