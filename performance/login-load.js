import http from 'k6/http'
import { check, fail } from 'k6'
import exec from 'k6/execution'
import { SharedArray } from 'k6/data'

const fixture = __ENV.K6_FIXTURE_FILE ? JSON.parse(open(__ENV.K6_FIXTURE_FILE)) : {}
const credentials = new SharedArray('dedicated login credentials', () => fixture.credentials || [])
const count = __ENV.K6_PROFILE === 'full' ? 1000 : 2
export const options = {
  scenarios: { login_burst: { executor: 'per-vu-iterations', vus: count, iterations: 1, maxDuration: '2m' } },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    iterations: [`count==${count}`],
  },
}
export const setup = () => {
  if (__ENV.K6_ALLOW_REMOTE_TARGET !== 'I_ACKNOWLEDGE_THIS_WRITES_ATTENDANCE_DATA') fail('Explicit staging authorization is required')
  if (count === 1000 && __ENV.K6_CONFIRM_1000_USERS !== 'I_HAVE_AUTHORIZATION_FOR_1000_USERS') fail('Full-profile authorization is required')
  if (!fixture.BASE_URL?.startsWith('https://')) fail('HTTPS staging is required')
  if (credentials.length < count || new Set(credentials.map((item) => item.studentId)).size < count) fail('Distinct dedicated accounts are required')
  return { baseUrl: fixture.BASE_URL }
}
export default function login(config) {
  const response = http.post(`${config.baseUrl}/api/auth/mobile/login/student`, JSON.stringify(credentials[exec.scenario.iterationInTest]), { headers: { 'Content-Type': 'application/json' }, timeout: '15s' })
  check(response, { 'login issues an authenticated session': (result) => result.status === 201 && Boolean(result.json('token')) })
}
export const handleSummary = (data) => ({
  stdout: JSON.stringify(data.metrics, null, 2),
  ...(__ENV.K6_SUMMARY_EXPORT ? { [__ENV.K6_SUMMARY_EXPORT]: JSON.stringify(data, null, 2) } : {}),
})
