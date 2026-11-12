# Flutter Device-Bug Sweep 2 (SW) — Admin Nav, Profile/Assistant Chrome, Scanner Crash & Offline Verify

> **Status:** Proposed — not started. Evidence: full read-only audit of
> `polycheck_mobile/` + backend serializers + RN/web reference (`documentation/flutter-parity-gap-report.md` sibling audit, 2026-11-10).
> Trigger: emulator/phone device-testing round 3 (screenshots: red-screen assert on
> "Verify & check in", offline scan rejected "QR token signature is invalid", admin
> console without navbar, profile/assistant chrome).
>
> All fixes live in `polycheck_mobile/` — no backend shared/web changes. Dart-only (hot restart).

---

## 1. Verified bug inventory (root causes, cited)

| # | Report | Root cause (audited, file:line) |
|---|---|---|
| SW-1 | Admin console "unfinished" — no navbar | Admin routes are flat `GoRoute`s with NO ShellRoute (`admin_routes.dart:16-47`), so no `CampusBottomNav` ever mounts. Every admin screen self-hosts chrome via `AdminScaffold` with only a `PopupMenuButton` section menu (`admin_common.dart:67-112`). The shared `CampusBottomNav` (`core/widgets/campus_bottom_nav.dart`) is fully generic and needs zero changes — a shell is all that's missing. Per-designation bar contents must come from `adminSectionsFor(user)` (`admin_access.dart:89-132,170-176`): super admin 7 items, IT 3, registrar **1** (a 1-item 58px bar reads as broken → registrar keeps popup-only chrome). Back affordance (deep links → console fallback) already exists (`admin_common.dart:71-77`). |
| SW-2 | Profile "Notifications" chip duplicates the header bell (unread badge 13) | Tab added in `_tabsFor` (`profile_screen.dart:67`), rendered by the full-width branch via `NotificationsPanel` (:180), chip row (:408-440). The header already hosts `NotificationBellAction` (:167) which navigates via `router.go('/profile?tab=notifications')` (`notifications_panel.dart:340-344`) — that URL target must be retargeted to `push('/notifications')` so deep links keep a back affordance. |
| SW-3 | Assistant page — no back button | `assistant_screen.dart:796-814` AppBar is a `CampusHeader` with only `actions`; `CampusHeader` implies leading only when the route can pop — and stackless entries (`SurfaceNavigation.open` → `router.go`, profile button `profile_screen.dart:160-165`, notifications, deep links) leave the stack empty. Need the established fallback: implied arrow when `canPop`, else explicit `BackButton → role home` (`admin_common.dart:71-77` / `profile_screen.dart:147-153` patterns). |
| SW-4 | Red-screen crash on tapping **"Verify & check in"** (manual token entry) | Assert `framework.dart:6268 '_dependents.isEmpty'` — an InheritedElement deactivates while a dependent survived an interrupted teardown. Code path: `_openManualEntry` (`student_scan_screen.dart:345-399`) creates the `TextEditingController` in the SCREEN state, pops with the token, then **`controller.dispose()` at :396 while the dialog's `TextField`/`EditableText` may still be mounted** (showDialog's future resolves at pop; the ~150 ms exit transition keeps the subtree live; the autofocus keyboard dismissal drives a MediaQuery pass through that live subtree) → exception inside overlay teardown → interrupted deactivation → the assert. The PIN dialog (:225) has the identical bug. Submit service is UI-free (ruled out provider/navigator causes; submit-at-:398 `setState` is a secondary aggravator). Fix = adopt the working pattern already in-repo: `enrollment_code_dialog.dart:14-32` — dialog widgets own + dispose their controllers in `State.dispose()`. |
| SW-5 | Button `Verify & check in` label | `student_scan_screen.dart:384`, single site (sibling: PIN dialog `Verify & record` :207 — cosmetic, owner may align). Recommendation: `SUBMIT CHECK-IN TOKEN`. |
| SW-6 | **Offline scan rejected "QR token signature is invalid"** despite offline-ready | NOT a bug in the new W1 defense — it is the defense **working as pinned by tests** (`student_scan_defense_test.dart:357-380`): offline, the gate verifies the teacher signature before queueing, using the cached session's `teacherPublicKey`; **RN is identical and also fails closed on a missing key** (`api-client.ts:1294-1299` — a 0-byte key makes tweetnacl verify fail). Dart verify math is canonicalization-identical to the shared TS signer (payloadB64 string bytes, 32-byte key, 64-byte detached sig; `token_crypto.dart:199-215` vs `shared/src/utils/token.ts:62-99`) — no static mismatch found. So the reject means the cached session had **no key** — the most likely runtime causes: (1) the session was cached/deseeded without the key (staging reseed, teacher key revoked via `POST /auth/revoke-key`, or the teacher device never provisioned against THIS backend); (2) a stale offline-prep cache predating the teacher's provisioning. The teacher's key always rides `present()` for students (`sessions.service.ts:1122-1154` emits `teacherPublicKey` for all roles, batch-loaded :1007-1013), so a fresh online prepare/refresh heals the cache. The readiness chip is blind to key presence (`readiness.dart:66-84` checks coverage/enrollment/clock only) — hence "READY" contradicting a failed scan. |
| SW-7 | Offline banner overlaps the scanner header | The banner is a `main.dart:130-181` `_BootLifecycle` overlay pinned to the status-bar inset above the Navigator; the scanner is the only full-bleed no-AppBar screen (`student_scan_screen.dart:417-419`, header at `Positioned top:0` + SafeArea) → collision exactly at the strip boundary. |

