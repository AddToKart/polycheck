# Mobile end-to-end testing

Polycheck uses Maestro to exercise the compiled Expo/React Native app on an Android emulator. The suite talks to the real NestJS API and seeded PostgreSQL database; it does not replace services with mobile mocks.

## Covered journeys

- Student sign-in, schedule and audit navigation, invalid enrollment feedback, manual QR rejection, session restoration, and sign-out
- Teacher sign-in and navigation through subjects, sessions, disputes, and schedule
- Super-admin sign-in and read-only navigation through subjects, users, reports, and session monitoring

The QR journey intentionally validates the scanner fallback and rejection path with a malformed token. A successful attendance scan requires a signed, short-lived token created by an active teacher device, so it remains a two-device/manual smoke test instead of introducing a production test bypass for signing or geolocation.

## Prerequisites

- Node.js 22 and pnpm 11
- JDK 17 and Android Studio with an Android API 31 or newer emulator
- `adb` available on `PATH`
- Maestro CLI available on `PATH`
- The seeded Polycheck backend reachable from the emulator

Maestro is a machine-level CLI and is not an application dependency. Install it using the official Maestro CLI instructions for your operating system.

## Build and install the app

Start the seeded local stack from the repository root:

```powershell
pnpm docker:local:setup
```

Start an Android emulator, then generate and compile the native project. From the repository root in PowerShell:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:4000/api"
$env:EXPO_PUBLIC_ALLOW_QR_FALLBACKS = "true"
$env:EXPO_NO_GIT_STATUS = "1"
pnpm --dir android exec expo prebuild --platform android --no-install --clean
android\android\gradlew.bat -p android\android assembleDebug
adb reverse tcp:8081 tcp:8081
adb install -r android\android\app\build\outputs\apk\debug\app-debug.apk
```

In a second PowerShell terminal, keep Metro running while the suite executes:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:4000/api"
$env:EXPO_PUBLIC_ALLOW_QR_FALLBACKS = "true"
pnpm --dir android start
```

`10.0.2.2` is the Android emulator alias for the host machine. For a physical device, build with an API URL that uses the development machine's LAN address instead.

The generated `android/android` native project is ignored by Git and can be regenerated from `app.json`.

## Run the suite

Run all role journeys:

```powershell
pnpm test:e2e:mobile
```

Run one journey while developing:

```powershell
pnpm --dir android e2e:student
pnpm --dir android e2e:faculty
pnpm --dir android e2e:admin
```

Generate a JUnit report and failure artifacts:

```powershell
pnpm --dir android e2e:report
```

The flows default to the accounts created by `backend/prisma/seed.ts`. Override a value from the CLI when testing a different environment:

```powershell
maestro test -e E2E_STUDENT_ID=2024-00001-MN-0 -e E2E_PASSWORD=PolycheckLocal1! android/maestro/flows/01-student-journey.yaml
```

## Test authoring rules

- Prefer stable `testID` selectors for navigation, controls, and form fields.
- Assert user-visible outcomes and headings rather than component implementation details.
- Begin top-level flows with `clearState: true`; helper flows must not clear app state.
- Keep mutation tests deterministic and safe to repeat against freshly seeded data.
- Do not add production authentication, QR-signing, location, or API bypasses for E2E tests.
