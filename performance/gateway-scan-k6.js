import http from 'k6/http'
import { check } from 'k6'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'

const targets = new SharedArray('targets', function () {
  return JSON.parse(open('./.gateway-k6-targets.json'))
})

const INGEST_URL = __ENV.INGEST_URL || 'http://127.0.0.1:4001'
const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 100

export const options = {
  scenarios: {
    scan_burst: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: targets.length,
      maxDuration: __ENV.MAX_DURATION || '1200s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // fewer than 1% failed
    http_req_duration: ['p(95)<5000'], // 95% under 5s
  },
}

export default function () {
  // `__ITER` is VU-local: under `shared-iterations` every VU restarts at 0, so
  // using it as the target index replayed the first N targets for the whole run
  // and never exercised the remaining sessions. `scenario.iterationInTest` is
  // unique across VUs, so each prepared target is scanned exactly once.
  const index = exec.scenario.iterationInTest
  const target = targets[index]
  if (!target) return

  const at = target.issuedAt + 2000 + ((index % 1000) * 10)
  const payload = JSON.stringify({
    sessionId: target.sessionId,
    qrToken: target.qrToken,
    lat: target.lat,
    lon: target.lon,
    deviceId: 'mobile-k6-' + index,
    scannedAt: new Date(at).toISOString(),
    clientAttemptId: 'k6-' + index + '-' + target.issuedAt + '-' + Math.random().toString(36).slice(2, 8),
    accuracyMeters: 8,
    locationCapturedAt: new Date(at - 1000).toISOString(),
    mocked: false,
    inputChannel: 'camera',
  })

  const res = http.post(`${INGEST_URL}/api/attendance/scan`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${target.studentToken}`,
    },
    timeout: '15s',
  })

  check(res, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    // After dedupe a replayed scan is a deliberate 200 {success:false,
    // reason:'duplicate'} acknowledgement, not a failure.
    'success is true': (r) => {
      try {
        const body = JSON.parse(r.body)
        return Boolean(body) && (body.success !== false || body.reason === 'duplicate')
      } catch {
        return false
      }
    },
  })
}
