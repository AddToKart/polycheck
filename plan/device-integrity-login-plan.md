# Device-Integrity Login Gate — active-session block + same-device cooldown exemption

> **Status:** Implemented — LI1–LI3 + LI5-web + VER code gates landed (web-only UX
> by explicit request; Android LI4 deferred). The gates are enforced backend-first
> on both login channels, so the deferred mobile UX cannot bypass them.

---

## 1. Goal (the requested behavior)

Students must never be able to "move" an active student login to a second device:

1. **Active-session gate.** Signing in from any device while the account has a live
   session on a *different* device is **rejected** with "an active session is
   currently going on" — the active device is never kicked.
2. **Logout-armed cooldown.** After the student **logs out** (any platform), signing
   back in from a **different device** shows an **exactly-remaining countdown
   (default 2 hours, `device_cooldown_hours`)** before that device may log in.
3. **Same-device pass-through.** Re-login on the *same* device (phone that logged
   out, or the same browser) is instant — no cooldown, no block.
4. Teachers keep the instant **Emergency Device Release** (audited) that clears the
   cooldown and unbinds so a student can log in on any device at once.

All three gates are **students only**; staff keep concurrent devices (unchanged
behavior). Enforcement is server-side on every login route (web cookie and mobile
bearer alike) plus a client countdown UX on both platforms.

## 2. Verified Current State (facts from the research pass)

| # | Fact | Evidence |
|---|---|---|
| 1 | Student logins **unconditionally replace** the active session: `authVersion` is bumped and sibling sessions deleted via the login hooks; the active device is silently kicked. Nothing checks whether an active session exists or where it is held. | `backend/src/auth/session-policy.ts:24-46` (`resolveSessionGeneration` bumps for any student login; `resolveSessionCreateAfter` → `delete-others`); runtime in `backend/src/auth/better-auth.service.ts` (session `create` hooks) |
| 2 | The only pre-login gate is the **cooldown** check, and it runs **for the mobile channel only** — the web login route skips every device gate. | `backend/src/auth/auth.service.ts:158-160` (`if (mobile?.channel === 'mobile') await assertMobileLoginAllowed`) — `/auth/login/student` passes no `mobile` |
| 3 | The cooldown is **device-agnostic**: *every* login (including the device that just unregistered) is rejected while armed — the same-device exemption does not exist. | `backend/src/users/device-binding.service.ts:49-56,160-175` (`assertMobileLoginAllowed` → `assertCooldownInactive`) |
| 4 | The cooldown is armed **only** by self-service unregister. **Logout does not arm it** — logging out and immediately logging in on another device today is instant. | `device-binding.service.ts:98-137` (`unregisterStudentDevice` is the only arming path); logout is cookie-clearing only `backend/src/auth/auth.controller.ts:107-109` |
| 5 | The active-session gate cannot work yet because sessions do not record which device holds them — only `User.boundDeviceId` exists, and web logins never attach any device identity. | Prisma `authSession` model (no device column); web `loginStudent(studentId, password)` sends no deviceId `frontend/src/lib/api-client.ts:458`; `getOrCreateWebInstallationId` exists but is only used by the scan modal `frontend/src/lib/device-id.ts`, `components/ScanQrModal.tsx:236` |
| 6 | Mobile logins already send their SecureStore installation id. | `android/services/api-client.ts:574-614` (`getOrCreateInstallationId()` → body `deviceId` on `/auth/mobile/login/*`) |
| 7 | The web login DTO already accepts an optional (currently unused) `deviceId` field. | `backend/src/auth/dto/login-student.dto.ts:20-21` |
| 8 | Typed error plumbing exists end-to-end: 403 body `{ code, remainingMinutes }` (fwd by `AllExceptionsFilter`), web `ApiHttpError.remainingMinutes`, Android typed `device_cooldown_active` branch + branded modal. | `backend/src/common/constants/error-codes.ts` (`DEVICE_COOLDOWN_ACTIVE`), `frontend/src/lib/api-client.ts:137,260-262,294-303`, `android/services/api-client.ts:406-448` |
| 9 | The countdown UX pattern needed for a ticking timer already exists elsewhere (maintenance countdown reads the `/health` clock offset). | `frontend/src/components/maintenance/` ; shared `getServerClockOffset` in the offline store |
| 10 | Teacher Emergency Device Release clears the binding + revokes sessions today. | `backend/src/users/users.service.ts` (teacher release), `StudentGovernanceActions` UI |

