# Polycheck Mobile — Release Notes & Versioning

Short operational reference for Play Store / App Store builds. For environment and
infrastructure details see [`../documentation/PRODUCTION_READINESS.md`](../documentation/PRODUCTION_READINESS.md).

## Versioning (monotonic)

- `expo.version` (app.json) = user-visible `versionName` / `CFBundleShortVersionString`.
  Bump with each store submission: `1.0.0` → `1.0.1` (patch), `1.1.0` (feature), `2.0.0` (breaking).
- `expo.android.versionCode` (app.json) = Android `versionCode` baseline. `eas.json` uses
  `appVersionSource: "remote"` + `production.autoIncrement: true`, so EAS owns the published
  sequence and increments it per production build.
- `expo.ios.buildNumber` (app.json) = iOS baseline equivalent; EAS increments it remotely.
- **Rule:** never reuse or hand-edit a versionCode that has already been uploaded. The local
  value in `app.json` is a starting baseline only — the store record is authoritative. Local
  release builds must use a code that stays below the next published EAS code.
- First published Android build: `versionCode 1`, `versionName 1.0.0`.

## Required EAS/Gradle environment (production)

| Variable | Value | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://<api-host>/api` | Non-dev builds throw at startup when missing (`services/api-config.ts`) |
| `EXPO_PUBLIC_ALLOW_QR_FALLBACKS` | `false` | Image-upload / manual-token fallbacks are opt-in only; `eas.json` production pins this |
| `EXPO_PUBLIC_E2E_MODE` | `false` | Enables the test-only signing-token bridge when `true` |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN or unset | Unset disables Sentry (`app/_layout.tsx`) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | EAS secret / env | Required for source-map upload by `@sentry/react-native/expo` |

The fallback gate is secure-by-default in code (`scan.tsx`: enabled only when the variable is
exactly `"true"`). Local `.env` may set `true`; production tooling must set or inherit `false`.

### Preview profile environment

`eas.json` `build.preview` pins `EXPO_PUBLIC_API_URL` to the deployed staging API and also resolves
the project's `preview` environment (dashboard → Environment variables, or
`eas env:create --environment preview ...`) for any additional variables. Non-development builds
throw at startup when `EXPO_PUBLIC_API_URL` is missing (`services/api-config.ts`), so keep the value
present. Change it in `eas.json` when testing against a local backend, and never use the emulator
alias `10.0.2.2` for a physical-device build — it only resolves inside the Android emulator. Use the
build machine's LAN IP (e.g. `http://192.168.1.50:4000/api`) for a local API. The preview profile
keeps `EXPO_PUBLIC_ALLOW_QR_FALLBACKS=true` for QA; do not propagate it to production, which stays
pinned to `false`.

## Pre-upload checklist

1. `pnpm -C android typecheck` and `pnpm -C android test` — all suites green.
2. `pnpm -C android e2e` (or the relevant Maestro flow) against a preview build.
3. `eas build --profile production --platform android` (AAB) — no non-production screens reachable.
4. **Styled-bundle gate:** after every EAS build, extract the APK/AAB and confirm the Hermes
   bundle contains at least one `twsa-safe-area` marker (zero = NativeWind's Metro config was
   missing and the APK will be unstyled):
   ```powershell
   New-Item -ItemType Directory -Force .\apk-contents | Out-Null
   tar -xf .\polycheck.apk -C .\apk-contents assets/index.android.bundle
   rg -a -c "twsa-safe-area" .\apk-contents\assets\index.android.bundle
   ```
   ```bash
   unzip -p polycheck.apk assets/index.android.bundle | grep -a -c "twsa-safe-area"
   ```
   For an AAB, the bundle path is `base/assets/index.android.bundle` (e.g.
   `unzip -p app-release.aab base/assets/index.android.bundle | grep -a -c "twsa-safe-area"`).
   CI runs the equivalent gate on every `verify` job:
   `node scripts/verify-android-bundle-styles.mjs`.
5. Manual device smoke (release build, not Expo Go): login → scan with fallbacks disabled →
   offline scan → reconnect sync → teacher cockpit → assistant reply containing a table, list,
   and link (markdown-it 14 is a major override; confirm rendering after assistant changes).
6. Confirm store listing version matches `expo.version`; retain the build artifact SHA.

## Assets

- App icon: `assets/icon.png`; Android adaptive: `android-icon-foreground/background/monochrome.png`
  (backgroundColor `#7B1113`).
- Splash: `assets/splash-icon.png` via `expo-splash-screen` plugin (maroon `#7B1113`, dark `#0A0A0A`).
- iOS: `buildNumber` in `app.json`, bundle id `edu.pup.polycheck`.

## Removed / dev-only surfaces

- `app/debug.tsx` (style-prop baseline screen) was deleted before release; do not reintroduce
  debug routes — Expo Router exposes every file route to deep links.

## Wave 4 device verification runbook (notifications, excuses, filters)

Wave 4 (`plan/notifications-excuse-filters-plan.md`) adds `expo-notifications`, a
`POST_NOTIFICATIONS` permission, and a notification channel, so a **new dev client /
EAS build is required** before testing push. JS-only screens still hot-reload.

1. Build and install: `eas build --profile development --platform android` (or
   `npx expo run:android`) on a physical device or emulator with Play Services.
2. Permissions: sign in -> accept the Android 13+ notification prompt; verify
   `POST_NOTIFICATIONS` appears in app settings. Denying must not crash the app.
3. Push registration: confirm the app registers a token (`POST /notifications/push-token`)
   when `extra.eas.projectId` exists; without FCM/EAS credentials it skips safely in debug.
4. Notification center: bell badge increments for a seeded event (student files an excuse
   from another session), list opens, tap deep-links to `(faculty)/excuses`, Mark all read
   clears the badge; unread count survives a cold restart.
5. Push delivery: background the app, trigger an excuse/decision event, verify the
   notification arrives and tapping routes to the right screen. Check the monochrome
   notification icon renders correctly (alpha-masked).
6. Excuses: student requests from History (reason, description, optional photo), teacher
   approves/rejects with a note in `(faculty)/excuses`; approve flips the record to
   Excused and the student receives a notification.
7. Filters: faculty attendance accepts subject/section/date presets (including deep links),
   sessions show the section-context chip and clear action, disputes accept section/date,
   reports accept section (and department for institution admins), student history filters
   by subject/date/status.
8. Small screens: verify the settings segmented tabs, filter panels, and the excuse sheet
   keyboard behavior at 360dp width.

Record results in the release ticket. CI runs typecheck + jest; Maestro flows for the
Wave 4 journeys are tracked as a follow-up (device-dependent).
