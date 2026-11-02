import { test, expect } from '@playwright/test'
import { ADMIN_EMAIL, loginFaculty, trackErrors, assertNoErrors } from './helpers'

// Profile + institution governance surfaces. Service workers are blocked so
// route interception and /auth/me mocks behave consistently across engines.
test.use({ serviceWorkers: 'block' })

test.describe('Account governance surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await loginFaculty(page, ADMIN_EMAIL)
  })

  test('accounts tab exposes delegated-governance controls', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/settings?tab=accounts')

    await expect(page.getByRole('switch', { name: 'Allow teacher password resets' })).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Allow emergency device release' })).toBeVisible()
    await expect(page.getByLabel('Device change cooldown (hours)')).toBeVisible()
    assertNoErrors(errors)
  })

  test('profile page renders identity, security, and contacts panels', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/profile')

    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Password & security/i })).toBeVisible()
    await expect(page.getByLabel('Current password')).toBeVisible()

    await page.getByRole('tab', { name: /Contact information/i }).click()
    await expect(page.getByLabel('Personal email')).toBeVisible()
    await expect(page.getByLabel('Emergency mobile number')).toBeVisible()
    assertNoErrors(errors)
  })
})
