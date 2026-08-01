import { expect, Page } from '@playwright/test'

export const SEED_PASSWORD = 'PolycheckLocal1!'

export const FACULTY_EMAIL = 'jmdelacruz@pup.edu.ph'
export const ADMIN_EMAIL = 'mcreyes@pup.edu.ph'
export const STUDENT_ID = '2024-00001-MN-0'
export const STUDENT_EMAIL = 'amreyes@iskolar.pup.edu.ph'

/** Collect console errors + page errors for runtime regression detection. */
export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))
  return errors
}

/** Assert no unexpected client-side errors were recorded (allow favicon/network noise). */
export function assertNoErrors(errors: string[]) {
  const meaningful = errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_FAILED') &&
      !e.includes('Failed to load resource') &&
      !e.includes('404 (Not Found)') &&
      // Dev-mode-only noise: next-themes ThemeScript nonce differs between SSR and
      // client under Turbopack dev + CSP nonce middleware. Not present in the
      // production build, so ignore it for E2E purposes.
      !e.includes('hydration'),
  )
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
    // Wait for the actual login API round-trip so a pre-hydration click cannot race the SPA
    const loginResponse = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login/faculty') && r.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await page.getByRole('button', { name: /Authenticate/i }).click()
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
    const loginResponse = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login/student') && r.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await page.getByRole('button', { name: /Authenticate/i }).click()
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

/**
 * Create a fresh session via the API using the page's auth cookie (shares the
 * browser context's cookie jar). Used to test session activation flows without
 * mutating seed sessions — each run gets its own disposable session.
 */
export async function createDisposableSession(
  page: Page,
  opts: { sectionId?: string; subjectName?: string; daysFromNow?: number } = {},
) {
  const { sectionId = 'sec-001', subjectName = 'Software Engineering' } = opts
  let daysFromNow = opts.daysFromNow ?? 10
  // Sessions persist after tests end, so bump the date until the backend accepts it
  for (let attempt = 0; attempt < 30; attempt++) {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    const res = await page.request.post('http://localhost:4000/api/sessions', {
      data: {
        sectionId,
        subjectName,
        date: date.toISOString().slice(0, 10),
        startTime: '09:00',
        endTime: '10:30',
        geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
      },
    })
    if (res.ok()) {
      const session = (await res.json()) as { id: string }
      return session.id
    }
    if (res.status() === 409) {
      daysFromNow++
      continue
    }
    throw new Error(`createDisposableSession failed: ${res.status()} ${await res.text()}`)
  }
  throw new Error('createDisposableSession failed: could not find a free date after 30 attempts')
}
