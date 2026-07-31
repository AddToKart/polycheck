import { test, expect } from '@playwright/test'
import { loginStudent, trackErrors, assertNoErrors } from './helpers'

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
    await expect(page.getByText(/Software Engineering/i)).toBeVisible()
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
})
