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

## Pre-upload checklist

1. `pnpm -C android typecheck` and `pnpm -C android test` — all suites green.
2. `pnpm -C android e2e` (or the relevant Maestro flow) against a preview build.
3. `eas build --profile production --platform android` (AAB) — no non-production screens reachable.
4. Manual device smoke (release build, not Expo Go): login → scan with fallbacks disabled →
   offline scan → reconnect sync → teacher cockpit.
5. Confirm store listing version matches `expo.version`; retain the build artifact SHA.

## Assets

- App icon: `assets/icon.png`; Android adaptive: `android-icon-foreground/background/monochrome.png`
  (backgroundColor `#7B1113`).
- Splash: `assets/splash-icon.png` via `expo-splash-screen` plugin (maroon `#7B1113`, dark `#0A0A0A`).
- iOS: `buildNumber` in `app.json`, bundle id `edu.pup.polycheck`.

## Removed / dev-only surfaces

- `app/debug.tsx` (style-prop baseline screen) was deleted before release; do not reintroduce
  debug routes — Expo Router exposes every file route to deep links.
