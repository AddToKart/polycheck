import { test, expect } from '@playwright/test'
import {
  ADMIN_EMAIL,
  API_BASE,
  DEPARTMENT_HEAD_EMAIL,
  FACULTY_EMAIL,
  IT_COORDINATOR_EMAIL,
  REGISTRAR_EMAIL,
  SEED_PASSWORD,
  STUDENT_ID,
  apiLoginFaculty,
  hideDevOverlay,
  loginFaculty,
  logout,
  waitForPath,
} from './helpers'

test.describe('Campus designations & maintenance mode', () => {
  // Always reopen the campus after this file, even when the journey fails
  // mid-way (the maintenance state is process-global for the whole stack).
  test.afterEach(async ({ request }) => {
    await apiLoginFaculty(request, ADMIN_EMAIL).catch(() => undefined)
    const status = await request
      .get(`${API_BASE}/maintenance/status`)
      .then((response) => (response.ok() ? response.json() : { enabled: false }))
      .catch(() => ({ enabled: false }))
    if (status.enabled) {
      await request.put(`${API_BASE}/settings/maintenance_mode_enabled`, { data: { value: 'false' } })
    }
  })

  test('IT coordinator sees the IT Operations Suite and stays out of academic oversight', async ({ page }) => {
    await loginFaculty(page, IT_COORDINATOR_EMAIL)

    await expect(page.getByText('IT Operations Suite', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Server Status' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Issue Reports' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Maintenance Controls' })).toBeVisible()
    await expect(page.getByText('Academic Department Oversight', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Department Reports' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Server Status' }).click()
    await waitForPath(page, '/faculty/server-status')
    await hideDevOverlay(page)
    await expect(page.getByRole('heading', { name: 'Server Status' })).toBeVisible()

    await page.goto('/faculty/system-reports')
    await expect(page.getByRole('heading', { name: 'System Reports' })).toBeVisible()

    await page.goto('/faculty/settings?tab=system')
    await hideDevOverlay(page)
    await expect(page.getByRole('switch', { name: 'Maintenance mode' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Institution' })).toHaveCount(0)

    // Separation of duties: academic oversight pages redirect away.
    await page.goto('/faculty/reports')
    await waitForPath(page, '/faculty')
  })

  test('department head gets department reports, excuses, and at-risk oversight only', async ({ page }) => {
    await loginFaculty(page, DEPARTMENT_HEAD_EMAIL)

    await expect(page.getByText('Academic Department Oversight', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Department Reports' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'At-Risk Students' })).toBeVisible()
    await expect(page.getByText('IT Operations Suite', { exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: 'Department Reports' }).click()
    await waitForPath(page, '/faculty/reports')
    await hideDevOverlay(page)
    await expect(page.getByText('Department oversight', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()

    await page.goto('/faculty/at-risk')
    await hideDevOverlay(page)
    await expect(page.getByRole('heading', { name: 'At-risk students' })).toBeVisible()

    // No server telemetry for academic heads.
    await page.goto('/faculty/server-status')
    await waitForPath(page, '/faculty')
  })

  test('registrar manages accounts in scope without super-admin invitations or role changes', async ({ page }) => {
    await loginFaculty(page, REGISTRAR_EMAIL)

    await page.goto('/faculty/users')
    await hideDevOverlay(page)
    await expect(page.getByText('Registrar scope', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Add Super Admin/i })).toHaveCount(0)

    // Super-admin-only actions and designations are absent (server-enforced too).
    await expect(page.getByRole('button', { name: 'Change role' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Audit Log' })).toHaveCount(0)

    const status = await page.request.get(`${API_BASE}/auth/me`)
    expect(status.ok()).toBeTruthy()
    const profile = await status.json()
    expect(profile.isUserRegistrar).toBe(true)
    expect(profile.isItCoordinator ?? false).toBe(false)
  })

  test('maintenance mode closes the campus, exempts IT staff, and reopens cleanly', async ({ page, request }) => {
    test.setTimeout(120_000)
    // Super admin is exempt and can operate the switch.
    await loginFaculty(page, ADMIN_EMAIL)
    await page.goto('/faculty/settings?tab=system')
    await hideDevOverlay(page)

    const toggle = page.getByRole('switch', { name: 'Maintenance mode' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('System maintenance settings saved.')).toBeVisible()

    await expect
      .poll(
        async () => {
          const response = await request.get(`${API_BASE}/maintenance/status`)
          return response.ok() ? (await response.json()).enabled : false
        },
        { timeout: 20_000 },
      )
      .toBe(true)

    // Health probes stay open for the platform.
    const health = await request.get(`${API_BASE}/health/ready`)
    expect(health.status()).toBe(200)
    const liveness = await request.get(`${API_BASE}/health`)
    expect(liveness.status()).toBe(200)

    // Log out and confirm a student cannot sign in (branded wall, not an error).
    await logout(page)
    await page.goto('/login/student')
    await page.getByLabel('Student Number').fill(STUDENT_ID)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: /Authenticate/i }).click()
    await expect(
      page.getByRole('heading', { name: 'Polycheck is under scheduled maintenance' }),
    ).toBeVisible({ timeout: 20_000 })

    // IT coordinator remains exempt and lands on the dashboard with the pill.
    await loginFaculty(page, IT_COORDINATOR_EMAIL)
    await expect(page.getByText(/Maintenance mode is active — you are exempt/i)).toBeVisible()
    await logout(page)

    // Regular faculty is rejected at login while the campus is closed.
    await page.goto('/login/faculty')
    await page.getByLabel('Email Address').fill(FACULTY_EMAIL)
    await page.getByLabel('Password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: /Authenticate/i }).click()
    await expect(
      page.getByRole('heading', { name: 'Polycheck is under scheduled maintenance' }),
    ).toBeVisible({ timeout: 20_000 })

    // Reopen as the super admin; the wall disappears without a client release.
    await loginFaculty(page, ADMIN_EMAIL)
    await page.goto('/faculty/settings?tab=system')
    await hideDevOverlay(page)
    const reopen = page.getByRole('switch', { name: 'Maintenance mode' })
    await expect(reopen).toHaveAttribute('aria-checked', 'true')
    await reopen.click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('System maintenance settings saved.')).toBeVisible()

    await expect
      .poll(
        async () => {
          const response = await request.get(`${API_BASE}/maintenance/status`)
          return response.ok() ? (await response.json()).enabled : true
        },
        { timeout: 20_000 },
      )
      .toBe(false)

    await logout(page)
    await loginFaculty(page, FACULTY_EMAIL)
    await expect(page.getByText('Faculty Dashboard')).toBeVisible()
  })
})
