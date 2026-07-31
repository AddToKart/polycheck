import { test, expect } from '@playwright/test'
import { loginFaculty, trackErrors, assertNoErrors } from './helpers'

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
})
