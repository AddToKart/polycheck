import { test, expect } from '@playwright/test'
import { loginFaculty, trackErrors, assertNoErrors } from './helpers'

test.describe('Super Admin Flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginFaculty(page, 'mcreyes@pup.edu.ph')
  })

  test('dashboard shows institution overview', async ({ page }) => {
    const errors = trackErrors(page)
    await expect(page.getByText(/Super Admin|Institution/i).first()).toBeVisible()
    await expect(page.getByText(/Administrative Controls/i)).toBeVisible()
    assertNoErrors(errors)
  })

  test('subject directory lists all subjects', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/subjects')
    await expect(page.getByText('Software Engineering', { exact: true })).toBeVisible()
    await expect(page.getByText('Programming Languages', { exact: true })).toBeVisible()
    assertNoErrors(errors)
  })

  test('user management renders user list', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/users')
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
    assertNoErrors(errors)
  })

  test('institution settings page renders', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/settings')
    await expect(page.getByText(/Settings|Institution/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('system reports renders charts', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/reports')
    await expect(page.getByText(/Reports|Analytics/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('creates a teacher account and manages it (reset password, disable, enable)', async ({ page }) => {
    const errors = trackErrors(page)
    const email = `e2e.teacher.${Date.now()}@pup.edu.ph`
    const password = 'E2eTemporaryPass1!'

    await page.goto('/faculty/users')
    await page.getByRole('button', { name: 'Add Teacher' }).click()
    await expect(page.getByText('Create teacher account')).toBeVisible()
    await page.getByLabel('Full name').fill('E2E Test Teacher')
    await page.getByLabel('PUP email').fill(email)
    await page.getByLabel('Department').fill('CCIS')
    await page.getByLabel('Temporary password').fill(password)
    await page.getByRole('button', { name: 'Create Teacher' }).click()
    await expect(page.getByText('Teacher account created')).toBeVisible()

    // The new teacher appears in the teachers table
    const row = page.getByRole('row').filter({ hasText: email })
    await expect(row).toBeVisible()
    await expect(row.getByText('Active')).toBeVisible()

    // Reset password through the modal
    await row.getByRole('button', { name: /Reset password/i }).click()
    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible()
    await page.getByLabel('New temporary password').fill('E2eNewTempPass1!')
    await page.getByLabel('Confirm password').fill('E2eNewTempPass1!')
    await page.getByRole('button', { name: 'Reset Password' }).click()
    await expect(page.getByText('Password reset', { exact: true })).toBeVisible()

    // Disable then re-enable the account
    await row.getByRole('button', { name: 'Disable' }).click()
    await expect(row.getByText('Inactive')).toBeVisible()
    await row.getByRole('button', { name: 'Enable' }).click()
    await expect(row.getByText('Active')).toBeVisible()
    assertNoErrors(errors)
  })

  test('students tab lists student accounts', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/users')
    await page.getByRole('button', { name: 'Students' }).click()
    await expect(page.getByText('Alexandra Marie Reyes')).toBeVisible()
    assertNoErrors(errors)
  })
})