## 3. Locked Decisions

| # | Decision |
|---|---|
| 1 | **One backend gate, all channels.** `DeviceBindingService.assertLoginAllowed(account, deviceId)` replaces today's mobile-only cooldown check and runs for **both** `/auth/login/student` and `/auth/mobile/login/student`. Gate order after credentials + maintenance + active-status: (1) cooldown, (2) active-session. Staff bypass every device gate (unchanged). |
| 2 | **Sessions learn their device.** The Better Auth `session` row gains a nullable `deviceId` column, stamped post-create for student logins from both clients. A session with a **null/unknown device never blocks another device** (grandfathering; legacy rows can't lock students out). The gate compares on this column, not `boundDeviceId`. |
| 3 | **Gate 1 — active session elsewhere (new code `active_session_elsewhere`, 403).** If any valid (non-expired, generation-current) student session exists with `deviceId ≠ attempt.deviceId` (and not null), the login is **rejected**; payload carries `remainingSeconds`-style metadata not needed here but a human hint + `activeDeviceKind` (`'mobile' \| 'web' \| null`) and `activeSessionLastActiveAt`. The **old device keeps its session** — no `authVersion` bump, no sibling deletion on rejected logins. A login from the *same* device always passes this gate (multi-tab is same device). An attempt carrying a **null deviceId** with an active session present is also rejected (fail-closed; message covers "update the app / clear site data"). |
| 4 | **Gate 2 — cooldown becomes device-aware.** New column `User.cooldownDeviceId` = the device that logged out (exempt). While `deviceCooldownUntil` is active: a login from `cooldownDeviceId` **passes**; any other (or unknown) device gets today's `device_cooldown_active` 403 **now with `remainingSeconds`** for the ticking timer. | 
| 5 | **Logout arms the cooldown.** `/auth/logout` gains an optional `deviceId` body (both clients send it). For **students**, the logout path (transactionally with the session revocation) arms `deviceCooldownUntil = max(existing, now + device_cooldown_hours)` and stamps `cooldownDeviceId = deviceId`; fail-open audit `student.device_cooldown_armed`. **Staff logouts never arm.** Server-side revocations (password reset, disable, rotation) keep killing sessions but **never arm** a cooldown. |
| 6 | **Login no longer replaces.** Students stop bumping `authVersion` at login; login-time `delete-others` and the student `new_login` broadcast are removed (nothing is replaced by a *successful* login — gate 3 decided that). On successful student login, the after-hook **purges stale same-device duplicate sessions** (`purge-same-device`) so re-login doesn't litter rows. Security revocation flows (which bump `authVersion`) are untouched. |
| 7 | **Emergency Device Release widens.** Teacher release clears `boundDeviceId`, `deviceCooldownUntil` **and `cooldownDeviceId`** in the same transaction (it already revokes sessions + audits); teacher UI shows the cooldown remaining + which device is exempt so release vs. wait is an informed click. |
| 8 | **Self-service unregister keeps arming** (today's behavior) and additionally stamps `cooldownDeviceId` with the unregistering device so the student can immediately re-register the same device — matching the flow's intent. |
| 9 | **Countdown UX on both platforms**, driven by `remainingSeconds` + the trusted `/health` clock offset (never the raw device clock): web login page shows a full-width locked panel with a live mm:ss (or h:mm:ss) countdown and a "Try again" action that re-submits with the same deviceId (instant success once the timer ends or the device is exempt); Android reuses the existing branded `device_cooldown_active` modal and adds the ticking timer. `active_session_elsewhere` renders as an explainer (no timer): "Your account is currently signed in on another device. Log out from that device first, or ask your instructor for an emergency device release." |
| 10 | **Web device id** = the existing `getOrCreateWebInstallationId()` (`web-…`), now attached to both login and logout. Clearing browser storage is treated as a new device (it triggers the gates) — acceptable anti-cheat friction for v1; document it. Normal cookie expiry **without** explicit logout does not arm a cooldown (no false punishment), but an active-session-on-record still blocks other devices until it expires server-side. |
| 11 | No new dependencies, tokens, or hex; reuses maintenance-countdown and cooldown-modal primitives. |

## 4. Milestones

| ID | Scope | Acceptance criteria |
|---|---|---|
| **LI1 — Shared contract + DB** | `ErrorCode += active_session_elsewhere`; error payloads gain `remainingSeconds` (cooldowns, both codes) and `activeDeviceKind`/`activeSessionLastActiveAt` (link code); migration `20261111120000_login_device_integrity`: `Session.deviceId String?` (+ student lookup index) and `User.cooldownDeviceId String?` (additive, nullable, no backfill); shared helpers `formatCooldownCountdown(totalSeconds)` (mm:ss / h:mm:ss) | prisma validate + generate; zod/type updates compiled; helper unit tests (h:mm:ss / mm:ss / 0s) |
| **LI2 — Backend gate + policy** | `DeviceBindingService.assertLoginAllowed(accountId, deviceId \| null)` implementing Decisions 1, 3, 4 (+ fail-closed null-device branch); Better Auth hooks stamp `deviceId` on the new session and run `resolveSessionCreateAfter` extended with `purge-same-device`; `session-policy.ts` drops the login-time bump/sibling-deletion/broadcast for students (spec updated); logout arming on `/auth/logout` (Decision 5) + `registerBinding` unchanged for allowed logins; release/unregister widen `cooldownDeviceId`; `AllExceptionsFilter` forwards the new fields | Full gate matrix tested: (active elsewhere → 403 link, old session intact + untouched `authVersion`), (same device → pass + same-device purges), (no session → pass), (cooldown armed + other device → 403 with `remainingSeconds`), (armed + exempt device → pass), (armed + null device → 403), (staff unaffected everywhere), (logout arms, staff logout no-op, server revocation never arms), (teacher release clears all three fields). No student `new_login` broadcast emitted |
| **LI3 — Web client** | `loginStudent`/`logout` attach `getOrCreateWebInstallationId()`; ApiHttpError parses `remainingSeconds`/`activeDeviceKind`/`activeSessionLastActiveAt`; login page renders the two gated states (locked + ticking countdown with clock-offset sync and auto-retry on expiry; signed-in-elsewhere explainer; both with the instructor-release hint); SessionGuard untouched | Web tests: payload asserts (deviceId on login + logout), countdown tick/wrap/expiry behavior, offset-drift handling, both panels' copy/CTAs; existing auth e2e suite still green |
| **LI4 — Android client** | The existing `device_cooldown_active` branch gains the ticking countdown (remainingSeconds + health offset) and a retry action; new `active_session_elsewhere` branch renders the explainer state; logout attaches the installation id; sign-out funnel (`confirmSignOut`) unchanged | Android tests: typed error mapping, countdown arithmetic, logout payload; typecheck + suites green |
| **LI5 — Teacher visibility** | Student detail (web + Android) shows the cooldown countdown + exempt device and the release button clears all three fields (Decision 7); release already audited | teacher release e2e: gated → released → student logs in instantly |
| **VER — Gates & docs** | Monorepo typecheck/lint/format/tests/build; full Chromium e2e incl. new `e2e/device-integrity.spec.ts` journey (two student browsers leg A → gate B → logout A → countdown on B → instant login back on A → release → instant login on B); AGENTS.md device-binding section rewritten to the new state machine; plan addendum | counters recorded in AGENTS.md; live container smoke of the journey; deviations documented |

## 5. E2E journey definition (LI5/VER)

1. Fresh student **N** logs in on browser **A** → dashboard renders.
2. Browser **B** attempts login with N → sees the **active-session** explainer; **A** is unaffected (still signed in, still callable — a protected page refresh works).
3. **A** logs out (its deviceId arms the cooldown exempting **A**).
4. **B** attempts login → **2-hour countdown** screen (timer ticks down; remainingSeconds monotonic).
5. **B** counter-test: browser **A** re-logins immediately → success (no cooldown).
6. Faculty opens N's record → sees cooldown + exempt device → **Emergency Device Release** → **B** logs in instantly.
7. Android leg mirrors 1–5 with the app + web client pair (mobile actives, web attempt → explainer; logout → countdown on web; same-phone retry instant).

## 6. Testing Strategy

| Layer | Approach |
|---|---|
| Backend (jest) | exhaustive gate matrix; session-stamp + purge behaviors; logout arming (student/staff/unauthenticated); release/unregister widenings; no-broadcast assertions; `remainingSeconds` forwarding through the exceptions filter |
| Web (vitest + RTL) | device id payload, countdown component (tick, ceil, offset drift), gate panels, `ApiHttpError` parsing |
| Android (jest) | error mapping, countdown, logout payload |
| E2E (Playwright, 2 browsers) | §5 journey in container; regression: pre-existing device-cooldown/unregister flows still pass |

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Students locked out by the new web gate during rollout (web previously exempt) | Backward-compatible release order in §9; fail-closed messaging includes the instructor-release path; rollout flag not needed since both gates make the *same device* pass instantly |
| Web device id is trivially spoof/cleareable (localStorage) | Accepted for v1 and documented; the active-session gate cannot be evaded this way (server-side state), only the wait timer; fingerprint-based binding remains the v2 roadmap item |
| Unknown-device rows (pre-migration) block or fail to block unexpectedly | Null session device never blocks (Decision 2); null attempt device only loses when an active session or armed cooldown exists (fail-closed, human-readable message) |
| Multi-tab/student double tab cookies create duplicate sessions | after-hook same-device purge keeps at most the latest session per device |
| Legit pair (student's phone + personal laptop) now impossible | This is the requester's explicit policy decision (anti-cheat); the release path is the escape hatch, and staff accounts are unaffected |
| Minute precision too coarse for the timer | Ship `remainingSeconds`; keep `remainingMinutes` for backward compatibility |
| Logout arming punishes benign app refresh/logout cycles | arming is max(extend) with same-device exemption; same device returns instantly, so the common case is unaffected |
| Better Auth adapter ignoring the new session column | stamp via the post-create hook path we already own (same place `purge-same-device` runs); verified in LI2 tests |

## 8. Out of Scope (this wave)

- Cryptographic device binding / attestation (v2 roadmap).
- Device binding for staff accounts.
- Password-reset-generated cooldown changes beyond today's revocation behavior.
- Offline co-op (the mobile app already works offline; gates only bind online logins).

## 9. Sequence & compat

Backend gate + schema first (LI1→LI2), then both clients (LI3/LI4) in the same wave so the web never ships the fail-closed null-device branch without a deviceId attached. The pre-change behavior (login replaces siblings) disappears in the same change that adds the gate — there is no window where students are gated but unable to send a device id. Teachers' release semantics stay strictly a superset of today's.

## 10. Open Questions (defaults if silent)

1. Exact copy tone for the two gate explainer screens — default: direct Filipino-English neutral, name the instructor-release action explicitly.
2. Should the countdown screen auto-submit when it reaches zero, or wait for "Try again"? (Default: wait — one explicit user action.)
3. Does logging out require any minimum session age before arming (prevents classroom double-tap accidents)? (Default: arm always; same-device exemption makes accidents harmless.)
4. Should `active_session_elsewhere` also expose which kind of device holds the session (e.g., "your phone")? (Default: yes via `activeDeviceKind`, generic fallback when unknown.)

Say "go" and I'll implement LI1 → VER in order with the full verification gates.

## 11. Implementation Addendum (delivered)

| Layer | Delivered |
|---|---|
| **Shared (LI1)** | `shared/src/types/device-integrity.ts` (`ActiveDeviceKind`, `DeviceIntegrityErrorPayload` with `remainingMinutes`/`remainingSeconds`/`activeDeviceKind`/`activeSessionLastActiveAt`), `formatCooldownCountdown` (`shared/src/utils/device-integrity.ts`), `User.cooldownDeviceId`, `EmergencyDeviceReleaseResult.hadBinding`; the new types/utils are exported from the shared package root. |
| **Backend (LI2/LI5)** | `DeviceBindingService.assertLoginAllowed` runs on both `/auth/login/student` (web, optional `deviceId`) and `/auth/mobile/login/*`; active valid session on another device → `403 active_session_elsewhere` with `activeDeviceKind` + `activeSessionLastActiveAt`, active device untouched; same-device login passes and purges that device's older rows (`stampLoginSession` + `purge-same-device`); legacy null-device sessions never block, while an unidentified attempt with any active session fails closed. Device-aware cooldown: only `cooldownDeviceId` passes, others get `remainingMinutes` + `remainingSeconds`. `POST /auth/logout` takes `{ deviceId?, armDeviceCooldown? }`, revokes first then arms for students only when `armDeviceCooldown !== false` and a non-empty device id exists (audited `student.device_cooldown_armed` with client IP). Student logins no longer bump `authVersion`, delete siblings, or emit `auth:session-replaced`; security revocations still do. Teacher Emergency Device Release clears `boundDeviceId`/`deviceBoundAt`/`deviceCooldownUntil`/`cooldownDeviceId`, always revokes sessions, and returns `hadBinding`/`hadCooldown`. Per-account Redis lease `student-login:<userId>` (TTL 15s, 10 bounded acquisition attempts, 409 on contention, fail-open when Redis is unreachable) serializes the gate + session-create pair. Migration `20261111120000_login_device_integrity`: nullable `AuthSession.deviceId` + `(userId, deviceId)` index, nullable `User.cooldownDeviceId` (idempotent, no backfill). |
| **Web (LI3/LI5-web)** | `loginStudent` sends the existing `web-…` installation id; `logout({ armDeviceCooldown })` arms by default and programmatic terminations (`AuthSessionMonitor`, post-unregister) pass `false`; `ApiHttpError` parses the new fields. Student login page renders `StudentLoginDeviceGate`: ticking cooldown from the trusted `/health` clock offset (`useTrustedNow` + `formatCooldownCountdown`, retry) and the active-session explainer. Teacher student detail shows bound/exempt/cooldown chips and what the release cleared. |
| **E2E (VER)** | `installSessionCleanup()` added to every spec (module-level `afterEach` only attaches to the first spec per worker because Playwright caches modules); `apiLogout` defaults to non-arming; new `e2e/device-integrity.spec.ts` journey (A active → B rejected → A logout → B countdown → A instant → faculty release → B instant); `auth.spec.ts` second-device test now asserts rejection while the first stays signed in; student→faculty switch specs use non-arming logouts. |
| **Verification** | Shared **202 / 18 files**, backend **1034 / 82 suites** (+ real-DB integration e2e **7** passing with all **26** migrations), web **455 / 66 files**, Android untouched/byte-identical to HEAD (**661 / 36 suites** still pass; typecheck clean), `pnpm build` 3/3. Playwright was **not executed** (no Docker stack available) — validation was list-level only. |

### Deviations

- **Android UX parity deferred (LI4)** by explicit instruction ("don't touch the mobile for now"). Mobile login is still server-gated (it already sends its `mobile-…` installation id), but the app shows only the generic error for `active_session_elsewhere` and has no ticking countdown/explainer. Mobile logout sends no device id, so it never arms a cooldown.
- **Feature Parity Gate justification:** the UX was requested web-only; the security gates are backend-first and apply to both clients. Android UX + logout arming are the recorded parity follow-ups.
- **Residual races (accepted for v1):** Redis-down fail-open allows simultaneous cross-device logins (availability trade-off); the 15s lease has no fencing token, so a login that outlives its lease is not fenced; a login can slip between sign-out and cooldown arming (narrow inverse window).
- **`activeSessionLastActiveAt` is informational only:** it derives from `AuthSession.updatedAt`, which Better Auth refreshes lazily (`updateAge`, 24h).
- **Device-release rate limit:** teacher release is 10/hour/teacher, so 3-engine CI runs with retries may need `TEACHER_DEVICE_RELEASE_RATE_LIMIT` raised.

### Follow-ups

1. Run `e2e/device-integrity.spec.ts` (and the full Playwright suite) against the rebuilt Docker stack — local execution was blocked by the missing daemon.
2. **LI4 Android:** typed `active_session_elsewhere` explainer, ticking `device_cooldown_active` countdown (trusted `/health` offset), and logout with the installation id.
3. Consider a PostgreSQL advisory-lock (or equivalent fencing token) for the gate + session-create pair to remove the lease-expiry race.
4. Raise `TEACHER_DEVICE_RELEASE_RATE_LIMIT` in CI (or reset cooldown state between engines) for multi-engine runs/retries.
