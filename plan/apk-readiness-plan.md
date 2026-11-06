# APK Readiness & Build-Pipeline Proofing Plan

**Goal:** ship a styled, contract-synced APK on EAS again, then make this entire failure class impossible to reintroduce silently.

**Status:** Executed on 2026-11-07. APK0/APK1 landed first; APK2–APK7 and APK9–APK10 (local matrix) are implemented, verified, and committed (`6a56c02`, `f9bcd4a`, `800241e`). Remaining: EAS preview rebuild and device smoke (credentials/device required). See "Execution record" at the end.

**Root cause of the broken APK (proven):** root `.gitignore` pattern `metro.config.js` (bare, matches every depth) excludes `android/metro.config.js`, which contains the entire NativeWind v5 wiring (`withNativeWind` → `react-native-css` custom Metro transformer + resolver). EAS builds from Git therefore ship a bundle with zero compiled CSS and no `className` interop. Inline `StyleSheet` styles still work, which is why the app "runs". Local emulator works because the local untracked file exists.

---

## Context — working tree state (pre-existing, from 2026-11-05 deepcheck)

These are already implemented but **uncommitted**; they fold into APK1's commit train:

| File | Change |
|---|---|
| `patches/metro@0.84.4.patch` + `pnpm-workspace.yaml` + `pnpm-lock.yaml` | Metro image-size v2 fix (bundling crash blocker) — later superseded and removed after the Expo 57.0.32 / Metro 0.84.5 alignment (APK3) |
| `scripts/build-shared-if-available.mjs` + root `package.json` | guarded `postinstall` building `@polycheck/shared` on fresh installs |
| `android/package.json` | `eas-build-post-install` hook building shared on EAS |
| `android/services/api-client.ts` + `android/__tests__/api-client-bindings.test.ts` | signing-key auto-recovery port (parity with web `ddeda57`) |
| `android/android/*` | regenerated native project (gitignored — no action needed, EAS prebuilds fresh) |

User-owned, not part of this train (commit or discard separately): `documentation/audit.md` (modified), `plan/repo-remediation-plan.md` (untracked).

**Discovered late (changes priorities):** `pnpm --dir android exec expo install --check` currently **exits 1** — the `verify` job's existing step in `ci.yml` is red/right-now-broken. APK4 is not hygiene, it un-breaks CI.

---

## Task list

