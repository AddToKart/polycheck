import { test, expect, type Browser } from '@playwright/test'
import {
  apiLoginFaculty,
  apiLogout,
  assertNoErrors,
  attemptStudentLogin,
  getWebDeviceId,
  loginStudent,
  releaseStudentDevice,
  trackErrors,
  installSessionCleanup,
} from './helpers'

installSessionCleanup()

// plan/device-integrity-login-plan.md §5, web-only adaptation (the Android leg
// is deferred). Service workers are blocked so the login round-trips are
// engine-consistent.
test.use({ serviceWorkers: 'block' })

/** Internal user id of the seeded student (`STUDENT_ID` is the student number). */
const STUDENT_USER_ID = 's-001'
const SECTION_ID = 'sec-001'

/**
 * A rejected student login surfaces as a resource console error in the page.
 * This is the only expected client-side noise in the gate journeys.
 */
const LOGIN_403_CONSOLE =
  /\[console\.error\] Failed to load resource: the server responded with a status of 403/

/**
 * Clear the seeded student's device binding, cooldown, and sessions through the
 * teacher's Emergency Device Release. The student is shared by the whole suite,
 * so this guarantees a "fresh student" start and prevents an interrupted run
 * from leaving a live session or a 2-hour cooldown behind for other specs.
 */
async function clearStudentDeviceState(browser: Browser): Promise<boolean> {
  const context = await browser.newContext()
  try {
    await apiLoginFaculty(context.request)
    const release = await releaseStudentDevice(context.request, STUDENT_USER_ID, SECTION_ID)
    return release.ok()
  } catch {
    return false
  } finally {
    await apiLogout(context.request).catch(() => undefined)
    await context.close()
  }
}

test.describe('Device-integrity login gate (web)', () => {
  test.beforeEach(async ({ browser }) => {
    // The seeded student is shared by the whole suite. Start every journey from
    // "fresh student": clear any live session/cooldown left by an earlier run.
    expect(await clearStudentDeviceState(browser), 'reset the seeded student device state').toBe(true)
  })

  test('blocks a second browser, arms a same-device-exempt cooldown on logout, and admits a released device', async ({
    browser,
  }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    const errorsA = trackErrors(pageA)
    const errorsB = trackErrors(pageB)
    // The release endpoint is rate-limited per teacher (10/hour), so the
    // fallback cleanup below re-releases only when the journey failed before
    // step 6 completed.
    let releaseCompleted = false

    try {
      // 1. Browser A signs in. Each context carries its own `web-…` device id.
      await loginStudent(pageA)
      await expect(pageA.getByText(/Dashboard|Welcome/i).first()).toBeVisible()
      const deviceA = await getWebDeviceId(pageA)
      expect(deviceA, 'the web client persists an installation id').toMatch(/^web-/)

      // 2. Browser B (a different device) is rejected; the active session stays.
      const blocked = await attemptStudentLogin(pageB)
      expect(blocked.status()).toBe(403)
      const blockedBody = (await blocked.json()) as {
        code?: string
        activeDeviceKind?: string | null
        activeSessionLastActiveAt?: string
      }
      expect(blockedBody.code).toBe('active_session_elsewhere')
      expect(blockedBody.activeDeviceKind).toBe('web')
      expect(blockedBody.activeSessionLastActiveAt).toEqual(expect.any(String))
      await expect(
        pageB.getByRole('heading', { name: /Already signed in elsewhere/i }),
      ).toBeVisible()
      await expect(pageB.getByLabel(/Student Number/i)).toHaveCount(0)

      // A is untouched: a protected page reload still renders.
      await pageA.reload()
      await expect(pageA).toHaveURL((url) => url.pathname.startsWith('/student/'))
      await expect(pageA.getByText(/Dashboard|Welcome/i).first()).toBeVisible()
      assertNoErrors(errorsA)

      // 3. A logs out with its own device id — the server arms the cooldown and
      // exempts A (the logging-out device).
      const logout = await apiLogout(pageA.request, {
        deviceId: deviceA as string,
        armDeviceCooldown: true,
      })
      expect(logout.status(), await logout.text()).toBe(201)

      // 4. B now sees the ticking cooldown panel instead of the explainer.
      const cooled = await attemptStudentLogin(pageB)
      expect(cooled.status()).toBe(403)
      const cooledBody = (await cooled.json()) as {
        code?: string
        remainingMinutes?: number
        remainingSeconds?: number
      }
      expect(cooledBody.code).toBe('device_cooldown_active')
      expect(cooledBody.remainingSeconds).toEqual(expect.any(Number))
      expect(cooledBody.remainingSeconds as number).toBeGreaterThan(60 * 60)
      expect(cooledBody.remainingMinutes).toEqual(expect.any(Number))
      await expect(
        pageB.getByRole('heading', { name: /Device change cooling down/i }),
      ).toBeVisible()
      const timer = pageB.getByRole('timer')
      await expect(timer).toBeVisible()
      const firstRead = await timer.textContent()
      expect(firstRead).toMatch(/^2:00:00$|^1:5\d:\d{2}$/)
      await expect.poll(async () => timer.textContent(), { timeout: 5_000 }).not.toBe(firstRead)

      // 5. Re-login on A is instant: the exempt device skips its own cooldown.
      await loginStudent(pageA)
      await expect(pageA.getByText(/Dashboard|Welcome/i).first()).toBeVisible()
      assertNoErrors(errorsA)

      // 6. The teacher's Emergency Device Release clears the cooldown (and the
      // still-live A session), so B is admitted instantly.
      const facultyContext = await browser.newContext()
      try {
        await apiLoginFaculty(facultyContext.request)
        const released = await releaseStudentDevice(facultyContext.request, STUDENT_USER_ID, SECTION_ID)
        expect(released.ok(), await released.text()).toBeTruthy()
        const releaseBody = (await released.json()) as {
          clearedCooldown?: boolean
          hadCooldown?: boolean
        }
        expect(releaseBody.clearedCooldown ?? releaseBody.hadCooldown).toBe(true)
        releaseCompleted = true
      } finally {
        await apiLogout(facultyContext.request).catch(() => undefined)
        await facultyContext.close()
      }

      await loginStudent(pageB)
      await expect(pageB.getByText(/Dashboard|Welcome/i).first()).toBeVisible()

      assertNoErrors(errorsB, [LOGIN_403_CONSOLE])
    } finally {
      // If the journey failed between the logout and the release, a 2-hour
      // armed cooldown would block every later student spec. Custom contexts
      // bypass the suite-wide hook, so clear it here (once) on failure only.
      if (!releaseCompleted) await clearStudentDeviceState(browser)
      await apiLogout(pageA.request).catch(() => undefined)
      await apiLogout(pageB.request).catch(() => undefined)
      await contextA.close()
      await contextB.close()
    }
  })
})
