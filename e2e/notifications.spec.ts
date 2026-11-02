import { test, expect } from '@playwright/test'
import {
  API_BASE,
  loginFaculty,
  apiLoginStudent,
  trackErrors,
  assertNoErrors,
} from './helpers'

test.use({ serviceWorkers: 'block' })

test.describe('Notification center', () => {
  test('teacher sees a new excuse notification and can clear the unread badge', async ({ page, request }) => {
    // Seed a notification through the real excuse pipeline (student context).
    await apiLoginStudent(request)
    const recordsResponse = await request.get(`${API_BASE}/attendance/student/s-001`)
    expect(recordsResponse.ok(), await recordsResponse.text()).toBeTruthy()
    const records = (await recordsResponse.json()) as Array<{
      id: string
      status: string
      excuseStatus?: string | null
    }>
    const candidate = records.find(
      (record) =>
        (record.status === 'absent' || record.status === 'late') &&
        (!record.excuseStatus || record.excuseStatus === 'rejected') &&
        !record.id.startsWith('offline:'),
    )
    if (!candidate) {
      test.skip(true, 'No eligible record available to seed an excuse notification')
      return
    }
    const submitted = await request.post(`${API_BASE}/attendance/records/${candidate.id}/excuse`, {
      data: {
        reason: 'medical',
        description: `E2E notification ${Date.now()}: medical appointment during class hours.`,
      },
    })
    if (submitted.status() === 429) {
      test.skip(true, 'Local excuse-request rate limit reached; CI uses a fresh database')
      return
    }
    expect(submitted.ok(), await submitted.text()).toBeTruthy()

    const errors = trackErrors(page)
    await loginFaculty(page)
    await page.goto('/faculty')

    const bell = page.locator('button[aria-label^="Notifications"]:visible').first()
    await expect(bell).toBeVisible({ timeout: 20_000 })
    await expect(bell).toHaveAttribute('aria-label', /unread/i, { timeout: 20_000 })
    await bell.click()

    await expect(page.getByRole('button', { name: 'Mark all read' })).toBeVisible()
    const notification = page.getByRole('button', { name: /New excuse request/i }).first()
    await expect(notification).toBeVisible()

    // Deep link into the excuse workspace.
    await notification.click()
    await expect(page).toHaveURL(/\/faculty\/excuses/, { timeout: 20_000 })

    // Clear the badge and confirm it persists across a reload.
    await page.goto('/faculty')
    const bellAfter = page.locator('button[aria-label^="Notifications"]:visible').first()
    await bellAfter.click()
    await page.getByRole('button', { name: 'Mark all read' }).click()
    await expect(bellAfter).toHaveAttribute('aria-label', 'Notifications', { timeout: 20_000 })

    await page.reload()
    await expect(page.locator('button[aria-label^="Notifications"]:visible').first()).toHaveAttribute(
      'aria-label',
      'Notifications',
      { timeout: 20_000 },
    )
    assertNoErrors(errors)
  })
})