## 2. Locked decisions

| # | Decision |
|---|---|
| 1 | **Admin nav**: wrap all 7 `/admin/*` routes in a `ShellRoute` → NEW `AdminShell` (`features/admin/presentation/widgets/admin_shell.dart`) rendering the shared `CampusBottomNav` as `bottomNavigationBar`. Bar items = **first 4 of `adminSectionsFor(user)`** when the filtered set ≥ 2 (super admin: Dashboard · Users · Settings · Audit); items beyond 4 keep the existing AppBar popup as overflow (hide popup items already shown in the bar). **Registrar (1 item) keeps popup-only chrome** (no bar). `adminTabFor(location)` pure mapper drives highlight (detail/`?tab=` routes map to their owning section). CampusBottomNav itself: no changes. Back affordance (`BackButton → adminLandingRoute`) preserved for deep links. |
| 2 | **Profile chrome**: drop the Notifications tab (chip + content branch + panel host). `?tab=notifications` remaps at `_normalizeTab` to security **and** post-frame `push('/notifications')` so old deep links and the bell open the center page. `NotificationBellAction` retarget: `go('/profile?tab=notifications')` → `push('/notifications')` (keeps the banner path states). Enum value kept for wire compat. |
| 3 | **Assistant**: `CampusHeader(automaticallyImplyLeading: canPop)` + fallback `BackButton → role home` (profile pattern) with key `assistant-back-fallback`. Reached via push → implied arrow; via deep link/profile `go` → fallback arrow. |
| 4 | **Scanner dialogs**: extract `_ManualTokenEntryDialog` and `_PinDialog` as self-owning `StatefulWidget`s (controllers created/disposed in their own `State`); pop passes the token via `Navigator.pop(dialogContext, value)`; remove screen-state controller disposal (:396/:225); keep `!mounted` guards + optionally await `endOfFrame` before `_submitToken`. Screen-level submit result rendering unchanged. |
| 5 | **Label**: manual-entry button → `SUBMIT CHECK-IN TOKEN` (single site, :384). |
| 6 | **Offline verify**: keep fail-closed RN parity (never loosen unilaterally). Improve honesty + diagnostics: (a) split messages — **no/empty cached key** → `This class has no offline verification key on this device. Reconnect once and run Prepare for offline class.`; **present-but-failing signature** → exact `QR token signature is invalid`; (b) readiness gains `hasVerifiableKeys` (every today/tomorrow cached session carries a ≥32-byte decodable public key) so the chip says "Key missing — prepare online again" instead of READY; (c) cross-language fixture test: token signed by the shared TS signer with a fixed seed verified through `verifyToken` (and tampered → false) so the Dart/tweetnacl math is pinned forever; (d) offline-prep records `OfflinePrepFailure('teacher_key')` when keys are absent. |
| 7 | **Banner**: promote the `_BootLifecycle` offline flag to a small `offlineBannerProvider`; the scanner pads its header top by the strip height (`~34px`) whenever the banner is visible (other screens keep white-on-maroon overlap which is acceptable). |
| 8 | No new dependencies; no backend/shared/web edits; all Dart (hot restart). |

## 3. Milestones

