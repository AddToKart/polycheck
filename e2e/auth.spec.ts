import { test, expect } from '@playwright/test'
import { loginFaculty, loginStudent, logout, trackErrors, assertNoErrors, SEED_PASSWORD } from './helpers'

test.describe('Auth & Session', () => {
  test('landing page renders PUP branding and role selection', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await expect(page.getByText('Polycheck.', { exact: true })).toBeVisible()
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
    await page.goto('/login/faculty')
    await page.getByLabel('Email Address').fill('jmdelacruz@pup.edu.ph')
    await page.getByLabel('Password').fill('WrongPassword123!')
    await page.getByRole('button', { name: /Authenticate/i }).click()
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
    await expect(page.getByText('Polycheck.', { exact: true })).toBeVisible()
  })

  test('session persists across reload (cookie auth)', async ({ page }) => {
    await loginFaculty(page)
    await page.reload()
    await expect(page).toHaveURL((url) => url.pathname === '/faculty', { timeout: 20_000 })
    await expect(page.getByText('Faculty Dashboard')).toBeVisible()
  })

  test('super admin login reaches admin dashboard', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page, 'mcreyes@pup.edu.ph')
    await expect(page.getByText('System Administration')).toBeVisible()
    await expect(page.getByText('Super Administrator')).toBeVisible()
    assertNoErrors(errors)
  })
})
