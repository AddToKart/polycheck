# Attendance Load Testing

`performance/attendance-load.js` measures the bell-time write path without mixing authentication or eligibility pre-check latency into the result. Each scheduled iteration uses one pre-provisioned student bearer token and submits one realistic `/api/attendance/scan` request with location accuracy, location capture time, mock-location status, camera input channel, device ID, and a stable client attempt ID.

The smoke profile runs two concurrent one-shot scans. The full profile runs 1,000 concurrent VUs with one scan each to model the attendance bell rush directly.

## Safety guardrails

The script writes attendance records. Run it only against an isolated, authorized environment with a disposable active session.

- Remote targets require HTTPS and the exact `K6_ALLOW_REMOTE_TARGET` acknowledgement.
- The 1,000-user profile requires a second explicit acknowledgement.
- Every iteration requires a unique, pre-provisioned student bearer token. Do not use production student sessions.
- `K6_RUN_ID` becomes part of each stable `clientAttemptId`. Use a new run ID for each fresh dataset; reuse it only when intentionally replaying the exact same attempts.
- QR tokens and bearer tokens are supplied at runtime and must not be committed.
- `performance/tokens.example.json` is intentionally empty. Populated `performance/tokens*.json` files are ignored, but storing token fixtures outside the repository with restricted filesystem permissions is safer.
- Use coordinates inside the session geofence and a currently valid signed QR token.

## Token fixture

Provision and authenticate distinct test students before the measured run. Store only their issued mobile bearer tokens in an untracked JSON file:

```json
[
  { "token": "<UNIQUE_TEST_STUDENT_BEARER_TOKEN>" }
]
```

The smoke profile requires two entries. The full profile requires 1,000 entries. A repeated token aborts setup because it would reuse one student session and invalidate the result.

Authentication provisioning is intentionally outside the scenario. Measure login capacity separately; bcrypt and session creation have different scaling and security limits from the attendance bell rush.

## Smoke profile

PowerShell:

```powershell
$env:K6_PROFILE = "smoke"
$env:K6_TOKENS_FILE = "C:\secure\polycheck-k6-tokens.json"
$env:K6_RUN_ID = "smoke-20260718-01"
$env:BASE_URL = "http://127.0.0.1:8080"
$env:SESSION_ID = "<ACTIVE_TEST_SESSION_ID>"
$env:QR_TOKEN = "<CURRENT_SIGNED_TEST_QR_TOKEN>"
$env:LATITUDE = "<GEOFENCE_LATITUDE>"
$env:LONGITUDE = "<GEOFENCE_LONGITUDE>"
$env:ACCURACY_METERS = "5"
k6 run performance/attendance-load.js
```

POSIX shell:

```sh
K6_PROFILE=smoke \
K6_TOKENS_FILE=/secure/polycheck-k6-tokens.json \
K6_RUN_ID=smoke-20260718-01 \
BASE_URL=http://127.0.0.1:8080 \
SESSION_ID='<ACTIVE_TEST_SESSION_ID>' \
QR_TOKEN='<CURRENT_SIGNED_TEST_QR_TOKEN>' \
LATITUDE='<GEOFENCE_LATITUDE>' \
LONGITUDE='<GEOFENCE_LONGITUDE>' \
ACCURACY_METERS=5 \
k6 run performance/attendance-load.js
```

## Full 1,000-user profile

Set the same values as the smoke run, select `K6_PROFILE=full`, provide 1,000 unique tokens, and set both acknowledgements:

```sh
K6_PROFILE=full \
K6_ALLOW_REMOTE_TARGET=I_ACKNOWLEDGE_THIS_WRITES_ATTENDANCE_DATA \
K6_CONFIRM_1000_USERS=I_HAVE_AUTHORIZATION_FOR_1000_USERS \
K6_TOKENS_FILE=/secure/polycheck-k6-tokens-1000.json \
K6_RUN_ID=bell-rush-20260718-01 \
BASE_URL=https://load-test.polycheck.example.edu \
SESSION_ID='<ACTIVE_TEST_SESSION_ID>' \
QR_TOKEN='<CURRENT_SIGNED_TEST_QR_TOKEN>' \
LATITUDE='<GEOFENCE_LATITUDE>' \
LONGITUDE='<GEOFENCE_LONGITUDE>' \
ACCURACY_METERS=5 \
K6_SUMMARY_EXPORT=performance/attendance-full.summary.json \
k6 run performance/attendance-load.js
```

Start below 1,000 users when capacity has not been established. The full profile launches 1,000 VUs with one scan each; bearer sessions are provisioned before the run so authentication limits and password hashing do not spread or distort the attendance burst. The API's global limit is Redis-backed and keyed by authenticated user, while stricter scan limits are keyed by student and session.

Monitor nginx latency, backend CPU/event-loop health, PgBouncer active/waiting clients, PostgreSQL locks and query latency, Redis latency/memory, HTTP error rate, and attendance processing throughout the run. The reference Prometheus configuration covers backend metrics only; collect the remaining infrastructure signals separately.

## Acceptance thresholds

The script enforces less than 1% failed requests/checks, completion of every configured VU iteration, present/late results without dispute review, scan p95 below one second, and scan p99 below two seconds. Treat these as reference SLOs, not proof of capacity. A passing run must also show no sustained PgBouncer wait queue, PostgreSQL saturation, Redis write failures, or delayed attendance persistence.

CI runs `k6 inspect` only. It validates both profiles and their thresholds without executing setup, loading real token fixtures, or sending attendance traffic.