| ID | Scope | Acceptance criteria |
|---|---|---|
| **SW-A — Admin console** | `admin_shell.dart` (NEW; CampusBottomNav + per-designation items + adminTabFor), `admin_routes.dart` ShellRoute wrap, `admin_common.dart` popup→overflow-only-when-bar-renders + popup hides bar-embedded items | Super admin: bar Dashboard/Users/Settings/Audit + popup shows Server-status/System-reports/Search; IT: 3-item bar matching its sections; registrar: no bar, popup only. Every `/admin/*` route shows the bar (deep links ride the shell). Designation matrix + routing tests green |
| **SW-B — Surface chrome** | Profile notifications-tab removal + `_normalizeTab` remap + bell push retarget; assistant back (implied + fallback) | Profile chips: Device/My reports/Privacy (student adds none-bell), no Notifications chip anywhere; bell → `/notifications` page w/ back; `?tab=notifications` lands on the center; assistant shows back from Profile (implied) and from deep link (fallback) |
| **SW-C — Scanner hardening** | `_ManualTokenEntryDialog` + `_PinDialog` extraction (self-disposing), `SUBMIT CHECK-IN TOKEN` label, endOfFrame deferral, banner padding fix | Tapping the label with a fake service turns the sheet into the outcome view with zero framework asserts (`takeException()` null) — the old path would trip the disposed-controller assert; offline banner no longer overlaps the header row |
| **SW-D — Offline honesty** | Message split (no-key vs bad-signature), `hasVerifiableKeys` in readiness + chip states (`READY` / `KEY MISSING — PREPARE ONLINE AGAIN`), `OfflinePrepFailure('teacher_key')`, TS→Dart fixture test (sign once with fixed seed; flip a byte → false) | Unit/widget tests: no-key offline scan shows the new reconnect message (not "signature invalid"); repaired-key scan queues normally; readiness false when keys missing; fixture vector passes through `verifyToken` |
| **SW-E — VER** | Whole-suite gates + emulator smoke script | `flutter analyze` 0; full suite ≥ current 663 + new tests; debug APK builds; smoke checklist: admin per designation (super/IT/registrar), profile bell→center back flow, assistant back ×2 paths, manual token online + offline (fresh prepare), PIN-protected offline scan, offline-banner overlap gone |

## 4. Two-agent ownership split (parallel-safe)

| Agent | Owns | Must NOT touch |
|---|---|---|
| **Agent A — Admin chrome** | NEW `features/admin/presentation/widgets/admin_shell.dart`, `core/router/routes/admin_routes.dart`, `features/admin/presentation/widgets/admin_common.dart` (overflow/popup trimming + adminTabFor helper), `core/polycheck_core.dart` (export), `test/router/admin_shell_test.dart` (NEW), `test/features/admin/admin_nav_test.dart` (NEW) | `features/surface/**`, `features/student/**`, `core/sync/*`, `main.dart`, `core/widgets/*` |
| **Agent B — Surface + scanner + offline** | `features/surface/presentation/profile_screen.dart`, `features/surface/data/surface_paths.dart`, `features/surface/presentation/notifications_panel.dart` (bell retarget), `features/surface/presentation/assistant_screen.dart`, `features/student/presentation/scan/student_scan_screen.dart` (dialogs + label + banner padding), `features/student/data/student_scan_service.dart` (message split), `core/sync/readiness.dart`, `features/student/data/offline_readiness.dart`, `lib/main.dart` (banner provider extraction), NEW `test/core/token_fixture_test.dart` (+ committed fixture string), tests `test/features/surface/**`, `test/features/student/student_scan_*` | `features/admin/**`, `core/router/routes/admin_routes.dart`, `core/widgets/campus_bottom_nav.dart` |
| Shared seams | W-A's `adminTabFor` may reuse `AdminAccess` helpers (already exported); W-B's `offlineBannerProvider` lives next to `main.dart` providers in `core/providers/` (tiny new file both can read; Agent B owns the file, Agent A unaffected) | — |

## 5. Testing strategy

