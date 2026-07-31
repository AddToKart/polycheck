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
})
