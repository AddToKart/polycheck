import { expect, Page } from '@playwright/test'

export const SEED_PASSWORD = 'PolycheckLocal1!'

export const FACULTY_EMAIL = 'jmdelacruz@pup.edu.ph'
export const ADMIN_EMAIL = 'mcreyes@pup.edu.ph'
export const STUDENT_ID = '2024-00001-MN-0'
export const STUDENT_EMAIL = 'amreyes@iskolar.pup.edu.ph'

/** Collect console errors + page errors for runtime regression detection. */
export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))
  return errors
}

/** Assert no unexpected client-side errors were recorded (allow favicon/network noise). */
export function assertNoErrors(errors: string[]) {
  const meaningful = errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_FAILED') &&
      !e.includes('Failed to load resource') &&
      !e.includes('404 (Not Found)'),
  )
  expect(meaningful).toEqual([])
}

/** Wait until pathname is exactly the post-login route (avoids matching /login/faculty). */
export async function waitForPath(page: Page, pathname: string, timeout = 20_000) {
  await page.waitForURL((url) => url.pathname === pathname, { timeout })
}

export async function loginFaculty(page: Page, email = FACULTY_EMAIL) {
  await page.goto('/login/faculty')
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  // Wait for the actual login API round-trip so a pre-hydration click cannot race the SPA
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/api/auth/login/faculty') && r.request().method() === 'POST',
    { timeout: 20_000 },
  )
  await page.getByRole('button', { name: /Authenticate/i }).click()
  expect((await loginResponse).ok()).toBeTruthy()
  await waitForPath(page, '/faculty')
  // Brand renders in the desktop sidebar (h1) or the mobile top header (span).
  // Both can exist in the DOM simultaneously, so filter to the visible one.
  const brand = page
    .locator('h1:has-text("Polycheck"), span:has-text("Polycheck")')
    .filter({ visible: true })
    .first()
  await expect(brand).toBeVisible({ timeout: 20_000 })
}

export async function loginStudent(page: Page) {
  await page.goto('/login/student')
  await page.getByLabel('Student Number').fill(STUDENT_ID)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/api/auth/login/student') && r.request().method() === 'POST',
    { timeout: 20_000 },
  )
  await page.getByRole('button', { name: /Authenticate/i }).click()
  expect((await loginResponse).ok()).toBeTruthy()
  await page.waitForURL((url) => url.pathname.startsWith('/student/'), { timeout: 20_000 })
}

export async function logout(page: Page) {
  // Logout button in the sidebar is labelled "Disconnect"
  const logoutBtn = page.getByRole('button', { name: /Disconnect/i })
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click()
  }
  await waitForPath(page, '/').catch(() => {})
}

export async function gotoSectionDetail(page: Page, sectionId: string) {
  await page.goto(`/faculty/sections/${sectionId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `e2e-shots/${name}.png`, fullPage: true })
}
