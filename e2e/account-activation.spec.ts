import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { API_BASE, apiLoginFaculty, ADMIN_EMAIL, attemptStudentLogin, installSessionCleanup } from './helpers'

installSessionCleanup()

/**
 * Email activation journey (plan/master-list-import-and-activation-plan.md).
 *
 * Needs the local stack running with `MAIL_DRIVER=log` so the "email" lands in
 * the backend log. The suite skips itself otherwise, so it is safe in any
 * environment:
 *
 *   MAIL_DRIVER=log docker compose -f docker-compose.local.yml up -d --no-deps backend
 *
 * Disposable students (2098-…) are created per run and removed afterwards.
 */
test.use({ serviceWorkers: 'block' })

const REPO_ROOT = path.resolve(__dirname, '..')
const COMPOSE = ['compose', '-f', 'docker-compose.local.yml']
const NEW_PASSWORD = 'Brand-New#Pass2026'

function dockerLogs(sinceIso: string): string {
  try {
    return execFileSync('docker', [...COMPOSE, 'logs', 'backend', '--since', sinceIso, '--no-log-prefix'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch {
    return ''
  }
}

function psql(sql: string): string {
  try {
    return execFileSync(
      'docker',
      ['exec', 'polycheck-local-postgres-1', 'psql', '-U', 'polycheck', '-d', 'polycheck', '-t', '-A', '-c', sql],
      { encoding: 'utf8' },
    ).trim()
  } catch {
    return ''
  }
}

async function waitForActivationToken(sinceIso: string, knownTokens: string[] = []): Promise<string> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const tokens = [...dockerLogs(sinceIso).matchAll(/\/activate#token=([A-Za-z0-9_-]{43})/g)].map((m) => m[1])
    const fresh = tokens.filter((token) => !knownTokens.includes(token))
    if (fresh.length > 0) return fresh[fresh.length - 1]
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error('No activation email reached the log driver within 30 seconds')
}

async function setActivationSetting(request: APIRequestContext, enabled: boolean) {
  const response = await request.put(`${API_BASE}/settings/activation_email_enabled`, {
    data: { value: String(enabled) },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

test.describe('email account activation', () => {
  const suffix = String(Math.floor(Math.random() * 90_000) + 10_000)
  const studentId = `2098-${suffix}-MN-0`
  const email = `activation.${suffix}@example.com`
  let request: APIRequestContext
  let usable = false

  test.beforeAll(async () => {
    request = await pwRequest.newContext()
    await apiLoginFaculty(request, ADMIN_EMAIL)
    const status = await request.get(`${API_BASE}/users/activation/status`)
    usable = status.ok() && (await status.json()).driver === 'log'
    if (usable) await setActivationSetting(request, true)
  })

  test.afterAll(async () => {
    psql(`DELETE FROM "User" WHERE "studentId" LIKE '2098-%'`)
    if (usable) await setActivationSetting(request, false)
    await request.dispose()
  })

  test('a student activates from the emailed link on a phone and signs in with their own password', async ({ page }) => {
    test.skip(!usable, 'Run the backend with MAIL_DRIVER=log to exercise email activation')
    await page.setViewportSize({ width: 390, height: 844 })

    const rows = [{ rowNumber: 2, fullName: 'Activation E2E', studentId, program: 'BSIT', yearLevel: 1, email }]
    const since = new Date(Date.now() - 2_000).toISOString()
    const validation = await request.post(`${API_BASE}/users/students/import`, {
      data: { mode: 'validate', conflictMode: 'skip_existing', deliveryMode: 'activation_email', rows },
    })
    expect(validation.ok(), await validation.text()).toBeTruthy()
    const { rowChecksum } = await validation.json()
    const executed = await request.post(`${API_BASE}/users/students/import`, {
      data: { mode: 'execute', conflictMode: 'skip_existing', deliveryMode: 'activation_email', rowChecksum, rows },
    })
    expect(executed.ok(), await executed.text()).toBeTruthy()
    expect((await executed.json()).activation).toEqual({ queued: 1, fallbackTemporary: 0 })

    const token = await waitForActivationToken(since)

    // The link works on a phone viewport without horizontal scrolling.
    await page.goto(`/activate#token=${token}`)
    await expect(page.getByRole('heading', { name: 'Activate your account' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // The page must never leak its address (single-use token) through the Referer header.
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')

    // Wrong student number: rejected, form stays usable.
    await page.getByLabel('Student number').fill('2098-00000-MN-0')
    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByLabel('Confirm password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Activate account' }).click()
    // Next.js also renders a role=alert route announcer, so target the form's own message.
    await expect(page.locator('form [role="alert"]')).toContainText(/does not match this activation link/i)

    // Correct details (case-insensitive student number).
    await page.getByLabel('Student number').fill(studentId.toLowerCase())
    await page.getByRole('button', { name: 'Activate account' }).click()
    await expect(page.getByRole('heading', { name: 'Account activated' })).toBeVisible()

    // The used link is dead (reopening it from the email is a fresh page load).
    await page.reload()
    await expect(page.getByRole('heading', { name: 'This link is no longer valid' })).toBeVisible()

    // Sign in with the chosen password: no forced password change appears.
    const login = await attemptStudentLogin(page, { studentId, password: NEW_PASSWORD })
    expect(login.status()).toBeLessThan(300)
    await expect(page).toHaveURL(/\/student/, { timeout: 20_000 })
    await expect(page.getByText(/change your password|temporary password/i)).toHaveCount(0)
  })

  test('an expired link can be re-requested from the page, and only the new link works', async ({ page }) => {
    test.skip(!usable, 'Run the backend with MAIL_DRIVER=log to exercise email activation')
    const otherId = `2098-${String(Number(suffix) + 1).padStart(5, '0')}-MN-0`
    const otherEmail = `activation.${suffix}.b@example.com`
    const rows = [{ rowNumber: 2, fullName: 'Activation Expired', studentId: otherId, program: 'BSIT', yearLevel: 1, email: otherEmail }]
    const since = new Date(Date.now() - 2_000).toISOString()
    const validation = await request.post(`${API_BASE}/users/students/import`, {
      data: { mode: 'validate', conflictMode: 'skip_existing', deliveryMode: 'activation_email', rows },
    })
    const { rowChecksum } = await validation.json()
    const executed = await request.post(`${API_BASE}/users/students/import`, {
      data: { mode: 'execute', conflictMode: 'skip_existing', deliveryMode: 'activation_email', rowChecksum, rows },
    })
    expect(executed.ok(), await executed.text()).toBeTruthy()
    const firstToken = await waitForActivationToken(since)

    // Simulate expiry, as the campus would experience it after the link lifetime.
    psql(`UPDATE "AccountActivationToken" SET "expiresAt" = now() - interval '1 hour' WHERE "tokenHash" IS NOT NULL AND "userId" IN (SELECT id FROM "User" WHERE "studentId" = '${otherId}')`)

    await page.goto(`/activate#token=${firstToken}`)
    await expect(page.getByRole('heading', { name: 'This link is no longer valid' })).toBeVisible()

    // A wrong email gets the same answer and sends nothing.
    await page.getByLabel('Student number').fill(otherId)
    await page.getByLabel('Email on file').fill('someone.else@example.com')
    await page.getByRole('button', { name: 'Send me a new link' }).click()
    await expect(page.getByText(/If those details match an account/i)).toBeVisible()

    // The matching email produces a fresh link (the confirmation lets the student retry in place).
    await page.getByRole('button', { name: 'Use different details' }).click()
    const resendSince = new Date(Date.now() - 1_000).toISOString()
    await page.getByLabel('Student number').fill(otherId)
    await page.getByLabel('Email on file').fill(otherEmail)
    await page.getByRole('button', { name: 'Send me a new link' }).click()
    await expect(page.getByText(/If those details match an account/i)).toBeVisible()
    const newToken = await waitForActivationToken(resendSince, [firstToken])
    expect(newToken).not.toBe(firstToken)

    await page.goto(`/activate#token=${newToken}`)
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  })
})
