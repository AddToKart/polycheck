# Polycheck Mobile (Flutter)

Production Flutter client for **Polycheck**, the PUP Santa Maria attendance
management system. This package is a 1:1 port of the shipped React Native app
in `../android/` and talks to the same NestJS API and shared contracts.

> **Coexistence:** the React Native app in `../android/` is untouched and keeps
> its own package id (`edu.pup.polycheck`). This Flutter app is
> `edu.pup.polycheck.mobile`, so both can be installed side-by-side until the
> team cuts over. Never edit `../android/`, `../backend/`, `../frontend/`, or
> `../shared/` from this package.

## Requirements

- Flutter 3.44+ / Dart 3.12+
- Android SDK (compile/target from the Flutter SDK) + Android Studio JBR
  (`flutter config --jdk-dir "C:\Program Files\Android\Android Studio\jbr"`)
- A reachable Polycheck NestJS backend

## Run / verify

```powershell
flutter pub get
dart format lib test
flutter analyze          # release gate: 0 issues
flutter test             # hermetic unit/widget suite
flutter build apk --debug

# Point a device build at a backend
flutter run `
  --dart-define=PUP_API_BASE_URL=https://polycheck-api.addtokart.tech/api
```

Release/signing steps live in [`RELEASE.md`](RELEASE.md).

## `--dart-define` flags

| Flag | Default | Meaning |
|---|---|---|
| `PUP_API_BASE_URL` | `https://polycheck-api.addtokart.tech/api` | NestJS base URL (must include `/api`) |
| `PUP_WS_BASE_URL` | derived from `PUP_API_BASE_URL` | Explicit Socket.IO namespace URL (`.../attendance`) |
| `ALLOW_QR_FALLBACKS` | `false` | In-person screenshot/manual QR fallbacks; online sessions always allow them |
| `ENABLE_OUTAGE_SIMULATOR` | `false` | Demo-only offline simulator (never ship enabled) |
| `PUP_APP_VERSION` | `1.0.0` | Footer/version label |

Examples:

```powershell
# Local opt-in fallbacks
flutter run --dart-define=ALLOW_QR_FALLBACKS=true

# LAN backend from a physical device (never 10.0.2.2 outside an emulator)
flutter run --dart-define=PUP_API_BASE_URL=http://192.168.1.20:4000/api
```

## Architecture

```
lib/
  main.dart                     app bootstrap + lifecycle sync binder
  src/core/
    api/                        typed API clients (Dio) + providers
    database/                   drift schema: caches, outbox, notifications, meta
    network/                    Dio interceptors, trusted clock probing, errors
    providers/                  session, maintenance, trusted clock, officers
    router/                     go_router guard ladder (auth/role/maintenance)
    sync/                       offline attendance drain engine + PIN vault
    theme/ widgets/ utils/      PUP design tokens and shared primitives
  src/features/
    auth/ student/ faculty/ admin/ surface/
```

Key behaviors:

- **Riverpod** for state, **go_router** for guarded navigation, **freezed** for
  models, **drift/SQLite** for the owner-scoped offline cache.
- **Offline attendance**: the student scanner validates the signed token,
  trusted-clock window, PIN, GPS/geofence locally, then queues the evidence in
  `OfflineAttendanceQueue` (owner-scoped, no plaintext PIN). When connected —
  reconnect, app resume, or the dashboard **Sync now** button — the engine
  batches rows to `POST /sync/attendance/batches`, polls the receipt until
  terminal, and reconciles to `CONFIRMED`, `DISPUTED_DUPLICATE`, or `FAILED`
  (terminal evidence is retained for review; transient failures use exponential
  backoff). A 401 or maintenance 503 aborts the drain without losing the queue.
- **Security**: bearer token in secure storage, per-request device id header,
  single-session device gate for students, RA 10173 zero-GPS online sessions.
- **Realtime**: Socket.IO for attendance updates, notifications, AI streaming,
  and server metrics; all scoped by the authenticated role.

## Tests

```powershell
flutter test
flutter test test/core/sync/sync_engine_test.dart   # sync payload/receipt matrix
```

The suite is hermetic: fake API transports + in-memory drift databases; no
network or emulator required.
