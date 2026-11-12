# Integration tests (`polycheck_mobile/integration_test`)

End-to-end specs that run **on a real Android device/emulator** against a **live
backend**. They exist to catch the class of bug the hermetic `test/` suite
cannot see: real Dio transport, real Android secure storage, the real Drift
database file, real Ed25519 signing, and the real server-side scan validator.

## Specs

| File | Proves |
| --- | --- |
| `offline_attendance_test.dart` | The full offline in-person arc. A teacher signs a QR token **locally**, provisions the public key, and arms a session with that exact token; the student's scan is forced offline (outage simulator) and lands in the encrypted queue carrying `inputChannel` + `locationCapturedAt`; after reconnecting, the real `SyncEngine` drains it and the **server** record comes back accepted (not `disputed`, not `missing_scan_evidence`). |
| `logout_queue_test.dart` | The queue-survival contract (DD-W25, Flutter side). An authoritative sign-out (`handleSessionExpired` — the replaced-session/forced-re-auth path) purges the owner's cache and bearer token but **keeps** the queued check-in and the owner's secure-storage keys; re-authenticating drains it successfully. A second case pins the deliberate counterpart: an explicit user sign-out *does* purge the queue. |
| `student_login_test.dart` | The router + auth gate. The app boots to the portal, the student portal opens the login form, a fixture student signs in, and the student dashboard renders that student's own record. |

Support code lives in `integration_test/support/`:

- `env.dart` — `--dart-define` resolution and the fixture constants.
- `api_helpers.dart` — plain-HTTP fixture API (login, users, subjects,
  sections, sessions, provisioning, activation, attendance reads) over the
  app's own `dio`.
- `fixtures.dart` — the disposable scenario builder.
- `harness.dart` — the `ProviderContainer` + the two provider overrides + the
  outage-simulator wiring.

## Running

Prerequisites: the local Docker stack is up (`backend` on `localhost:4000`,
seeded), and an Android device/emulator is attached.

```bash
flutter devices          # expect e.g. emulator-5554

flutter test integration_test/offline_attendance_test.dart -d emulator-5554 \
  --dart-define=PUP_API_BASE_URL=http://10.0.2.2:4000/api \
  --dart-define=ENABLE_OUTAGE_SIMULATOR=true \
  --dart-define=ALLOW_QR_FALLBACKS=true
```

Run the other two the same way, swapping the file name. To run all three:

```bash
flutter test integration_test -d emulator-5554 \
  --dart-define=PUP_API_BASE_URL=http://10.0.2.2:4000/api \
  --dart-define=ENABLE_OUTAGE_SIMULATOR=true \
  --dart-define=ALLOW_QR_FALLBACKS=true
```

### `--dart-define` contract

| Define | Required | Meaning |
| --- | --- | --- |
| `PUP_API_BASE_URL` | **yes** | API root. `http://10.0.2.2:4000/api` is the Android emulator's alias for the host loopback and is the harness default. On a physical device or a remote runner use `http://localhost:4000/api` together with `adb reverse tcp:4000 tcp:4000`. |
| `ENABLE_OUTAGE_SIMULATOR` | **yes** for the offline specs | Enables the dev outage tools and the interceptor that turns `OutageSimulator.arm()` into connection-shaped failures. The offline spec fails fast with an actionable message if it is missing rather than silently running online. |
| `ALLOW_QR_FALLBACKS` | no | Keeps the build aligned with the manifest/camera fallback policy the rest of the app is tested under. |

The harness refuses to start if `ApiConfig.baseUrl` (what the app's Dio is
built with) and its own base URL disagree, so a forgotten define cannot produce
a green run that never touched the local backend.

## Fixture model

Every spec builds its own scenario; **no spec reads or writes seeded demo data**,
and no spec signs in as a seeded student (that would contend for the device
binding with anything else running at the same time).

`AttendanceFixture.create()` performs, in order:

1. **Disposable teacher** — the super admin (`mcreyes@pup.edu.ph`) calls
   `POST /users/teachers` with an explicit password (`PyE2e!Passw0rd`), so the
   account never lands in `mustChangePassword` and the forced-rotation router
   guard cannot stall a run.
2. **Disposable subject + section + in-person session** — created by that new
   teacher (`POST /subjects`, `/sections`, `/sessions`), with the harness
   geofence (`14.5995, 120.9842`, 150 m).
