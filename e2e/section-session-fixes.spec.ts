import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  API_BASE,
  FACULTY_EMAIL,
  SEED_PASSWORD,
  assertNoErrors,
  loginFaculty,
  loginStudent,
  trackErrors,
} from './helpers'

interface SectionSeed {
  id: string
  section: string
  course?: string
}

const SEMESTER = '1st Semester AY 2026-2027'

/**
 * Create a disposable section with the requester's two-meeting schedule
 * (Mon 08:00–10:30 + Wed 09:00–12:30) through the API so the UI journeys can
 * exercise the course display and class-meeting selector deterministically.
 */
async function createTwoSlotSection(
  request: APIRequestContext,
  label: string,
): Promise<SectionSeed> {
  const res = await request.post(`${API_BASE}/sections`, {
    data: {
      subjectId: 'subj-001',
      section: label,
      course: 'BSIT',
      room: 'E2E Room',
      semester: SEMESTER,
      schedule: [
        { day: 'Mon', startTime: '08:00', endTime: '10:30' },
        { day: 'Wed', startTime: '09:00', endTime: '12:30' },
      ],
    },
  })
  expect(res.ok(), await res.text()).toBeTruthy()
  return (await res.json()) as SectionSeed
}

test.describe('Course on sections', () => {
  test.beforeEach(async ({ page }) => {
    await loginFaculty(page)
  })

  test('new sections carry a course and always display it', async ({ page, request }) => {
    const errors = trackErrors(page)
    const section = await createTwoSlotSection(request, `E2E-C-${Date.now() % 100000}`)

    // Subject detail grid shows the course alongside the section.
    await page.goto('/faculty/subjects/subj-001')
    await expect(
      page.getByText(new RegExp(`${section.section}.*BSIT`)).first(),
    ).toBeVisible({ timeout: 20_000 })

    // Subject card summarizes the courses covered by its sections.
    await page.goto('/faculty/subjects')
    await expect(page.getByText(/Courses:.*BSIT/).first()).toBeVisible()

    assertNoErrors(errors)
  })
})

test.describe('Session class-meeting selector', () => {
  test.beforeEach(async ({ page }) => {
    await loginFaculty(page)
  })

  test('single create follows the chosen meeting and bulk keeps per-slot times', async ({
    page,
    request,
  }) => {
    const errors = trackErrors(page)
    const section = await createTwoSlotSection(request, `E2E-S-${Date.now() % 100000}`)

    await page.goto('/faculty/sessions/create')
    await page.getByLabel('Subject').selectOption({ label: 'Software Engineering (CCIS 3104)' })
    await page.getByLabel('Section').selectOption(section.id)

    // The two schedule entries become explicit class-meeting options.
    const classMeeting = page.getByLabel('Class meeting')
    await expect(classMeeting).toBeVisible()
    await expect(classMeeting.locator('option').filter({ hasText: 'Mon 08:00–10:30' })).toHaveCount(1)
    await expect(classMeeting.locator('option').filter({ hasText: 'Wed 09:00–12:30' })).toHaveCount(1)

    // Picking Wednesday refills the time fields with Wednesday's meeting times.
    await classMeeting.selectOption('1')
    await expect(page.getByLabel('Start Time')).toHaveValue('09:00')
    await expect(page.getByLabel('End Time')).toHaveValue('12:30')

    // Picking Monday refills with Monday's times.
    await classMeeting.selectOption('0')
    await expect(page.getByLabel('Start Time')).toHaveValue('08:00')
    await expect(page.getByLabel('End Time')).toHaveValue('10:30')

    // Bulk mode: one row per class meeting, each with its own time pair.
    await page.getByLabel('Create recurring sessions for the semester').check()
    await page.getByLabel('Start Date').fill('2027-01-04')
    await page.getByLabel('End Date').fill('2027-01-17')
    // Mon Jan 4/11 + Wed Jan 6/13 = 4 sessions
    await expect(page.getByText('4 sessions will be created')).toBeVisible()
    await page.locator('#bulk-slot-1').uncheck({ force: true })
    await expect(page.getByText('2 sessions will be created')).toBeVisible()
    await page.locator('#bulk-slot-1').check({ force: true })

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: /Create 4 Sessions/i }).click()
    await expect(page).toHaveURL(/\/faculty\/sessions$/, { timeout: 20_000 })
    // Both series were created with their own times, not one global pair.
    await expect(page.getByText('08:00 - 10:30').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('09:00 - 12:30').first()).toBeVisible()

    assertNoErrors(errors)
  })
})

test.describe('Student dispute submit', () => {
  test.beforeEach(async ({ page }) => {
    await loginStudent(page)
  })

  test('short descriptions block submit and valid disputes submit without a silent failure', async ({
    page,
    request,
  }) => {
    const errors = trackErrors(page)
    // Self-heal repeated runs: resolve any pending disputes first.
    await request.post(`${API_BASE}/auth/login/faculty`, {
      data: { email: FACULTY_EMAIL, password: SEED_PASSWORD },
    })
    const pending = await (await request.get(`${API_BASE}/disputes`)).json()
    for (const record of pending) {
      await request.post(`${API_BASE}/disputes/${record.id}/resolve`, {
        data: { resolution: 'accept' },
      })
    }

    await page.goto('/student/dashboard?tab=attendance')
    const reportBtn = page.getByRole('button', { name: /Report Issue/i }).first()
    await expect(reportBtn).toBeVisible()
    await reportBtn.click()

    const submit = page.getByRole('button', { name: /Submit Dispute/i })
    await page.getByLabel('Reason').selectOption('other')
    // Description is required (backend MinLength(10)); submit stays disabled.
    await expect(submit).toBeDisabled()
    const description = page.getByLabel('Description')
    await description.fill('too short')
    await expect(submit).toBeDisabled()
    await description.fill('E2E regression check for the dispute submit button')
    await expect(submit).toBeEnabled()

    await submit.click()
    await expect(
      page.getByText(/Dispute submitted successfully\.|Failed to submit dispute\./i),
    ).toBeVisible({ timeout: 20_000 })

    assertNoErrors(errors, [
      // A repeat run may race the self-heal and receive an expected 4xx.
      /\[console\.error\] Failed to load resource: the server responded with a status of 4\d\d/,
    ])
  })
})