| Layer | Coverage |
|---|---|
| Router/admin | designation × bar-content matrix; deep-link bar; registrar popup-only; `adminTabFor` mappings |
| Profile/assistant | chips snapshot (no Notifications), bell push retarget, `?tab=notifications` redirect+l, assistant implied vs fallback back |
| Scanner | extracted dialogs: submit through exit transition with zero asserts; invalid + no-key + PIN paths; label finder |
| Offline honesty | message split matrix (no-key vs tampered), readiness key check, TS→Dart fixture (tamper flip = false) |
| Banner | scanner header offset with provider set/unset |
| Regression guard | existing pinned fail-closed tests (`defense_test.dart:357-380`) keep passing (message split only) |

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Admin shell changes hit 7 screens' chrome | ShellRoute wrap only adds a bottom bar; AdminScaffold untouched per-screen; snapshot tests cover each admin route renders inside the bar |
| Removing the Notifications tab breaks old deep links | `_normalizeTab` redirect keeps `?tab=notifications` functional |
| Manual-token crash fix changes dialog UX (keyboard dismiss timing) | Dialog becomes self-contained; the visible behavior is identical besides no-crash; endOfFrame deferral keeps the result flowing |
| Owner may actually WANT key-less offline scans allowed | Explicitly rejected this wave (RN parity, anti-cheat first). If wanted, it's a 3-client policy change recorded in plan §7 debts — requires owner sign-off |
| Fixture test brittleness (fixed seed) | Committed fixture string generated once from the TS signer; a regen script note in the test header |

## 7. Out of scope / recorded

- Relaxing the offline fail-closed signature gate (needs RN + web + Flutter together; the owner's dashboard copy already tells "offline ready" — the chip upgrade is the honest fix instead).
- Push (FCM) registration; kiosk; faculty search scoping.
- The existing RTL fail-closed tests unchanged except adding the no-key message assertions.

## 8. Open questions (defaults if silent)

1. Admin bar tab set for super admin: Dashboard · Users · Settings · Audit (+popup for Server-status/System-reports/Search) — confirm or re-pick.
2. Button label choice: `SUBMIT CHECK-IN TOKEN` (default) vs `VERIFY TOKEN` vs `CHECK ATTENDANCE CODE`.
3. Do they also want the PIN dialog label aligned (`Verify & record` → e.g. `RECORD PIN-SIGNED CHECK-IN`)? Default: yes, same wave.

Say **go** and I'll dispatch Agents A/B in parallel (ownership split above), then the SW-E verification pass, all gates enforced.

## 9. Implementation Addendum (delivered)

| Milestone | Delivered |
|---|---|
| SW-A admin console | NEW `features/admin/presentation/widgets/admin_shell.dart`; all 7 `/admin/*` routes wrapped in one `ShellRoute`; bar = first ≤4 of `adminSectionsFor(user)` when ≥2 (super admin Dashboard·Users·Settings·Audit; IT Settings·Server·System reports; registrar no bar); AppBar popup becomes overflow-only (Server status/System reports/Search for super admin); `adminTabFor` highlight mapper (query/prefix aware); back fallback preserved. New admin nav/shell tests (25). |
| SW-B surface chrome | Profile Notifications tab removed (chips now Device/My reports/Privacy); `?tab=notifications` remaps to security + pushes `/notifications`; bell retargets to `push('/notifications')` (keeps back arrow). Assistant back: implied when poppable + `assistant-back-fallback` → role/console landing. |
| SW-C scanner crash | Dialogs extracted to self-owning `ManualTokenEntryDialog`/`MeetingPinDialog` (controllers created/disposed in their own State, popped via dialog context); red test proved the old failure (`TextEditingController was used after being disposed` + flews), green after fix; labels now `SUBMIT CHECK-IN TOKEN` / `SUBMIT PIN-SIGNED CHECK-IN`; one-frame teardown deferral. |
| SW-D offline honesty | Offline reject split: missing cached teacher key → "This class has no offline verification key on this device. Reconnect once and run Prepare for offline class."; wrong signature keeps `QR token signature is invalid`; fail-closed policy untouched (RN parity). Readiness gains `hasVerifiableKeys` (32-byte b64url check) + `KEY MISSING — PREPARE ONLINE AGAIN` chip state; prep records `teacher_key` failure. Cross-language fixture test pins TS(tweetnacl)→Dart verify. |
| SW-7 banner | `offlineBannerProvider` extracted from `main.dart`; scanner header pads the 34px strip when visible. |

**Verification:** `flutter analyze` 0 · **710/710 tests** · fresh debug APK built · `android/` untouched. Device smoke checklist remains for the phone install (admin per designation, profile bell→center, assistant back ×2 paths, manual token online/offline, PIN offline scan, banner overlap).
