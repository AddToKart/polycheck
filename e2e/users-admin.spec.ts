import { test, expect, type Page } from '@playwright/test'
import { ADMIN_EMAIL, loginFaculty, trackErrors, assertNoErrors } from './helpers'

// The production service worker bypasses Playwright route interception in WebKit;
// user-management specs mock /auth/me, so run them without the SW.
test.use({ serviceWorkers: 'block' })

const API_BASE = 'http://localhost:4000/api'
const PASSWORD = 'E2eTemporaryPass1!'

async function createTeacher(page: Page, suffix: number) {
  const email = `e2e.admin.teacher.${suffix}@pup.edu.ph`
  const response = await page.request.post(`${API_BASE}/users/teachers`, {
    data: {
      fullName: `E2E Admin Teacher ${suffix}`,
      email,
      password: PASSWORD,
      department: 'CCIS',
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { email, fullName: `E2E Admin Teacher ${suffix}` }
}

async function createStudent(page: Page, suffix: number) {
  const studentId = `2026-${String(suffix).slice(-5).padStart(5, '0')}-MN-0`
  const response = await page.request.post(`${API_BASE}/users/students`, {
    data: {
      fullName: `E2E Admin Student ${suffix}`,
      studentId,
      email: `e2e.admin.student.${suffix}@iskolar.pup.edu.ph`,
      password: PASSWORD,
      program: 'BS Information Technology',
      yearLevel: 1,
      department: 'CCIS',
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { studentId, fullName: `E2E Admin Student ${suffix}` }
}

test.describe('Super Admin user management', () => {
  test.beforeEach(async ({ page }) => {
    await loginFaculty(page, ADMIN_EMAIL)
  })

  test('search and filters run through the server-side user directory', async ({ page }) => {
    const errors = trackErrors(page)
    const suffix = Date.now()
    const teacher = await createTeacher(page, suffix)

    await page.goto('/faculty/users')
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()

    const search = page.getByLabel('Search accounts', { exact: true })
    await search.fill(teacher.email)
    const row = page.getByRole('row').filter({ hasText: teacher.email })
    await expect(row).toBeVisible()

    await page.getByLabel('Filter by status', { exact: true }).selectOption('inactive')
    await expect(page.getByText('No accounts match these filters.')).toBeVisible()

    await page.getByLabel('Filter by status', { exact: true }).selectOption('active')
    await expect(row).toBeVisible()

    await page.getByLabel('Filter by department', { exact: true }).fill('CCIS')
    await expect(row).toBeVisible()

    await search.fill(`no-such-user-${suffix}`)
    await expect(page.getByText('No accounts match these filters.')).toBeVisible()
    assertNoErrors(errors)
  })

  test('edits a teacher profile and reflects the change immediately', async ({ page }) => {
    const errors = trackErrors(page)
    const suffix = Date.now()
    const teacher = await createTeacher(page, suffix)
    const updatedName = `E2E Edited Teacher ${suffix}`

    await page.goto('/faculty/users')
    await page.getByLabel('Search accounts', { exact: true }).fill(teacher.email)
    const row = page.getByRole('row').filter({ hasText: teacher.email })
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: /Edit/ }).click()
    await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible()
    await page.getByLabel('Full name').fill(updatedName)
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Profile updated')).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: updatedName })).toBeVisible()
    assertNoErrors(errors)
  })

  test('changes a student role with an explicit consequence confirmation', async ({ page }) => {
    const errors = trackErrors(page)
    const suffix = Date.now()
    const student = await createStudent(page, suffix)

    await page.goto('/faculty/users')
    await page.getByRole('button', { name: 'Students', exact: true }).click()
    await page.getByLabel('Search accounts', { exact: true }).fill(student.studentId)
    const row = page.getByRole('row').filter({ hasText: student.studentId })
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'Change role' }).click()
    await expect(page.getByRole('heading', { name: 'Change to Teacher' })).toBeVisible()
    await expect(page.getByText(/A department is required/i)).toBeVisible()
    await page.getByRole('button', { name: 'Change to Teacher' }).click()
    await expect(page.getByText('Role updated')).toBeVisible()
    assertNoErrors(errors)
  })

  test('Add Super Admin is only visible to institution-scope admins', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/users')
    await expect(page.getByRole('button', { name: 'Add Super Admin' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Super Admins' })).toBeVisible()

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'department-admin',
          fullName: 'Department Administrator',
          email: 'dept.admin@pup.edu.ph',
          role: 'super_admin',
          scope: 'department',
          department: 'CCIS',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      })
    })

    await page.goto('/faculty/users')
    await expect(page.getByText('Department scope').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Super Admin' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Super Admins' })).toHaveCount(0)
    assertNoErrors(errors)
  })

  test('bulk import remains available on the students tab', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/users')
    await page.getByRole('button', { name: 'Students', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Import Students' })).toBeVisible()
    assertNoErrors(errors)
  })
})

