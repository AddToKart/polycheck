import { test, expect } from '@playwright/test'
import {
  ADMIN_EMAIL,
  FACULTY_EMAIL,
  apiLogout,
  attemptStudentLogin,
  loginFaculty,
  loginStudent,
  logout,
  trackErrors,
  assertNoErrors,
  SEED_PASSWORD,
  installSessionCleanup,
} from './helpers'

installSessionCleanup()

test.describe('Auth & Session', () => {
  test('landing page renders PUP branding and role selection', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Polycheck.' })).toBeVisible()
    await expect(page.getByText('Polytechnic University of the Philippines • Attendance System')).toBeVisible()
    await expect(page.getByAltText('PUP Logo').first()).toBeVisible()
    // Role selection cards are <button>s
    await expect(page.getByRole('button', { name: /Student Portal/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Faculty Portal/i })).toBeVisible()
    assertNoErrors(errors)
  })

  test('landing role cards navigate to correct login pages', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Student Portal/i }).click()
    await page.waitForURL((url) => url.pathname === '/login/student')
    await expect(page.getByText('Student Access')).toBeVisible()

    await page.goto('/')
    await page.getByRole('button', { name: /Faculty Portal/i }).click()
    await page.waitForURL((url) => url.pathname === '/login/faculty')
    await expect(page.getByText('Faculty Portal')).toBeVisible()
  })

  test('faculty login succeeds and lands on dashboard', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page)
    await expect(page).toHaveURL((url) => url.pathname === '/faculty')
    await expect(page.getByText('Faculty Dashboard')).toBeVisible()
    assertNoErrors(errors)
  })

  test('student login succeeds and lands on dashboard', async ({ page }) => {
    const errors = trackErrors(page)
    await loginStudent(page)
    await expect(page.getByText(/Dashboard|Welcome/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('invalid credentials show error and stay on login', async ({ page }) => {
    let status: number | undefined
    // A pre-hydration click can be swallowed on slower engines, so retry the
    // submission until the login request is actually observed.
    for (let attempt = 0; attempt < 3 && status === undefined; attempt++) {
      await page.goto('/login/faculty')
      await page.getByLabel('Email Address').fill('jmdelacruz@pup.edu.ph')
      await page.getByLabel('Password').fill('WrongPassword123!')
      const authenticate = page.getByRole('button', { name: /Authenticate/i })
      await expect(authenticate).toBeEnabled()
      const loginResponse = page
        .waitForResponse(
          (response) => response.url().includes('/api/auth/login/faculty') && response.request().method() === 'POST',
          { timeout: 20_000 },
        )
        .catch(() => null)
      await authenticate.click()
      const response = await loginResponse
      if (response) status = response.status()
    }
    expect(status).toBe(401)
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible()
    await expect(page).toHaveURL((url) => url.pathname === '/login/faculty')
  })

  test('unauthenticated users are bounced from protected routes', async ({ page }) => {
    await page.goto('/faculty')
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 20_000 })
    await page.goto('/student/dashboard')
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 20_000 })
  })

  test('logout returns to landing page', async ({ page }) => {
    await loginFaculty(page)
    await page.getByRole('button', { name: /Disconnect/i }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 20_000 })
    // Next's route announcer also carries the page title; target the heading.
    await expect(page.getByRole('heading', { name: 'Polycheck.' })).toBeVisible()
  })

  test('session persists across reload (cookie auth)', async ({ page }) => {
    await loginFaculty(page)
    await page.reload()
    await expect(page).toHaveURL((url) => url.pathname === '/faculty', { timeout: 20_000 })
    await expect(page.getByText('Faculty Dashboard')).toBeVisible()
  })

  test('re-login from an already signed-in browser does not bounce the fresh session', async ({ page }) => {
    // One Playwright test shares cookies + localStorage, mirroring a real
    // persistent profile: the first login leaves a valid session, and the
    // second login POST replaces it *while the root-layout session monitor is
    // connected* to the user realtime room.
    const errors = trackErrors(page)
    await loginFaculty(page)
    await expect(page).toHaveURL((url) => url.pathname === '/faculty')

    // Go back to the landing page and open the faculty login again WITHOUT
    // logging out first — the exact "user logs in again" flow.
    await page.goto('/')
    await page.getByRole('button', { name: /Faculty Portal/i }).click()
    await page.waitForURL((url) => url.pathname === '/login/faculty')
    // Give the root-layout session monitor time to connect its socket (the
    // race window that used to swallow the fresh login).
    await page.waitForTimeout(1_500)

    await page.getByLabel('Email Address').fill(FACULTY_EMAIL)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    const loginResponse = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login/faculty') && r.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await page.getByRole('button', { name: /Authenticate/i }).click()
    const response = await loginResponse
    // The bounce can navigate away before the body is readable; status alone proves the server accepted the credentials.
    let responseText = ''
    try {
      responseText = await response.text()
    } catch {
      // Navigation raced the body read — this itself signals the bounce defect.
    }
    expect(response.status(), responseText).toBe(201)

    // The login must complete: land on the dashboard (not bounced back to the
    // landing page by a self-addressed session-replacement event).
    await expect(page).toHaveURL((url) => url.pathname === '/faculty', { timeout: 20_000 })
    await expect(page.getByText('Faculty Dashboard')).toBeVisible()
    assertNoErrors(errors)
  })


  test('faculty can be signed in on two browsers simultaneously (staff multi-session)', async ({ browser }) => {
    // Staff logins must not revoke sibling sessions: a teacher's mobile app
    // and web dashboard coexist. Two fresh contexts act as two devices.
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    const errorsA = trackErrors(pageA)

    await loginFaculty(pageA)
    await expect(pageA).toHaveURL((url) => url.pathname === '/faculty')
    await loginFaculty(pageB)
    await expect(pageB).toHaveURL((url) => url.pathname === '/faculty')

    // The second login must not eject the first device: no reason:
    // new_login replacement broadcast exists for staff anymore.
    await pageA.waitForTimeout(2_000)
    await expect(pageA).toHaveURL((url) => url.pathname === '/faculty', { timeout: 20_000 })
    await expect(pageA.getByText('Faculty Dashboard')).toBeVisible()
    assertNoErrors(errorsA)
  })

  test('student second-device login is rejected while the first device stays signed in', async ({ browser }) => {
    // Single-device policy: the server gate rejects a login from a different
    // device with an explainer, and the active device is never kicked. Two
    // fresh contexts act as two separate devices (each gets its own `web-…` id).
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    const errorsA = trackErrors(pageA)
    const errorsB = trackErrors(pageB)

    try {
      await loginStudent(pageA)
      await expect(pageA.getByText(/Dashboard|Welcome/i).first()).toBeVisible()

      const blocked = await attemptStudentLogin(pageB)
      expect(blocked.status()).toBe(403)
      const body = (await blocked.json()) as { code?: string }
      expect(body.code).toBe('active_session_elsewhere')
      await expect(
        pageB.getByRole('heading', { name: /Already signed in elsewhere/i }),
      ).toBeVisible()
      await expect(pageB).toHaveURL((url) => url.pathname === '/login/student')

      // The first device is untouched: a protected page reload still works and
      // there is no replacement kick/broadcast.
      await pageA.reload()
      await expect(pageA).toHaveURL((url) => url.pathname.startsWith('/student/'))
      await expect(pageA.getByText(/Dashboard|Welcome/i).first()).toBeVisible()

      assertNoErrors(errorsA)
      assertNoErrors(errorsB, [
        /\[console\.error\] Failed to load resource: the server responded with a status of 403/,
      ])
    } finally {
      // Custom contexts bypass the suite-wide afterEach: revoke the live
      // session non-armingly so the next student test is not blocked.
      await apiLogout(pageA.request).catch(() => undefined)
      await contextA.close()
      await contextB.close()
    }
  })

  test('super admin login reaches admin dashboard', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page, 'mcreyes@pup.edu.ph')
    await expect(page.getByText('System Administration')).toBeVisible()
    await expect(page.getByText('Super Administrator')).toBeVisible()
    assertNoErrors(errors)
  })

  test('super admin sidebar exposes the administration console only', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page, ADMIN_EMAIL)

    const navLinks = page.locator('aside nav').getByRole('link')
    await expect(navLinks).toHaveText([
      'Dashboard',
      'User Management',
      'System Reports',
      'Audit Log',
      'Server Status',
      'Assistant',
      'Institution Settings',
      'Profile',
      'Global Search',
    ])
    for (const classroomLabel of [
      'Subject Directory',
      'Session Monitoring',
      'Attendance Monitoring',
      'Dispute Monitoring',
      'Schedule',
    ]) {
      await expect(navLinks.filter({ hasText: classroomLabel })).toHaveCount(0)
    }
    assertNoErrors(errors)
  })

  test('super admin sees the live server status page', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page, ADMIN_EMAIL)
    await page.goto('/faculty/server-status')

    await expect(page.getByRole('heading', { name: 'Server Status' })).toBeVisible()
    await expect(page.getByText(/this backend instance/i).first()).toBeVisible()
    await expect(page.getByRole('status')).toContainText(/Live|Connecting|Reconnecting/, { timeout: 20_000 })
    await expect(page.getByText('HTTP request rate')).toBeVisible()
    assertNoErrors(errors, [/WebSocket connection/i, /websocket/i, /socket/i])
  })

  test('teachers cannot reach the server status console', async ({ page }) => {
    await loginFaculty(page)
    await page.goto('/faculty/server-status')
    await expect(page).toHaveURL((url) => url.pathname === '/faculty', { timeout: 20_000 })
  })

  test('students cannot reach the server status console', async ({ page }) => {
    await loginStudent(page)
    await page.goto('/faculty/server-status')
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 20_000 })
  })

  test('password field has a working visibility toggle', async ({ page }) => {
    await page.goto('/login/faculty')
    const password = page.getByLabel('Password')
    await password.fill('PolycheckLocal1!')
    await expect(password).toHaveAttribute('type', 'password')
    const toggle = page.locator('button').filter({ has: page.locator('.lucide-eye, .lucide-eye-off') })
    await toggle.click()
    await expect(password).toHaveAttribute('type', 'text')
    await toggle.click()
    await expect(password).toHaveAttribute('type', 'password')
  })

  test('students are bounced from the faculty portal', async ({ page }) => {
    await loginStudent(page)
    await page.goto('/faculty')
    // Faculty layout replaces with the landing page for non-faculty roles
    await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 20_000 })
  })

  test('teachers cannot reach super-admin-only user management', async ({ page }) => {
    await loginFaculty(page)
    await page.goto('/faculty/users')
    // Users page is super_admin-only; teacher is redirected back to /faculty
    await expect(page).toHaveURL((url) => url.pathname === '/faculty', { timeout: 20_000 })
  })
})
