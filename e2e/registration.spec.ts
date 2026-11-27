import { test, expect, type Page } from '@playwright/test'
import {
  ADMIN_EMAIL,
  API_BASE,
  loginFaculty,
  revokeBrowserSession,
  installSessionCleanup,
} from './helpers'

installSessionCleanup()

/**
 * Temporary sign-up: closed by default, requests never create accounts, a super admin approves them, and the
 * approved people sign in with the password they chose. When the landing page (its own repository) is served on
 * :3100, the requests are made through its real form, from a different origin; otherwise through the public API.
 */
const LANDING = 'http://localhost:3100'
const PASSWORD = 'Sign-Up-Pass-2026!'
const ORIGIN = { origin: 'http://localhost:3000' }

async function fitsPhone(page: Page, name: string) {
  const size = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 700 })
  await page.waitForTimeout(600)
  const width = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))
  expect(width, `${name} scrolls sideways on a 320px phone`).toBeLessThanOrEqual(321)
  await page.screenshot({ path: `e2e/captures/registration/${name}.png`, fullPage: true })
  await page.setViewportSize(size)
}

test.describe('Temporary sign-up', () => {
  test('a request becomes an account only after a super admin approves it', async ({ page, browserName, browser, playwright }) => {
    test.skip(browserName !== 'chromium', 'One browser is enough for this journey')
    test.setTimeout(240_000)
    const suffix = String(Math.floor(10000 + Math.random() * 89999))
    const student = { name: `E2E Signup Student ${suffix}`, number: `2026-${suffix}-SM-0`, email: `signup-student-${suffix}@example.test` }
    const teacher = { name: `E2E Signup Teacher ${suffix}`, email: `signup-teacher-${suffix}@example.test` }
    const visitor = await playwright.request.newContext()
    const landingUp = await visitor
      .get(`${LANDING}/register`, { timeout: 3_000 })
      .then((response) => response.ok())
      .catch(() => false)

    await loginFaculty(page, ADMIN_EMAIL)
    await page.request.put(`${API_BASE}/settings/registration_enabled`, { headers: ORIGIN, data: { value: 'false' } })

    try {
      // ---------- closed by default
      const refused = await visitor.post(`${API_BASE}/registrations/public`, {
        data: { role: 'teacher', fullName: teacher.name, email: teacher.email, password: PASSWORD, consent: true },
      })
      expect(refused.status()).toBe(403)
      const landingContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
      const landing = await landingContext.newPage()
      if (landingUp) {
        await landing.goto(`${LANDING}/register`)
        await expect(landing.getByRole('heading', { name: 'Sign-up is closed' })).toBeVisible({ timeout: 20_000 })
      }

      // The login pages offer no sign-up while it is closed, and no activation link.
      await landing.goto('http://localhost:3000/login/student')
      await expect(landing.getByRole('link', { name: 'Forgot password?' })).toBeVisible({ timeout: 20_000 })
      await expect(landing.getByRole('link', { name: 'Activate your account' })).toHaveCount(0)
      await expect(landing.getByRole('link', { name: 'Sign up' })).toHaveCount(0)

      // ---------- the admin opens it on the real screen
      await page.goto('/faculty/users')
      await page.getByRole('link', { name: 'Sign-up requests' }).click()
      await expect(page.getByText('Sign-up is closed')).toBeVisible()
      await page.getByRole('button', { name: 'Open sign-up' }).click()
      await expect(page.getByText('Sign-up is open')).toBeVisible()

      // ---------- both login pages now lead to the landing page form
      for (const login of ['student', 'faculty']) {
        await landing.goto(`http://localhost:3000/login/${login}`)
        const button = landing.getByRole('link', { name: 'Sign up' })
        await expect(button).toBeVisible({ timeout: 20_000 })
        expect(await button.getAttribute('href')).toMatch(/\/register$/)
        await landing.setViewportSize({ width: 320, height: 700 })
        const scroll = await landing.evaluate(() => document.documentElement.scrollWidth)
        expect(scroll, `${login} login scrolls sideways at 320px`).toBeLessThanOrEqual(321)
        await landing.screenshot({ path: `e2e/captures/registration/login-${login}.png`, fullPage: true })
        await landing.setViewportSize({ width: 390, height: 844 })
      }

      // ---------- a student and a teacher send requests
      if (landingUp) {
        const consoleErrors: string[] = []
        landing.on('console', (message) => {
          if (message.type() === 'error') consoleErrors.push(message.text())
        })
        await landing.goto(LANDING)
        await expect(landing.getByRole('link', { name: 'Sign up for an account' })).toBeVisible({ timeout: 20_000 })
        await landing.getByRole('link', { name: 'Sign up for an account' }).click()

        await landing.getByRole('button', { name: 'Send request' }).click()
        await expect(landing.getByRole('alert').filter({ hasText: 'Enter your full name' })).toBeVisible()
        await landing.getByLabel('Full name').fill(student.name)
        await landing.getByLabel('Student number').fill(student.number.toLowerCase())
        await landing.getByLabel('Program').selectOption('BSIT')
        await landing.getByLabel('Year level').selectOption('2')
        await landing.getByLabel('Email').fill(student.email)
        await landing.getByLabel('Password', { exact: true }).fill(PASSWORD)
        await landing.getByLabel('Confirm password').fill(PASSWORD)
        await landing.getByRole('checkbox').check()
        // The message about the empty form is gone once it is being fixed.
        await expect(landing.getByRole('alert').filter({ hasText: 'Enter your full name' })).toHaveCount(0)
        for (const width of [320, 390]) {
          await landing.setViewportSize({ width, height: 800 })
          const scroll = await landing.evaluate(() => document.documentElement.scrollWidth)
          expect(scroll, `the form scrolls sideways at ${width}px`).toBeLessThanOrEqual(width + 1)
        }
        await landing.screenshot({ path: 'e2e/captures/registration/landing-form.png', fullPage: true })
        await landing.getByRole('button', { name: 'Send request' }).click()
        await expect(landing.getByRole('heading', { name: 'Request sent' })).toBeVisible({ timeout: 30_000 })

        await landing.getByRole('button', { name: 'Send another request' }).click()
        await landing.getByText('Teacher', { exact: true }).click()
        await expect(landing.getByLabel('Student number')).toHaveCount(0)
        await landing.getByLabel('Full name').fill(teacher.name)
        await landing.getByLabel('Email').fill(teacher.email)
        await landing.getByLabel('Password', { exact: true }).fill(PASSWORD)
        await landing.getByLabel('Confirm password').fill(PASSWORD)
        await landing.getByRole('checkbox').check()
        await landing.getByRole('button', { name: 'Send request' }).click()
        await expect(landing.getByRole('heading', { name: 'Request sent' })).toBeVisible({ timeout: 30_000 })
        expect(consoleErrors, 'the landing page logged errors').toEqual([])
      } else {
        for (const data of [
          { role: 'student', fullName: student.name, studentId: student.number, program: 'BSIT', yearLevel: 2, email: student.email },
          { role: 'teacher', fullName: teacher.name, email: teacher.email },
        ]) {
          const sent = await visitor.post(`${API_BASE}/registrations/public`, { data: { ...data, password: PASSWORD, consent: true } })
          expect(sent.ok(), await sent.text()).toBeTruthy()
        }
      }
      console.log(`landing page form checked: ${landingUp}`)

      // ---------- nothing is an account yet
      const early = await visitor.post(`${API_BASE}/auth/login/faculty`, {
        headers: ORIGIN,
        data: { email: teacher.email, password: PASSWORD },
      })
      expect(early.ok()).toBeFalsy()
      expect((await visitor.get(`${API_BASE}/registrations`)).status()).toBe(401)

      // ---------- the admin approves: students in bulk, the teacher on their own
      await page.getByRole('button', { name: 'Refresh' }).click()
      await expect(page.getByText(student.name)).toBeVisible()
      await fitsPhone(page, 'admin-requests')
      await page.setViewportSize({ width: 320, height: 700 })
      const nameBox = await page.getByText(student.name).boundingBox()
      expect(nameBox!.width, 'the name is squeezed into a narrow column on phones').toBeGreaterThan(140)
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.getByLabel(`Select ${student.name}`).check()
      page.once('dialog', (dialog) => void dialog.accept())
      await page.getByRole('button', { name: 'Approve selected (1)' }).click()
      await expect(page.getByText(student.name)).toHaveCount(0, { timeout: 30_000 })

      await page.getByRole('button', { name: 'Teachers' }).click()
      const row = page.getByRole('listitem').filter({ hasText: teacher.email })
      let warned = ''
      page.once('dialog', (dialog) => {
        warned = dialog.message()
        void dialog.accept()
      })
      await row.getByRole('button', { name: 'Approve' }).click()
      await expect(row).toHaveCount(0, { timeout: 30_000 })
      expect(warned).toContain('can see student names and student numbers')

      await page.getByRole('button', { name: 'Approved' }).click()
      await expect(page.getByText(teacher.email)).toBeVisible()

      await page.getByRole('button', { name: 'Close sign-up' }).click()
      await expect(page.getByText('Sign-up is closed')).toBeVisible()

      // ---------- both sign in with the password they chose
      const asTeacher = await visitor.post(`${API_BASE}/auth/login/faculty`, {
        headers: ORIGIN,
        data: { email: teacher.email, password: PASSWORD },
      })
      expect(asTeacher.ok(), await asTeacher.text()).toBeTruthy()
      await visitor.post(`${API_BASE}/auth/logout`, { headers: ORIGIN, data: { armDeviceCooldown: false } })

      await revokeBrowserSession(page)
      await page.goto('/login/student')
      await page.getByLabel('Student Number').fill(student.number)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: /Authenticate/i }).click()
      await page.waitForURL((url) => url.pathname.startsWith('/student/'), { timeout: 30_000 })
      await landingContext.close()
    } finally {
      // Never leave sign-up open for other tests.
      const admin = await playwright.request.newContext()
      await admin.post(`${API_BASE}/auth/login/faculty`, {
        headers: ORIGIN,
        data: { email: ADMIN_EMAIL, password: 'PolycheckLocal1!' },
      })
      await admin.put(`${API_BASE}/settings/registration_enabled`, { headers: ORIGIN, data: { value: 'false' } })
      await admin.post(`${API_BASE}/auth/logout`, { headers: ORIGIN, data: {} })
      await admin.dispose()
      await visitor.dispose()
    }
  })
})
