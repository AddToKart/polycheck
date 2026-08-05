const rawBaseUrl = process.env.STAGING_BASE_URL?.trim()

if (!rawBaseUrl) throw new Error('STAGING_BASE_URL is required')

const baseUrl = new URL(rawBaseUrl)
if (baseUrl.protocol !== 'https:') throw new Error('STAGING_BASE_URL must use HTTPS')
if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
  throw new Error('STAGING_BASE_URL must not contain credentials, a query string, or a fragment')
}

const request = async (path) => {
  const url = new URL(path, baseUrl)
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'user-agent': 'polycheck-staging-smoke/1.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  if (new URL(response.url).origin !== baseUrl.origin) throw new Error(`${path} redirected outside the staging origin`)
  return response
}

const readJson = async (path) => {
  const response = await request(path)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) throw new Error(`${path} did not return JSON`)
  return { response, body: await response.json() }
}

const ready = await readJson('/healthz')
if (ready.body.status !== 'ok') throw new Error('/healthz did not report status=ok')
for (const dependency of ['database', 'redis', 'bullmqProducer', 'bullmqEvents', 'bullmqWorker']) {
  if (ready.body.checks?.[dependency] !== 'ok') throw new Error(`/healthz dependency ${dependency} is not ready`)
}

const liveness = await readJson('/api/health')
if (liveness.body.status !== 'ok') throw new Error('/api/health did not report status=ok')

const privacy = await readJson('/api/auth/privacy-notice')
if (typeof privacy.body.version !== 'string' || !privacy.body.version) throw new Error('Privacy notice version is missing')
if (typeof privacy.body.url !== 'string' || !privacy.body.url.startsWith('https://')) throw new Error('Privacy notice URL is not HTTPS')

const login = await request('/login')
const loginHtml = await login.text()
if (!loginHtml.toLowerCase().includes('polycheck')) throw new Error('/login did not render the Polycheck application')

const requiredHeaders = {
  'content-security-policy': login.headers.get('content-security-policy'),
  'strict-transport-security': login.headers.get('strict-transport-security'),
  'x-content-type-options': login.headers.get('x-content-type-options'),
}
for (const [header, value] of Object.entries(requiredHeaders)) {
  if (!value) throw new Error(`/login is missing required security header ${header}`)
}

console.log(JSON.stringify({
  baseUrl: baseUrl.origin,
  status: 'ok',
  privacyNoticeVersion: privacy.body.version,
  checks: ['readiness', 'liveness', 'privacy-notice', 'frontend', 'security-headers'],
}, null, 2))
