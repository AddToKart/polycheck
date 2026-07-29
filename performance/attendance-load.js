import http from 'k6/http'
import { check as k6Check, fail } from 'k6'
import exec from 'k6/execution'
import { SharedArray } from 'k6/data'
import { Rate } from 'k6/metrics'

const profile = __ENV.K6_PROFILE || 'smoke'
const tokenPath = __ENV.K6_TOKENS_FILE || './tokens.example.json'
const tokens = new SharedArray('student bearer tokens', () => JSON.parse(open(tokenPath)))
const acceptedAttendance = new Rate('accepted_attendance')

if (!['smoke', 'full'].includes(profile)) {
  throw new Error('K6_PROFILE must be smoke or full')
}

const loadProfile =
  profile === 'full'
    ? {
        userCount: 1000,
        maxDuration: '2m',
      }
    : {
        userCount: 2,
        maxDuration: '30s',
      }

export const options = {
  scenarios: {
    attendance_bell_rush: {
      executor: 'per-vu-iterations',
      vus: loadProfile.userCount,
      iterations: 1,
      maxDuration: loadProfile.maxDuration,
      gracefulStop: '15s',
      exec: 'submitAttendanceScan',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    iterations: [`count==${loadProfile.userCount}`],
    accepted_attendance: ['rate==1'],
    'http_req_duration{operation:scan}': ['p(95)<1000', 'p(99)<2000'],
  },
  discardResponseBodies: false,
  noConnectionReuse: false,
  userAgent: `polycheck-k6/${profile}`,
}

const required = (name) => {
  const value = __ENV[name]
  if (!value) fail(`${name} is required`)
  return value
}

const validateTarget = (baseUrl) => {
  let target
  try {
    target = new URL(baseUrl)
  } catch {
    fail('BASE_URL must be an absolute http(s) URL')
  }

  const localHosts = ['127.0.0.1', 'localhost', '::1']
  if (!localHosts.includes(target.hostname) && __ENV.K6_ALLOW_REMOTE_TARGET !== 'I_ACKNOWLEDGE_THIS_WRITES_ATTENDANCE_DATA') {
    fail('Remote targets require K6_ALLOW_REMOTE_TARGET=I_ACKNOWLEDGE_THIS_WRITES_ATTENDANCE_DATA')
  }
  if (profile === 'full' && __ENV.K6_CONFIRM_1000_USERS !== 'I_HAVE_AUTHORIZATION_FOR_1000_USERS') {
    fail('The full profile requires K6_CONFIRM_1000_USERS=I_HAVE_AUTHORIZATION_FOR_1000_USERS')
  }
  if (target.protocol !== 'https:' && !localHosts.includes(target.hostname)) {
    fail('Remote load tests must use HTTPS')
  }

  return baseUrl.replace(/\/$/, '')
}

export const setup = () => {
  const baseUrl = validateTarget(__ENV.BASE_URL || 'http://127.0.0.1:8080')
  const sessionId = required('SESSION_ID')
  const qrToken = required('QR_TOKEN')
  const runId = required('K6_RUN_ID')
  const latitude = Number(required('LATITUDE'))
  const longitude = Number(required('LONGITUDE'))
  const accuracyMeters = Number(__ENV.ACCURACY_METERS || '5')

  if (!/^[A-Za-z0-9._-]{1,64}$/.test(runId)) {
    fail('K6_RUN_ID must be 1-64 letters, numbers, dots, underscores, or hyphens')
  }
  if (!Array.isArray(tokens) || tokens.length < loadProfile.userCount) {
    fail(`K6_TOKENS_FILE must contain at least ${loadProfile.userCount} unique bearer tokens`)
  }
  if (qrToken.length < 80) fail('QR_TOKEN does not meet the API minimum length')
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) fail('LATITUDE is invalid')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) fail('LONGITUDE is invalid')
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 50) {
    fail('ACCURACY_METERS must be between 0 and 50')
  }

  const uniqueTokens = new Set()
  for (let index = 0; index < loadProfile.userCount; index += 1) {
    const token = tokens[index]?.token
    if (typeof token !== 'string' || token.length < 16) {
      fail(`Token fixture ${index + 1} must contain a bearer token of at least 16 characters`)
    }
    if (uniqueTokens.has(token)) fail(`Token fixture ${index + 1} reuses a bearer token`)
    uniqueTokens.add(token)
  }

  return { baseUrl, sessionId, qrToken, runId, latitude, longitude, accuracyMeters }
}

export function submitAttendanceScan(config) {
  const studentIndex = exec.vu.idInTest - 1
  if (studentIndex >= loadProfile.userCount) fail('The scenario scheduled more iterations than token fixtures')

  const capturedAt = new Date().toISOString()
  const clientAttemptId = `k6:${config.runId}:${studentIndex}`
  const payload = {
    sessionId: config.sessionId,
    lat: config.latitude,
    lon: config.longitude,
    deviceId: `k6-${config.runId}-${studentIndex}`,
    qrToken: config.qrToken,
    scannedAt: capturedAt,
    clientAttemptId,
    accuracyMeters: config.accuracyMeters,
    locationCapturedAt: capturedAt,
    mocked: false,
    inputChannel: 'camera',
  }
  const response = http.post(`${config.baseUrl}/api/attendance/scan`, JSON.stringify(payload), {
    headers: {
      Authorization: `Bearer ${tokens[studentIndex].token}`,
      'Content-Type': 'application/json',
    },
    tags: { operation: 'scan' },
    timeout: '15s',
  })
  let responseBody = {}
  try {
    responseBody = response.json() || {}
  } catch {
    responseBody = {}
  }
  const acceptedWithoutReview = ['present', 'late'].includes(responseBody.status)
  acceptedAttendance.add(acceptedWithoutReview)

  k6Check(response, {
    'attendance scan is recorded': (result) => result.status === 200 || result.status === 201,
    'attendance scan returns a record id': () => Boolean(responseBody.id),
    'attendance scan is accepted without review': () => acceptedWithoutReview,
  })
}

export const handleSummary = (data) => {
  const output = __ENV.K6_SUMMARY_EXPORT
  if (!output) return { stdout: JSON.stringify(data.metrics, null, 2) }
  return { stdout: JSON.stringify(data.metrics, null, 2), [output]: JSON.stringify(data, null, 2) }
}
