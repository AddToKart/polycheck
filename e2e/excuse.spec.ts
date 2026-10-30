import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import {
  API_BASE,
  loginStudent,
  loginFaculty,
  apiLoginStudent,
  trackErrors,
  assertNoErrors,
} from './helpers'

test.use({ serviceWorkers: 'block' })

interface ApiRecord {
  id: string
  status: string
  excuseStatus?: string | null
  timestamp: string
}

async function fetchStudentRecords(context: Page['request'] | APIRequestContext): Promise<ApiRecord[]> {
  const response = await context.get(`${API_BASE}/attendance/student/s-001`)
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as ApiRecord[]
}

function isExcuseCandidate(record: ApiRecord) {
  return (
    (record.status === 'absent' || record.status === 'late') &&
    (!record.excuseStatus || record.excuseStatus === 'rejected') &&
    !record.id.startsWith('offline:')
  )
}

test.describe('Excuse workflow', () => {
  test('student requests an excuse from attendance history', async ({ page }) => {
    const errors = trackErrors(page)
    await loginStudent(page)
    await page.goto('/student/dashboard?tab=attendance')

    const requestButton = page.getByRole('button', { name: /Request an excuse for/i }).first()
    if ((await requestButton.count()) === 0) {
      test.skip(true, 'No eligible absent/late record without an excuse is available')
      return
    }
    await requestButton.click()

    await expect(page.getByRole('heading', { name: 'Request an excuse' })).toBeVisible()
    await page.getByLabel(/Reason/).selectOption('medical')
    await page.getByLabel(/Description/).fill('E2E verification: medical appointment during class hours.')
    await page.getByRole('button', { name: /Submit request/i }).click()

    try {
      await expect(page.getByText('Excuse Requested')).toBeVisible({ timeout: 15_000 })
    } catch (error) {
      if (await page.getByText(/Too many excuse requests/i).isVisible().catch(() => false)) {
        test.skip(true, 'Local excuse-request rate limit reached; CI uses a fresh database')
        return
      }
      throw error
    }
    await expect(page.getByText('Requested', { exact: true }).first()).toBeVisible()

    const records = await fetchStudentRecords(page.request)
    expect(records.some((record) => record.excuseStatus === 'requested')).toBeTruthy()
    assertNoErrors(errors)
  })

  test('teacher approves a pending excuse from the review workspace', async ({ page, request }) => {
    const tag = `E2E excuse ${Date.now()}`
    await apiLoginStudent(request)
    const records = await fetchStudentRecords(request)
    const candidate = records.find(isExcuseCandidate)
    if (!candidate) {
      test.skip(true, 'No eligible absent/late record without an excuse is available')
      return
    }
    const submitted = await request.post(`${API_BASE}/attendance/records/${candidate.id}/excuse`, {
      data: { reason: 'medical', description: `${tag}: medical appointment during class hours.` },
    })
    if (submitted.status() === 429) {
      test.skip(true, 'Local excuse-request rate limit reached; CI uses a fresh database')
      return
    }
    expect(submitted.ok(), await submitted.text()).toBeTruthy()

    const errors = trackErrors(page)
    await loginFaculty(page)
    await page.goto('/faculty/excuses')

    const recordButton = page
      .getByRole('button', { name: /Review excuse request from/i })
      .filter({ hasText: tag })
      .first()
    await expect(recordButton).toBeVisible({ timeout: 20_000 })
    await recordButton.click()

    await expect(page.getByText('Review Excuse')).toBeVisible()
    await page.getByLabel(/Note to student/).fill('Approved by E2E verification.')
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Approve' }).click()

    await expect(page.getByText('Excuse Approved')).toBeVisible({ timeout: 15_000 })
    const approved = await page.request.get(`${API_BASE}/attendance/excuses?status=approved`)
    const approvedRecords = (await approved.json()) as ApiRecord[]
    expect(approvedRecords.some((record) => record.id === candidate.id)).toBeTruthy()
    assertNoErrors(errors)
  })

  test('student standing banner is dismissible for the tab session', async ({ page }) => {
    const errors = trackErrors(page)
    await loginStudent(page)
    await page.goto('/student/dashboard')

    const banner = page.getByLabel('Attendance standing notice')
    if ((await banner.count()) === 0) {
      test.skip(true, 'Seeded student is not below the attendance threshold')
      return
    }
    await expect(banner).toBeVisible()
    const dismiss = page.getByRole('button', { name: 'Dismiss attendance notice' })
    await dismiss.click()
    await expect(banner).toHaveCount(0)

    await page.reload()
    await expect(page.getByLabel('Attendance standing notice')).toHaveCount(0)
    assertNoErrors(errors)
  })
})

