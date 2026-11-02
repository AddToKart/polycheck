import { test, expect, type Page } from '@playwright/test'
import { API_BASE, ADMIN_EMAIL, SEED_PASSWORD, loginFaculty, trackErrors, assertNoErrors } from './helpers'

// Triage and intake run against the API with service workers blocked so
// route mocks are engine-consistent.
test.use({ serviceWorkers: 'block' })

async function apiLoginStudent(page: Page) {
  const response = await page.request.post(`${API_BASE}/auth/login/student`, {
    data: { studentId: '2024-00001-MN-0', password: SEED_PASSWORD },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

test.describe('System issue & feedback reporting', () => {
  test('cockpit renders stats and filters for super admins', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page, ADMIN_EMAIL)
    await page.goto('/faculty/system-reports')

    await expect(page.getByRole('heading', { name: 'System Reports' })).toBeVisible()
    await expect(page.getByTestId('stat-total')).toBeVisible()
    await expect(page.getByLabel('Filter by status')).toBeVisible()
    assertNoErrors(errors)
  })

  test('profile exposes My reports for the seeded student', async ({ page }) => {
    const errors = trackErrors(page)
    await apiLoginStudent(page)
    await page.goto('/profile')

    await page.getByRole('tab', { name: /My reports/i }).click()
    await expect(
      page.getByText(/No reports yet|Admin note:/).first(),
    ).toBeVisible()
    assertNoErrors(errors)
  })
})
