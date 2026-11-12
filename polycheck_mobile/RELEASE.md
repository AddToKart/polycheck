# Polycheck Mobile - Android Release Runbook

Play Store submission target: **November 18-20, 2026** (`.aab` upload).
Package: `edu.pup.polycheck.mobile` (coexists with the React Native app
`edu.pup.polycheck`).

This document covers the Flutter client only. Build/signing commands are
Windows-oriented (the development machine uses Android Studio's bundled JDK),
but the Gradle configuration is portable.

---

## 1. Version policy

The single source of truth is `pubspec.yaml`:

```yaml
version: 1.0.0+1
#        ^     ^
#        |     +-- versionCode (integer, must increase for every Play upload)
#        +-------- versionName (user-visible, semver)
```

- **Never reuse or decrease `versionCode`.** Play rejects duplicate uploads.
- Bump `+N` for every internal/alpha/beta/production upload, even when
  `versionName` is unchanged.
- Bump `versionName` for user-visible releases (`1.0.1`, `1.1.0`, ...).
- `flutter.versionCode` / `flutter.versionName` in Gradle come from this field.
- Keep `lib/src/core/app_info.dart` (`PUP_APP_VERSION`) aligned when displaying
  the version in-app; release pipelines can stamp
  `--dart-define=PUP_APP_VERSION=1.0.0+12`.

## 2. Environment

```powershell
flutter config --jdk-dir "C:\Program Files\Android\Android Studio\jbr"
flutter doctor -v          # Android toolchain must be green for builds
flutter pub get
```

`android/local.properties` is machine-specific and git-ignored; Flutter
regenerates it. Release builds require the deployed API (the default is the
staging API used by the React Native app):

```powershell
flutter build appbundle --release `
  --dart-define=PUP_API_BASE_URL=https://polycheck-api.addtokart.tech/api `
  --dart-define=PUP_WS_BASE_URL=https://polycheck-api.addtokart.tech/attendance
```

Optional release flags:

| Define | Default | Purpose |
|---|---|---|
| `PUP_API_BASE_URL` | staging API | NestJS base URL including `/api` |
| `PUP_WS_BASE_URL` | derived from API URL | Socket.IO namespace URL |
| `ALLOW_QR_FALLBACKS` | `false` | In-person screenshot/manual QR fallbacks (online sessions always allow them) |
| `ENABLE_OUTAGE_SIMULATOR` | `false` | Demo-only offline simulator pill |
| `PUP_APP_VERSION` | `1.0.0` | Footer/app-info display version |

**Never enable the outage simulator or QR fallbacks in a production build.**

## 3. Keystore (create once, never commit)

Play App Signing is recommended: upload key only. Generate it outside the repo:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" `
  -genkeypair -v -storetype JKS `
  -keystore "$env:USERPROFILE\keys\polycheck-upload-keystore.jks" `
  -alias polycheck-upload `
  -keyalg RSA -keysize 2048 -validity 10000
```

Then copy `android/key.properties.example` to `android/key.properties`:

```properties
storeFile=C:/Users/you/keys/polycheck-upload-keystore.jks
storePassword=...
keyAlias=polycheck-upload
keyPassword=...
```

- `android/key.properties`, `**/*.jks`, and `**/*.keystore` are git-ignored.
- Back up the keystore and passwords in the team's password manager; losing
  the upload key requires a Play support recovery.
- **Fallback behavior:** when `android/key.properties` is absent,
  `android/app/build.gradle.kts` signs the release build with the debug key so
  local `flutter build appbundle` / `flutter build apk --release` still
  succeed. That artifact
  must **never** be uploaded to Play.

## 4. Build commands

```powershell
# Release bundle for Play
flutter build appbundle --release `
  --dart-define=PUP_API_BASE_URL=https://polycheck-api.addtokart.tech/api

# Output:
#   build/app/outputs/bundle/release/app-release.aab

# Local release APK smoke test
flutter build apk --release `
  --dart-define=PUP_API_BASE_URL=https://polycheck-api.addtokart.tech/api

# Output:
#   build/app/outputs/flutter-apk/app-release.apk

# Debug APK (no signing prerequisites)
flutter build apk --debug
```

R8/minification and resource shrinking are **enabled** for release. Keep rules
live in `android/app/proguard-rules.pro`. R8 mapping output (upload with the
bundle for readable crash traces):

```
build/app/outputs/mapping/release/mapping.txt
```

If a plugin is stripped incorrectly, add a narrowly scoped keep rule rather
than disabling minification.

Verify the signed bundle (`apksigner` expects an APK, so use `jarsigner` for
the `.aab`):

```powershell
& "$env:JAVA_HOME\bin\jarsigner.exe" -verify -certs `
  build\app\outputs\bundle\release\app-release.aab

# Optional: confirm AGP moved native debug symbols into BUNDLE-METADATA.
# Requires Android SDK cmdline-tools (apkanalyzer).
apkanalyzer files list build\app\outputs\bundle\release\app-release.aab |
  Select-String BUNDLE-METADATA
```

> Flutter also runs that `apkanalyzer` check after Gradle builds the bundle.
> On machines without `cmdline-tools` (the current dev box is missing it, as
> `flutter doctor` reports) the tool prints
> `Release app bundle failed to strip debug symbols from native libraries`
> and exits 1 **after** writing a valid, already-stripped `.aab`. Install
> cmdline-tools to make the command exit 0. The bundle is not affected.

## 5. App identity and branding

| Item | Value |
|---|---|
| App label | `Polycheck` (`AndroidManifest.xml`) |
| Application ID | `edu.pup.polycheck.mobile` |
| minSdk / targetSdk | 26 (Android 8) / 36 (Play requirement) |
| Launcher icon | PUP seal on maroon `#7B1113` (legacy + adaptive + monochrome) |
| Icon source | `assets/branding/` (derived from `android/assets/pup-logo*.png`) |
| Regenerate icons | `dart run flutter_launcher_icons` |
| Splash | `LaunchTheme` window background `#7B1113` (light) / `#0A0A0A` (night); Android 12+ uses `windowSplashScreenBackground` |
| Theme | Lora + DM Sans, maroon/gold tokens (web/mobile parity) |

## 6. Permissions rationale

| Permission | Why it is declared | When it is requested |
|---|---|---|
| `CAMERA` | Scan the instructor's signed attendance QR | First scan / image capture |
| `ACCESS_FINE_LOCATION` | Verify the in-person geofence (Haversine client check); server re-validates | First in-person scan or officer session creation |
| `ACCESS_COARSE_LOCATION` | Fallback fix on devices without precise GPS | Same as above |
| `INTERNET` | NestJS REST API + Socket.IO realtime | Always |
| `VIBRATE` | Scanner/toast haptics | Scan feedback |
| `POST_NOTIFICATIONS` | Declared for future Expo/FCM-style push; **no push provider is wired and the app never requests it in this release** | Never (deferred) |

Cleartext HTTP is **not** enabled. The API and Socket.IO endpoints are HTTPS.
Online sessions never collect location (RA 10173).

## 7. Play Console data safety mapping

Use this table when filling **App content -> Data safety**. The app is an
institution-provisioned attendance system; it does not sell data or use it for
advertising.

| Play data type | Collected | Shared | Purpose | Required? | Notes |
|---|---|---|---|---|---|
| Approximate location | Yes | No | App functionality, fraud prevention | Required for in-person check-in | Online sessions stay zero-GPS |
| Precise location | Yes | No | App functionality, fraud prevention | Required for in-person check-in | Stored for audit; coordinates shredded after `geolocation_retention_days` (default 30) |
| Device or other IDs | Yes | No | App functionality, fraud prevention | Required | Installation ID used for device binding / single-device login |
| Education info | Yes | No | App functionality | Required | Student number, program, year level, sections, attendance records |
| App activity / in-app actions | Yes | No | App functionality, audit, security | Required | Attendance, disputes, excuses, session activations |
| Diagnostics | Yes (user-initiated) | No | App functionality, support | Optional | System Report telemetry: device model/version, app version, route, network type; optional screenshot |
| Photos | Yes (user-initiated) | No | App functionality, audit | Optional | Proof-of-class images, dispute/excuse evidence, report screenshots |
| Messages | Yes | Yes (AI provider) | App functionality | Optional | AI Assistant prompts/responses are processed by the institution-configured OpenAI-compatible endpoint |
| Files and docs | Yes (user-initiated) | No | App functionality | Optional | Master list / class record / session exports via the share sheet |

Other answers:

- **Encrypted in transit:** Yes (HTTPS/WSS).
- **Data deletion request:** accounts are institution-provisioned; deletion is
  handled by the PUP registrar/admin through the admin console. Users can
  request deletion via the institution's helpdesk.
- **Data collection optional:** diagnostics, photos, and AI messages are
  user-initiated; attendance/location/device data are required for the
  in-person attendance contract.
- **No advertising or tracking SDKs.**

## 8. Pre-upload checklist

1. `dart format lib test` (no changes).
2. `flutter analyze` -> **0 issues**.
3. `flutter test` -> all green (record the count).
4. Bump `version:` in `pubspec.yaml` (`+N` monotonic).
5. `flutter build apk --debug` succeeds.
6. `flutter build appbundle --release` succeeds; confirm `app-release.aab`.
7. Verify signing certificates; confirm it was **not** debug-signed.
8. Install the release APK on a physical device and smoke:
   landing/login, student scan (in-person + online), faculty cockpit QR,
   offline "Saved on Device" -> reconnect drain, ID card, assistant,
   settings, maintenance screen.
9. Confirm icons (legacy, adaptive, themed) and the maroon splash.
10. Confirm the API URL/WS URL in the bundle are production values.
11. Upload `mapping.txt` with the bundle.
12. Complete Data safety, content rating, privacy policy URL, and target
    audience forms.
13. Upload to the internal testing track first; promote after sign-off.

## 9. Known deferrals (v1)

- **Push notifications / FCM**: the notification inbox is in-app/realtime;
  `POST_NOTIFICATIONS` is declared but no provider is wired.
- **AI assistant thread persistence in the app UI**: messages stream and the
  current conversation works, but cross-launch thread browsing/restore is not
  surfaced on mobile (the backend keeps Redis threads).
- **Kiosk projector stage**: web-only surface (same decision as the React
  Native app); mobile keeps the live cockpit.
- **iOS**: out of scope for this submission.
- **Account self-service deletion**: handled through institution admins.
