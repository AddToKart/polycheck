import { test, expect } from '@playwright/test'
import { loginFaculty, trackErrors, assertNoErrors, createDisposableSession } from './helpers'

test.describe('Faculty (Teacher) Flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginFaculty(page)
  })

  test('dashboard shows stats, today schedule and subjects', async ({ page }) => {
    const errors = trackErrors(page)
    await expect(page.getByText('Faculty Dashboard')).toBeVisible()
    await expect(page.getByText("Today's Schedule")).toBeVisible()
    await expect(page.getByRole('link', { name: 'My Subjects' })).toBeVisible()
    // Stat cards should render numbers
    await expect(page.getByText('My Students').first()).toBeVisible()
    await expect(page.getByText('Sessions Today').first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('subjects list renders seeded subjects', async ({ page }) => {
    const errors = trackErrors(page)
    await page.getByRole('link', { name: 'My Subjects' }).click()
    await expect(page).toHaveURL(/\/faculty\/subjects/)
    await expect(page.getByText('Software Engineering', { exact: true })).toBeVisible()
    await expect(page.getByText('Data Structures and Algorithms', { exact: true })).toBeVisible()
    assertNoErrors(errors)
  })

  test('subject detail shows sections grid', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/subjects/subj-001')
    await expect(page.getByRole('heading', { name: 'Software Engineering' })).toBeVisible()
    await expect(page.getByText(/Section A/).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Add Section/i })).toBeVisible()
    assertNoErrors(errors)
  })

  test('create subject flow', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/subjects/create')
    const name = `E2E Subject ${Date.now()}`
    await page.getByLabel('Subject Name').fill(name)
    await page.getByLabel('Code').fill(`E2E-${Date.now() % 100000}`)
    await page.getByRole('button', { name: 'Create Subject' }).click()
    // New subjects get server-generated cuid ids — just assert we land on a subject page
    await expect(page).toHaveURL(/\/faculty\/subjects\/[^/]+$/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name })).toBeVisible()
    assertNoErrors(errors)
  })

  test('section detail shows roster, enrollment code and attendance', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/sections/sec-001')
    await expect(page.getByText(/Section A/).first()).toBeVisible()
    await expect(page.getByText(/Alexandra Marie Reyes/i).first()).toBeVisible()
    await expect(page.getByText(/Enrollment Code/i)).toBeVisible()
    assertNoErrors(errors)
  })

  test('sessions list renders sessions for the teacher', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/sessions')
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible()
    await expect(page.getByRole('link', { name: /New Session/i })).toBeVisible()
    assertNoErrors(errors)
  })

  test('create session form renders section picker + map', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/sessions/create')
    await expect(page.getByRole('heading', { name: 'Create Session' })).toBeVisible()
    // map should mount (maplibre)
    await expect(page.locator('.maplibregl-canvas').first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('session detail page loads with QR generation', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/sessions/sess-001')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20_000 })
    assertNoErrors(errors)
  })

  test('disputes page lists seeded disputed records', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/disputes')
    await expect(page.getByText('Disputed Records')).toBeVisible()
    assertNoErrors(errors)
  })

  test('attendance log page renders overview', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/attendance')
    await expect(page.getByText('Attendance Overview')).toBeVisible()
    await expect(page.getByText(/By Subject/)).toBeVisible()
    assertNoErrors(errors)
  })

  test('schedule page renders month + week views', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/schedule')
    await expect(page.getByRole('tab', { name: /Month/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Week/i })).toBeVisible()
    await page.getByRole('tab', { name: /Week/i }).click()
    await expect(page.getByRole('tab', { name: /Week/i })).toHaveAttribute('data-state', 'active')
    assertNoErrors(errors)
  })

  test('global search finds students and sections', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/search')
    await expect(page.getByText('Global Search')).toBeVisible()
    await page.getByPlaceholder(/Search students, subjects, sections/).fill('Reyes')
    await expect(page.getByText(/Alexandra Marie Reyes/i).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('create section flow adds a section to a subject', async ({ page }) => {
    const errors = trackErrors(page)
    const sectionName = `E2E-${Date.now() % 100000}`
    await page.goto('/faculty/sections/create?subjectId=subj-001')
    await expect(page.getByRole('heading', { name: 'Create Section' })).toBeVisible()
    await page.getByLabel('Section').fill(sectionName)
    await page.getByLabel('Room').fill('E2E Room')
    // Add one schedule entry
    await page.getByRole('button', { name: /Add/i }).click()
    await expect(page.getByText('09:00 - 10:30')).toBeVisible()
    await page.getByRole('button', { name: 'Create Section' }).click()
    // Lands back on the subject detail page with the new section visible
    await expect(page).toHaveURL(/\/faculty\/subjects\/subj-001$/, { timeout: 20_000 })
    await expect(page.getByText(sectionName).first()).toBeVisible()
    assertNoErrors(errors)
  })

  test('session QR activation shows scannable QR and ends the session', async ({ page }) => {
    const errors = trackErrors(page)
    const sessionId = await createDisposableSession(page)
    await page.goto(`/faculty/sessions/${sessionId}`)
    await page.getByRole('button', { name: /Generate QR Code/i }).click()
    // QR Settings dialog — use a short validity so the flow is fast and capped at 15
    await expect(page.getByRole('dialog')).toContainText('QR Settings')
    await page.getByLabel('QR Validity').fill('5')
    await page.getByLabel('Grace Period').fill('10')
    await page.getByRole('dialog').getByRole('button', { name: 'Generate', exact: true }).click()
    // QR image renders and countdown starts
    await expect(page.getByAltText('Scannable session QR code').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Expires in: \d{2}:\d{2}/)).toBeVisible()
    await expect(page.getByRole('button', { name: /End Session/i })).toBeVisible()
    // End session — accept the native confirm dialog
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: /End Session/i }).click()
    await expect(page.getByText('Inactive').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /End Session/i })).toHaveCount(0)
    assertNoErrors(errors)
  })

  test('teacher can manually cycle a student attendance status during a session', async ({ page }) => {
    const errors = trackErrors(page)
    const sessionId = await createDisposableSession(page, { daysFromNow: 11 })
    await page.goto(`/faculty/sessions/${sessionId}`)
    await page.getByRole('button', { name: /Generate QR Code/i }).click()
    await page.getByLabel('QR Validity').fill('5')
    await page.getByLabel('Grace Period').fill('10')
    await page.getByRole('dialog').getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByAltText('Scannable session QR code').first()).toBeVisible({ timeout: 20_000 })
    // Fresh session → all students pending; tap first roster row: pending → present → late
    const firstStudentRow = page.locator('button.w-full.border-b').first()
    await firstStudentRow.click()
    await expect(firstStudentRow.getByText('Present')).toBeVisible({ timeout: 20_000 })
    await firstStudentRow.click()
    await expect(firstStudentRow.getByText('Late')).toBeVisible({ timeout: 20_000 })
    assertNoErrors(errors)
  })

  test('attendance page exports a downloadable CSV', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/attendance')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Export CSV/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^attendance-.*\.csv$/)
    const file = await download.path()
    const content = require('fs').readFileSync(file, 'utf8')
    expect(content.trim().length).toBeGreaterThan(0)
    assertNoErrors(errors)
  })

  test('bulk session toggle calculates recurring session count', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/faculty/sessions/create')
    await page.getByLabel('Subject').selectOption({ label: 'Software Engineering (CCIS 3104)' })
    await page.getByLabel('Section').selectOption('sec-001')
    await page.getByLabel('Create recurring sessions for the semester').check()
    // Days prefill from the section schedule → a non-zero count is shown
    await expect(page.getByText(/[1-9]\d* sessions? will be created/)).toBeVisible()
    // Deselecting all weekdays drops the count to zero
    const dayCheckboxes = page.locator('label', { hasText: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/ }).locator('input[type=checkbox]')
    const count = await dayCheckboxes.count()
    for (let i = 0; i < count; i++) {
      await dayCheckboxes.nth(i).uncheck({ force: true })
    }
    await expect(page.getByText(/0 sessions will be created/)).toBeVisible()
    assertNoErrors(errors)
  })
})