### APK0 — Commit train: land the deepcheck fixes (BLOCKING, first)
**Files:** `patches/`, `scripts/build-shared-if-available.mjs`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package.json`, `android/package.json`, `android/services/api-client.ts`, `android/__tests__/api-client-bindings.test.ts`

Conventional commits, imperative, ≤72 chars:

1. `fix(build): patch metro for image-size v2 and auto-build shared on install` — patch, workspace yaml, lockfile, root package.json, script.
2. `fix(android): auto-recover teacher signing key on invalid signature` — android api-client + tests.

**Done when:** both commits clean; `git status` shows only user-owned docs + APK1 leftovers; full verification matrix (APK10) re-run.

---

### APK1 — Track the NativeWind Metro config (THE root-cause fix)
**Files:** root `.gitignore` (line 58), `android/metro.config.js`.

1. Anchor the meta-pattern so it only ignores Expo's root-level generated config:
   Change the root pattern from `metro.config.js` to `/metro.config.js` (line 58), leaving nested project configs tracked. Verify with `git check-ignore -v android/metro.config.js` returning nothing.
2. `git add android/metro.config.js` — commit:
   `fix(build): track nativewind metro config excluded by gitignore` (body: one-line root cause).
3. Sanity: `git status --porcelain android` must be empty.

**Guardrail:** the bare `metro.config.js` pattern was meant for Expo's *root* generated config; `/metro.config.js` preserves that while un-ignoring nested project configs. Any future nested `metro.config.js` is now intentionally committed — that is correct for this monorepo.

**Done when:** a fresh `git clone` + `git checkout HEAD` contains `android/metro.config.js` with `withNativeWind`, and `git check-ignore` does not list it.

---

### APK2 — Make "styles are in the bundle" a machine-checkable gate
**Files:** `scripts/verify-android-bundle-styles.mjs` (new), `scripts/verify-tracked-build-files.mjs` (new), `.github/workflows/ci.yml`.

Two cheap-to-expensive checks, both fail loudly in CI:

1. **Tracked-files gate (instant, run first in `verify` via existing steps):** assert these are (a) present, (b) committed at `HEAD`, (c) not gitignored: `android/metro.config.js`, `android/babel.config.js`, `android/global.css`, `android/postcss.config.mjs`, `android/app.json`, `android/eas.json`, `scripts/build-shared-if-available.mjs`, `pnpm-workspace.yaml`. Implementation: `node scripts/verify-tracked-build-files.mjs` (`git cat-file -e HEAD:<path>` + `git check-ignore --quiet --no-index` + `fs.existsSync`).
2. **Styled-bundle fingerprint gate:** `node --dir android exec node ../scripts/verify-android-bundle-styles.mjs` — runs `pnpm exec expo export --platform android --output-dir <tmp> --clear`, then greps the produced `*.hbc` for the fingerprints that distinguish a wired bundle:
   - `twsa-safe-area` (nativewind theme safe-area vars — always emitted by a compiled stylesheet)
   - `color-red-50` (tailwind theme palette var, only present after postcss+compile)
   - `color-zinc-700`
   All three must be ≥1 occurrence. Verified empirically: styled prod hbc has them; config-less hbc has exactly 0 of each; a JSON-data-shaped check on `"s":[[`/`vr` payloads is intentionally NOT used (string-laying in hbc makes it fragile).
3. Wire both into `verify` after the android test step (~+2–4 min CI; acceptable — it currently ships unstyled APKs silently otherwise).
4. Update `android/RELEASE.md` pre-upload checklist: after every EAS build, extract the APK (`Expand-Archive` or unzip) and `rg -a -c "twsa-safe-area" assets/` (the Hermes bundle embeds as `assets/index.android.bundle`); require ≥1 before device install.

**Done when:** CI runs both checks green; deliberately removing `withNativeWind` from metro.config.js in a scratch commit makes the export gate fail (verified once, then reverted).

---

### APK3 — Align Expo-mobile versions (un-breaks CI's `expo install --check`)
**Files:** `android/package.json`, `pnpm-lock.yaml`, possibly `pnpm-workspace.yaml` (`minimumReleaseAgeExclude`).

- `expo-doctor` reports 20 patch-level drifts: `expo ~57.0.32`, `react-native 0.86.3`, `expo-router ~57.0.30`, etc.
- `expo install --check` exits 1 today → CI gate red. Align:
  1. `pnpm --dir android exec expo install --fix`
  2. If pnpm's supply-chain policy (minimumReleaseAge) refuses a version, either pin to the newest allowed release or add a justified entry to `minimumReleaseAgeExclude` — never drop the policy.
  3. `pnpm install`, then re-run the full verification set: shared build/tests, `pnpm --dir android typecheck`, `pnpm --dir android test`, `pnpm --dir frontend lint/typecheck/test/build` (react-native 0.86.3 + expo-router ~57.0.30 can move web-adjacent shared types), Metro export, APK2 gate.
  4. `pnpm --dir android exec expo-doctor` → expect 21/21 checks.

**Risk:** expo-router/native patch bumps occasionally change edge behavior; the existing 654+ android tests and export gate are the safety net. Do NOT cross SDK majors here.

**Done when:** `expo install --check` exits 0, doctor 21/21, all suites green, no behavior drift in manual smoke.

---

### APK4 — Security advisories (currently failing `pnpm security:audit` gate)
**Files:** `frontend/package.json`, root `pnpm-workspace.yaml` (overrides / `auditConfig.ignoreGhsas`), possibly `backend/package.json`.

Known from the audit snapshot (2026-11-05):

| Package | Advisor | Fix |
|---|---|---|
| `next@16.4.0` (frontend + better-auth>next) | critical RCE in image optimization `GHSA-2464-fhr4-w9xw` | bump to ≥16.4.1 patch |
| `@sentry/nextjs@10.69.0` | **critical** middleware bypass `GHSA-mchm-gjx6-7h55` | ≥10.75.2 |
| `linkify-it` ≤5.0.1 + `markdown-it` <14.3.2 via `react-native-markdown-display` | high ReDoS-class | decide: workspace override vs documented ignore |
| `vite` 7.3.6 (backend better-auth>vitest chain) | high `GHSA-587h-7wmj-h5pm` (launch-editor bypass, Windows, dev-only) | global override `vite@7.3.7` if resolvable; else ignore w/ justification |

1. Bump `next` patch + `@sentry/nextjs` in frontend directly; `pnpm install`; run E2E smoke (auth + one dashboard journey) since Sentry touches middleware.
2. `markdown-it`/`linkify-it`: attempt overrides (`markdown-it: >=14.3.2`, `linkify-it: >=5.0.2`); run android jest + the assistant UI suites. `react-native-markdown-display` declares `markdown-it@^10` as peer — if markdown-it 14 breaks it (API drift), revert override and record a justified entry in `auditConfig.ignoreGhsas`; the attack surface is admin-configured assistant content rendered on-device (low severity), document rationale inline.
3. Precedent exists: `auditConfig` already ignores two build-tool advisories.
4. `pnpm security:audit` must pass; `pnpm audit --prod --json` re-run and record the delta in `documentation/audit.md` if it changes materially.

**Done when:** `pnpm security:audit` green, and every remaining advisory is either fixed or explicitly ignored with a written reason.

---

### APK5 — EAS preview environment (the "for testing" APK config)
**Files:** `android/eas.json`, `android/RELEASE.md`.

- Real profile is APK (`buildType: apk`) but has **no `env`** — and `services/api-config.ts` throws at startup when `EXPO_PUBLIC_API_URL` is missing in non-dev builds. First preview build will crash on launch unless the env exists.
- Decide and set on the preview profile:
  - `EXPO_PUBLIC_API_URL` — LAN IP of the dev machine (`http://192.168.x.x:4000/api`) or the staging API URL; physical-device testing needs the LAN form (emulator-only `10.0.2.2` will black-hole on a phone).
  - Optionally `EXPO_PUBLIC_ALLOW_QR_FALLBACKS: "true"` **only if** the QA plan needs image/manual token entry; production profile stays pinned `false` (do not propagate).
- Keep `EXPO_PUBLIC_E2E_MODE` and `EXPO_PUBLIC_ENABLE_OUTAGE_SIMULATOR` absent from preview (hardened defaults).
- Document in RELEASE.md: which profile is for which test, and the env requirement table already there gains a preview row.

**Done when:** a preview build boots to login on a physical device with the intended backend, and simulator/emulator behavior unchanged.

---

### APK6 — Frontend lint zero-warning cleanup
**Files:** `frontend/src/app/faculty/attendance/page.tsx`, `frontend/src/app/faculty/reports/page.tsx`, `frontend/src/app/faculty/sections/[id]/page.tsx`, `frontend/src/app/faculty/subjects/page.tsx`.

7 warnings, 0 errors; all stale from the pagination wave:
- unused `PaginationBar` imports ×3,
- unused `setPage`/`setSessionPage` state ×2,
- two `react-hooks/exhaustive-deps` "logical expression" warnings — wrap `summaries`/`filteredSummaries` initializers in their own `useMemo` (matches the lint hint, no behavior change).

**Done when:** `pnpm --dir frontend lint` prints 0 problems; `pnpm --dir frontend test` and build stay green.

---

### APK7 — Android Jest teardown leak
**Files:** android tests under `__tests__/` as determined.

Symptom: "A worker process has failed to exit gracefully" + open handles warning after some suites (seen after `scanner-focus-lifecycle`/timers-heavy suites).

1. Run `pnpm --dir android test -- --detectOpenHandles` to isolate offenders.
2. Prefer real fixes: `unref()` outstanding timers, cancel pending `Location.watchPositionAsync`/camera subscribers in test teardown.
3. If unavoidable (library-native handle), document and cap with `--forceExit` scoped to that suite rather than global.

**Done when:** full android suite exits clean without the warning, or the exception is documented inline.

---

### APK8 — Local Windows build enablement (OPTIONAL — EAS route doesn't need it)
**Files:** root or android `.npmrc` (if pursued), docs.

Local `gradlew :app:assembleDebug` fails in `react-native-worklets` CMake: `CMAKE_OBJECT_PATH_MAX` warnings (deep `.pnpm` hash dirs >250 chars) → `ninja: manifest 'build.ninja' still dirty`. Not app code.

Options in order of preference:
1. `node-linker=hoisted` in android-scoped `.npmrc` + clean reinstall (standard RN+pnpm remedy; flattens paths). Tradeoff: loses strict dependency isolation in that install — verify bundle + tests after switching; EAS unaffected (it re-installs server-side with the same config).
2. Clone/build from a short path (e.g. `C:\dev\polycheck`) — zero repo changes, per-machine action.
3. Pin local Node to 22 via nvm (CI parity) — good hygiene regardless; not the root cause of this failure.

**Done when:** either local assembleDebug succeeds, or the team formally records "APK builds are EAS-only" in RELEASE.md and removes the local build hint from the docs.

---

### APK9 — Docs: write the failure class into the project knowledge base
**Files:** `AGENTS.md`, `android/RELEASE.md`.

- `AGENTS.md` — Progress entry: unstyled-APK root cause + fix; Metro patch; shared postinstall; signing-key recovery; version alignment; styled-bundle gate.
- `AGENTS.md` — Critical Context additions worth keeping forever:
  - NativeWind v5 stacks on `react-native-css` + Expo CSS; **no babel plugin needed** (`@source` directives scan).
  - `android/metro.config.js` is load-bearing (transformer + resolver) and must stay **tracked**.
  - Styled-bundle fingerprint: `twsa-safe-area` present in hbc ⇔ stylesheet compiled.
- `RELEASE.md` — pre-upload checklist addition (APK2 step 4) + preview-profile env row (APK5).

**Done when:** AGENTS.md Progress/Context reflect reality; no doc contradicts eas.json.

---

### APK10 — Full verification matrix + rebuild (the actual ship gate)

Order matters — version alignment (APK3) before the rebuild so the APK isn't stale again:

1. After APK1: run the complete green set on the current stack —
   shared build+tests (176), `pnpm --dir android typecheck` + `pnpm --dir android test` (656), `pnpm --dir frontend lint/typecheck/test/build`, Metro `expo export` styled-fingerprints ✓, `pnpm security:audit` after APK4.
2. E2E layer when servers are up: web Playwright suite (Chromium minimum; the auth/hardening specs are the flakiest-relevant ones), Maestro `pnpm --dir android e2e` when a device/emulator is attached.
3. Push commit train → **EAS `preview` APK** → fingerprint-check the artifact (RELEASE.md step) → install on device.
4. Device smoke (release build, no Expo Go):
   - Dashboard styled (stat grid, gold accents, dark-mode surfaces render via tokens)
   - Scan → check-in → realtime update visible
   - Offline airplane scan → reconnect → sync receipt
   - Teacher QR: revoke server signing key → generate session → auto re-provision succeeds (the ported recovery)
   - Notification permission prompt on Android 13+ (prebuild fix now ships `POST_NOTIFICATIONS`)
5. Only then decide store readiness (production profile, `autoIncrement` versionCode) — separate decision, out of this plan.

**Done when:** the device smoke list above passes on the EAS-built APK.

---

## Sequencing

```
APK0 ─┬─► APK1 ─┬─► APK2 ─┬─► APK3 ─► APK4 ─► APK9 ─► APK10 (rebuild + device)
      └─────────┴─► APK5 ─┤
                          ├─► APK6 (parallel, any time)
                          ├─► APK7 (parallel, any time)
                          └─► APK8 (optional, parallel)
```

APK0 → APK1 are one sitting (~30 min). APK2–APK4 are the substantive half-day. APK10 re-runs everything and ends with an EAS rebuild.

## Explicit non-goals
- No SDK major bumps, no NativeWind/Tailwind upgrades, no backend feature changes.
- ~~No removal of `image-size` override or the Metro patch~~ — superseded: Metro 0.84.5 has its own image parser, so both were removed during APK3. The styled-bundle gate proves the replacement path.
- No behavioral UI redesign — everything here restores the already-designed UI.
- User-owned docs (`documentation/audit.md`, `plan/repo-remediation-plan.md`) are stated out.

## Definition of done (whole plan)
`git status` clean of plan-owned paths · CI `verify` green including the two new gates · `pnpm security:audit` green · EAS preview APK fingerprint-checked · device smoke list passes · docs updated.

---

## Execution record (2026-11-07)

| Task | State | Evidence / deviation |
|---|---|---|
| APK0 commit train | **Done** | Landed by the owner before this execution (`59594d1` and preceding commits). |
| APK1 metro config tracked | **Done** | `.gitignore`: `metro.config.js` → `/metro.config.js`; `android/metro.config.js` committed as `8e750c1`. `git check-ignore` no longer matches. |
| APK2 CI gates | **Done** | `scripts/verify-tracked-build-files.mjs` (8 files) and `scripts/verify-android-bundle-styles.mjs` added to `ci.yml` `verify`. Negative test: config removed → fingerprints 0/0/0, gate exit 1; restored → pass. |
| APK3 Expo alignment | **Done** | Expo `57.0.32`, RN `0.86.3`, the full SDK patch line; `expo install --check` exit 0; `expo-doctor` 21/21. **Deviation:** Metro 0.84.5 replaced `image-size` with its own parser, so the `image-size` override and `patches/metro@0.84.4.patch` are obsolete and were removed; styled-bundle gate still passes. |
| APK4 security | **Done** | next 16.4.1, @sentry/nextjs 10.75.2, better-auth 1.7.7 (no migration needed), zod 4.6.7; overrides body-parser 2.4.0, multer 2.5.0, undici 8.12.2, vite 7.3.7, node-forge 1.4.1, qs 6.16.2, markdown-it 14.3.3; `pnpm security:audit` exit 0 with one justified ignore (`decode-uri-component` GHSA-qr28-fpjm-wq7f). Stale ignores removed. Remaining moderates are non-gating and tracked for a later wave. |
| APK5 preview env | **Done** | `build.preview` gains `environment: "preview"`; the working staging `EXPO_PUBLIC_API_URL` is retained in profile env (no EAS-env bootstrap needed). `RELEASE.md` documents both and warns against `10.0.2.2` on devices. |
| APK6 lint zero-warning | **Done** | 7 warnings removed across attendance/reports/sections/subjects; `pnpm --dir frontend lint` 0 problems. |
| APK7 Jest teardown | **Done** | Root cause was the Windows jest-worker 500 ms shutdown race, not leaked handles (instrumented `_getActiveHandles()` at end: only IPC/stdout/stderr). In-band `maxWorkers: 1` removes worker teardown; scanner fake-timer restore moved to `afterEach`. Full suite 656/656 with no warning. |
| APK8 local Windows build | **Deferred (decision)** | EAS is the supported APK path. The path-length CMake failure is environmental (`react-native-worklets` under `.pnpm`); documented in AGENTS Critical Context. Revisit only if local builds become required. |
| APK9 docs | **Done** | AGENTS Progress + Critical Context + Relevant Files updated; `RELEASE.md` carries the fingerprint check and preview env. |
| APK10 verification | **Local matrix Done; EAS/device pending** | shared 176; backend 993/82; web 398/59; Android 656/35; typecheck/lint/format/Prisma build all green; production export fingerprints pass; `security:audit` 0; Next/backend builds green. EAS preview build + device smoke require credentials/device. |

**Additional hardening found during execution:** frontend `SessionGuard.test.tsx` flaked only under full-suite load (1s `waitFor` default); both assertions now live inside one `waitFor` with a 3s budget so CI coverage load cannot time it out. Backend Jest also prints the same Windows worker-shutdown warning under parallel local runs (993/993 pass; CI already runs `--runInBand`); left as-is.
