import { expect, Page, type APIRequestContext } from '@playwright/test'

export const API_BASE = 'http://localhost:4000/api'

export const SEED_PASSWORD = 'PolycheckLocal1!'

export const FACULTY_EMAIL = 'jmdelacruz@pup.edu.ph'
export const ADMIN_EMAIL = 'mcreyes@pup.edu.ph'
export const STUDENT_ID = '2024-00001-MN-0'
export const STUDENT_EMAIL = 'amreyes@iskolar.pup.edu.ph'

/** PUP campus (Asia/Manila, UTC+8) calendar date, matching shared `formatCampusDate`. */
export function campusDate(daysAgo = 0): string {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

/**
 * Authenticate an isolated API context. Tests must never share an account's
 * browser cookie and API cookie: single-active-session enforcement invalidates
 * the older session. Use `request`/`pwRequest.newContext()` for setup when the
 * page will later log in as the same account.
 */
export async function apiLoginFaculty(request: APIRequestContext, email = FACULTY_EMAIL) {
  const response = await request.post(`${API_BASE}/auth/login/faculty`, {
    data: { email, password: SEED_PASSWORD },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

export async function apiLoginStudent(request: APIRequestContext, studentId = STUDENT_ID) {
  const response = await request.post(`${API_BASE}/auth/login/student`, {
    data: { studentId, password: SEED_PASSWORD },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

interface TrackedError {
  message: string
  at: number
}

interface ErrorTracker {
  entries: TrackedError[]
  cancellationWindows: Array<{ start: number; end: number }>
}

const trackers = new WeakMap<string[], ErrorTracker>()
const CANCELLATION_WINDOW_MS = 3_000
const CANCELLATION_WINDOW_LEAD_MS = 1_000
const CANCELLABLE_RESOURCE_TYPES = new Set(['document', 'script', 'fetch', 'xhr'])

/**
 * Requests cancelled by navigation, unmount, or prefetch are reported as page
 * errors by Firefox and WebKit even though the application intentionally
 * abandoned them. These messages are also used for genuine network/CORS
 * failures, so they are only ignored inside a navigation/aborted-request
 * window; the same error outside that window still fails the test.
 */
const CANCELLATION_SHAPED_ERRORS = [
  /^\[pageerror\] NetworkError when attempting to fetch resource\.$/, // Firefox
  /^\[pageerror\] TypeError: Load failed$/, // WebKit
  /^\[pageerror\] Failed to fetch$/, // Chromium
  /due to access control checks\.$/, // WebKit cancelled fetch (RSC/API)
]

/**
 * Firefox reports Zod's JIT feature probe as a CSP eval violation even though
 * the probe failure is caught and the jitless parser is used (the app configures
 * `z.jitless`). This exact message is browser noise, not an app regression.
 */
const KNOWN_BROWSER_NOISE = [
  /^\[console\.error\] \[JavaScript Error: "Content-Security-Policy: The page’s settings blocked a JavaScript eval \(script-src\)/,
  /^\[console\.error\] \[JavaScript Error: "Content-Security-Policy: The page's settings blocked a JavaScript eval \(script-src\)/,
]

function markCancellationWindow(tracker: ErrorTracker) {
  const now = Date.now()
  tracker.cancellationWindows.push({
    start: now - CANCELLATION_WINDOW_LEAD_MS,
    end: now + CANCELLATION_WINDOW_MS,
  })
}

/** Collect console errors + page errors for runtime regression detection. */
export function trackErrors(page: Page) {
  const errors: string[] = []
  const tracker: ErrorTracker = { entries: [], cancellationWindows: [] }
  trackers.set(errors, tracker)

  const record = (message: string) => {
    tracker.entries.push({ message, at: Date.now() })
    errors.push(message)
  }

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) markCancellationWindow(tracker)
  })
  page.on('requestfailed', (request) => {
    if (!CANCELLABLE_RESOURCE_TYPES.has(request.resourceType())) return
    const failure = request.failure()?.errorText ?? ''
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled|canceled/i.test(failure)) {
      markCancellationWindow(tracker)
    }
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') record(`[console.error] ${msg.text()}`)
  })
  page.on('pageerror', (err) => record(`[pageerror] ${err.message}`))
  return errors
}

/** Assert no unexpected client-side errors were recorded. */
export function assertNoErrors(errors: string[], allowedPatterns: RegExp[] = []) {
  const tracker = trackers.get(errors)
  const meaningful = errors.filter((error, index) => {
    // Tests may intentionally trigger a server rejection; callers opt in to
    // the exact console shape they expect to see.
    if (allowedPatterns.some((pattern) => pattern.test(error))) return false
    // Browsers may request a missing favicon independently of app runtime.
    if (error.includes('favicon')) return false
    if (KNOWN_BROWSER_NOISE.some((pattern) => pattern.test(error))) return false
    if (!CANCELLATION_SHAPED_ERRORS.some((pattern) => pattern.test(error))) return true

    const entry = tracker?.entries[index]
    if (!entry) return true
    const cancelledDuringNavigation = tracker.cancellationWindows.some(
      ({ start, end }) => entry.at >= start && entry.at <= end,
    )
    return !cancelledDuringNavigation
  })
  expect(meaningful).toEqual([])
}

/** Wait until pathname is exactly the post-login route (avoids matching /login/faculty). */
export async function waitForPath(page: Page, pathname: string, timeout = 20_000) {
  await page.waitForURL((url) => url.pathname === pathname, { timeout })
}

/**
 * Hide the Next.js dev overlay portal. Under `next dev` (Turbopack) the overlay
 * element can sit above the page and intercept pointer events (e.g. on sidebar
 * buttons). It does not exist in production builds.
 */
export async function hideDevOverlay(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
}

export async function loginFaculty(page: Page, email = FACULTY_EMAIL) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('/login/faculty')
    await page.getByLabel('Email Address').fill(email)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    const authenticate = page.getByRole('button', { name: /Authenticate/i })
    await expect(authenticate).toBeEnabled()
    // Wait for the actual login API round-trip so a pre-hydration click cannot race the SPA
    const loginResponse = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login/faculty') && r.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await authenticate.click()
    const response = await loginResponse.catch(() => null)
    if (response?.ok()) {
      await waitForPath(page, '/faculty')
      break
    }
  }
  await waitForPath(page, '/faculty')
  await hideDevOverlay(page)
  // Brand renders in the desktop sidebar (h1) or the mobile top header (span).
  // Both can exist in the DOM simultaneously, so filter to the visible one.
  const brand = page
    .locator('h1:has-text("Polycheck"), span:has-text("Polycheck")')
    .filter({ visible: true })
    .first()
  await expect(brand).toBeVisible({ timeout: 20_000 })
}

export async function loginStudent(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('/login/student')
    await page.getByLabel('Student Number').fill(STUDENT_ID)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    const authenticate = page.getByRole('button', { name: /Authenticate/i })
    await expect(authenticate).toBeEnabled()
    const loginResponse = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login/student') && r.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await authenticate.click()
    const response = await loginResponse.catch(() => null)
    if (response?.ok()) {
      await page.waitForURL((url) => url.pathname.startsWith('/student/'), { timeout: 20_000 })
      await hideDevOverlay(page)
      return
    }
  }
  throw new Error('Student login failed after 3 attempts')
}

export async function logout(page: Page) {
  // Logout button in the sidebar is labelled "Disconnect"
  const logoutBtn = page.getByRole('button', { name: /Disconnect/i })
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click()
  }
  await waitForPath(page, '/').catch(() => {})
}

export async function gotoSectionDetail(page: Page, sectionId: string) {
  await page.goto(`/faculty/sections/${sectionId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `e2e-shots/${name}.png`, fullPage: true })
}

interface SessionSeedOptions {
  sectionId?: string
  subjectName?: string
  startTime?: string
  endTime?: string
}

async function postSession(
  request: APIRequestContext,
  data: { sectionId: string; subjectName: string; date: string; startTime: string; endTime: string },
) {
  return request.post(`${API_BASE}/sessions`, {
    data: {
      ...data,
      geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
    },
  })
}

/**
 * Create a fresh future session via an authenticated API context. Used to test
 * workflows without mutating seed sessions — each run gets its own disposable
 * session. Sessions persist after tests end, so bump the date until accepted.
 */
export async function createFutureSession(
  request: APIRequestContext,
  opts: SessionSeedOptions & { daysFromNow?: number } = {},
) {
  const {
    sectionId = 'sec-001',
    subjectName = 'Software Engineering',
    startTime = '09:00',
    endTime = '10:30',
  } = opts
  let daysFromNow = opts.daysFromNow ?? 10
  for (let attempt = 0; attempt < 365; attempt++) {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    const res = await postSession(request, {
      sectionId,
      subjectName,
      date: date.toISOString().slice(0, 10),
      startTime,
      endTime,
    })
    if (res.ok()) {
      const session = (await res.json()) as { id: string }
      return session.id
    }
    if (res.status() === 409) {
      daysFromNow++
      continue
    }
    throw new Error(`createFutureSession failed: ${res.status()} ${await res.text()}`)
  }
  throw new Error('createFutureSession failed: could not find a free date within one year')
}

/**
 * Create a session dated inside the attendance report's default 30-day window
 * (today .. 29 days ago). Used when a journey must render recent report totals
 * regardless of whether the local database has smoke-test data.
 */
export async function createRecentSession(request: APIRequestContext, opts: SessionSeedOptions = {}) {
  const {
    sectionId = 'sec-001',
    subjectName = 'Software Engineering',
    startTime = '14:00',
    endTime = '15:30',
  } = opts
  const timeSlots = [
    [startTime, endTime],
    ['16:00', '17:30'],
    ['07:00', '08:30'],
  ] as const
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    for (const [slotStart, slotEnd] of timeSlots) {
      const res = await postSession(request, {
        sectionId,
        subjectName,
        date: campusDate(daysAgo),
        startTime: slotStart,
        endTime: slotEnd,
      })
      if (res.ok()) {
        const session = (await res.json()) as { id: string }
        return session.id
      }
      if (res.status() !== 409) {
        throw new Error(`createRecentSession failed: ${res.status()} ${await res.text()}`)
      }
    }
  }
  throw new Error('createRecentSession failed: could not find a free recent date/time slot')
}

/** Create (or upsert) a manual attendance record for a section student. */
export async function createManualAttendance(
  request: APIRequestContext,
  input: { sessionId: string; sectionId?: string; studentId?: string; status: string },
) {
  const { sessionId, sectionId = 'sec-001', studentId = 's-001', status } = input
  const res = await request.post(`${API_BASE}/attendance`, {
    data: { sessionId, sectionId, studentId, status },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()) as { id: string; status: string }
}

/** Page-bound convenience wrapper for specs that already logged in as faculty. */
export async function createDisposableSession(
  page: Page,
  opts: { sectionId?: string; subjectName?: string; daysFromNow?: number } = {},
) {
  return createFutureSession(page.request, opts)
}
