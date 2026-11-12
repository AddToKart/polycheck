import http from 'k6/http'
import { check } from 'k6'
import { SharedArray } from 'k6/data'

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
      maxDuration: '60s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // fewer than 1% failed
    http_req_duration: ['p(95)<500'], // 95% under 500ms
  },
}

export default function () {
  const index = __ITER
  const target = targets[index]
  if (!target) return

  const at = target.issuedAt + 2000
  const payload = JSON.stringify({
    sessionId: target.sessionId,
    qrToken: target.qrToken,
    lat: target.lat,
    lon: target.lon,
    deviceId: 'mobile-k6-' + index,
    scannedAt: new Date(at).toISOString(),
    clientAttemptId: 'k6-' + index + '-' + target.issuedAt,
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
    'success is true': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body && body.success !== false
      } catch {
        return false
      }
    },
  })
}