3. **Disposable student** — the super admin calls `POST /users/students` with an
   explicit password. The student number matches `^\d{4}-\d{5}-[A-Z]{2}-\d$`
   and its 5-digit block is derived from the run id.
4. **Enrollment** — the teacher enrolls that student in that section.
5. **Signed token** — the app's own `TeacherSigningKeyService` mints an Ed25519
   key, `buildInPersonTokenPayload` builds the in-person payload, and
   `signPayload` produces the real `<payload>.<signature>` wire token.
6. **Provision + arm** — `POST /auth/provision-key` uploads the matching public
   key, then `POST /sessions/:id/activate` arms the session with that exact
   token. The fixture asserts the server echoed back both the token and the
   public key before returning.

Every name, code, email and student number carries a unique run id, so parallel
agents or CI shards can run the same spec against the same backend
simultaneously. Server-side rows are **not** deleted after a run: the backend
deliberately refuses `DELETE /sections/:id` once the section has session history
("Cannot delete a section with existing session history") and
`DELETE /subjects/:id` while sections reference it, so a fixture can never erase
attendance evidence. Every row is run-unique and inert, so leftovers cannot
collide with the next run; the secure-storage signing key **is** reset on
teardown, and teardown failures are logged rather than swallowed.

### Token issuance time

The signed token's `issuedAt` is taken from `GET /health` (the server's own
clock), not the device clock, so emulator clock skew can never invalidate a
fixture token or push a scan into the `delayed_offline_sync` dispute path.

## What is real, and what the harness substitutes

The container is the app's real graph: `AppDatabase.open()` (the on-device Drift
file), the real `dioProvider` at `ApiConfig.baseUrl`, the real secure token
store, the real `DeviceIdentity`, the real session controller, the real
`StudentScanService`, and the real `SyncEngine`.

Two providers are overridden, and only where a device cannot supply the input:

- **`scanLocationReaderProvider`** → `FixedScanLocationReader`. An emulator has
  no dependable GNSS fix. The fake returns a fix at the session geofence centre
  with 10 m accuracy and a zero-age timestamp, so the accuracy cap, staleness
  window, haversine geofence check and evidence capture all still execute.
- **`deviceSecurityProberProvider`** → the app's own
  `DefaultDeviceSecurityProber` with its platform sweeps stubbed clean. A CI
  emulator legitimately reports `emulatorDetected: true`, and the server would
  then (correctly) dispute every scan as `emulator_detected`; the harness feeds
  a compliant-device snapshot instead.

`SurfaceOutageInterceptor.install()` is called explicitly because the headless
harness never mounts the surface shell that normally installs it.
`AppHarness.boot()` also clears the persisted bearer token first, so every spec
starts from a signed-out device and no spec depends on what an earlier spec left
in secure storage.

`student_login_test.dart` is the one spec that pumps widgets. It mounts
`PolycheckApp(bootstrap: false)` — the seam `main.dart` documents for tests —
because the boot builder mounts `SyncLifecycleBinder`, whose `dispose()` reads a
provider (`sync_lifecycle_binder.dart:102`) and therefore trips Riverpod's
"Using ref when a widget is about to or has been unmounted is unsafe" assertion
when the tree is torn down. The router, auth gate, session controller, consent
gate, Dio client and every screen are the shipped ones; only the background
boot work (health probe, maintenance poll, realtime replacement socket,
clock/drain timers) is skipped.

## Reading a failure

- `FixtureApiException` prints the HTTP status **and the response body**, i.e.
  the exact validator that rejected the fixture call.
- The offline spec prints `REPLAY PAYLOAD` (the JSON the drain sends),
  `DRAIN` (the `SyncDrainReport` counters) and `SERVER ROW` (the authoritative
  attendance row). If the server disputed the replay, `SERVER ROW` names the
  `disputeReason`.

## Local troubleshooting

- `Cannot reach the Polycheck server` — confirm the backend answers on the host
  (`curl http://localhost:4000/api/health`), then from the device. If
  `10.0.2.2` is blocked, run `adb reverse tcp:4000 tcp:4000` and switch the
  define to `http://localhost:4000/api`. A single connection failure is retried
  once by `FixtureApi` before it is reported.
- `mustChangePassword` blocks a run — a fixture account was created without an
  explicit password. Always pass `password`.
- `409 user with this student ID or email already exists` — the run id collided;
  re-run. Ids are derived from the current millisecond plus random noise.
- `403 ... designation_required` — the fixture tried to create an account with
  a non-super-admin token. Only super admins pass `@RequireDesignation`
  implicitly.
