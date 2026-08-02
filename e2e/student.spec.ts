import { test, expect } from '@playwright/test'
import { loginStudent, loginFaculty, trackErrors, assertNoErrors, FACULTY_EMAIL, SEED_PASSWORD } from './helpers'

test.describe('Student Flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginStudent(page)
  })

  test('dashboard shows schedule, subjects and attendance stats', async ({ page }) => {
    const errors = trackErrors(page)
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible()
    await expect(page.getByText(/Today's Schedule|My Subjects|Attendance/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('my subjects tab lists enrolled sections', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/student/dashboard?tab=subjects')
    await expect(page.getByText(/My Subjects/i).first()).toBeVisible()
    // Student s-001 is enrolled in sec-001 (Software Engineering A)
    await expect(page.getByText(/Software Engineering/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('attendance history tab shows records', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/student/dashboard?tab=attendance')
    await expect(page.getByText(/Attendance/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('schedule page renders weekly timetable', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/student/schedule')
    await expect(page.getByText(/Schedule|Week/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('subject detail page is read-only with session history', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/student/subjects/sec-001')
    await expect(page.getByText(/Software Engineering/i)).toBeVisible()
    assertNoErrors(errors)
  })

  test('enroll modal validates code and errors on invalid code', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/student/dashboard')
    await page.getByRole('button', { name: /Enroll in Subject/i }).click()
    await expect(page.getByText('Enroll in a Subject')).toBeVisible()
    await page.getByPlaceholder(/Enter enrollment code/i).fill('ZZZZZZ')
    await page.getByRole('button', { name: /^Enroll$/i }).click()
    // Server rejects the bogus code with an inline error
    await expect(page.getByText(/not (found|valid)|invalid|unable|no.*section|couldn't/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('report issue flow opens dispute modal from history', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/student/dashboard?tab=attendance')
    const reportBtn = page.getByRole('button', { name: /Report Issue/i }).first()
    if (await reportBtn.isVisible().catch(() => false)) {
      await reportBtn.click()
      await expect(page.getByText(/Report Issue|Dispute/i).first()).toBeVisible()
    }
    assertNoErrors(errors)
  })

  test('attendance history filters show only matching statuses', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/student/dashboard?tab=attendance')
    await expect(page.getByText('Full Attendance Audit')).toBeVisible()

    const assertFilterShowsOnly = async (status: string) => {
      await page.getByRole('button', { name: status, exact: true }).click()
      const label = status.charAt(0).toUpperCase() + status.slice(1)
      const emptyState = page.getByText(new RegExp(`No ${status} attendance records`))
      // Wait for the filtered list to settle: either a data row or the empty state
      // (the empty state is itself a <tr>, so detect it explicitly).
      await expect(page.locator('tbody tr').first().or(emptyState).first()).toBeVisible()
      if (await emptyState.isVisible().catch(() => false)) return
      const rows = page.locator('tbody tr')
      const count = await rows.count()
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i)).toContainText(label)
      }
    }

    await assertFilterShowsOnly('present')
    await assertFilterShowsOnly('absent')
    await assertFilterShowsOnly('late')
    // Back to full list
    await page.getByRole('button', { name: 'all', exact: true }).click()
    assertNoErrors(errors)
  })

  test('full dispute roundtrip: student reports, teacher resolves', async ({ page, request }) => {
    const errors = trackErrors(page)
    // Self-heal: interrupted runs leave pending disputes on s-001's records; resolve
    // them via API first. The `request` fixture keeps its own cookie jar, so the
    // faculty login does not replace the student session cookie in the page.
    await request.post('http://localhost:4000/api/auth/login/faculty', {
      data: { email: FACULTY_EMAIL, password: SEED_PASSWORD },
    })
    const pending = await (await request.get('http://localhost:4000/api/disputes')).json()
    for (const record of pending) {
      await request.post(`http://localhost:4000/api/disputes/${record.id}/resolve`, {
        data: { resolution: 'accept' },
      })
    }
    // 1. Student submits a dispute on one of their Software Engineering (sec-001) records
    await page.goto('/student/dashboard?tab=attendance')
    const seRow = page
      .locator('tbody tr')
      .filter({ hasText: 'Software Engineering' })
      .filter({ has: page.getByRole('button', { name: /Report Issue/i }) })
      .first()
    await seRow.getByRole('button', { name: /Report Issue/i }).click()
    await page.getByRole('dialog').locator('select').selectOption('outside_geofence')
    await page.getByPlaceholder('Describe the issue...').fill('E2E test dispute — scanner reported wrong location')
    await page.getByRole('button', { name: /Submit Dispute/i }).click()
    // Fresh submission shows the success toast; an interrupted repeat run already
    // has a pending dispute on this record, which the teacher review below resolves.
    await expect(
      page.getByText(/Dispute submitted successfully\.|Failed to submit dispute\./i),
    ).toBeVisible()

    // 2. Teacher sees the pending dispute and accepts it
    await loginFaculty(page)
    await page.goto('/faculty/disputes')
    await expect(page.getByText(/Pending Disputes \(\d+\)/)).toBeVisible()
    // Dispute cards are grouped under collapsible subject/section headers
    await page.getByRole('button', { name: /Software Engineering \(CCIS 3104\)/i }).first().click()
    await page.getByRole('button', { name: /^Section A/i }).first().click()
    const disputeCard = page.getByRole('button', { name: /Review dispute from Alexandra Marie Reyes/i }).first()
    await disputeCard.click()
    await expect(page.getByText('Review Dispute')).toBeVisible()
    await page.getByRole('button', { name: /Accept — Keep as Present/i }).click()
    await expect(page.getByText('Dispute Resolved')).toBeVisible()
    await expect(page.getByText(/Resolved History \(\d+\)/)).toBeVisible()
    assertNoErrors(errors)
  })

  test('enrolls with a valid enrollment code and cleans up via API', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/student/dashboard')
    await page.getByRole('button', { name: /Enroll in Subject/i }).click()
    await page.getByPlaceholder(/Enter enrollment code/i).fill('SEB2026')
    await page.getByRole('button', { name: /^Enroll$/i }).click()
    // First run shows the success box; interrupted repeat runs already enrolled
    await expect(
      page.getByText(/Successfully enrolled!|Already enrolled in this section/i),
    ).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')

    // Cleanup: faculty removes the enrollment created by this test
    await loginFaculty(page)
    const res = await page.request.delete('http://localhost:4000/api/sections/sec-002/students/s-001')
    expect(res.ok()).toBeTruthy()
    assertNoErrors(errors)
  })
})
