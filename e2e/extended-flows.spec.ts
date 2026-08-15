import { test, expect, request as pwRequest } from '@playwright/test'
import {
  loginFaculty,
  loginStudent,
  trackErrors,
  assertNoErrors,
  SEED_PASSWORD,
  FACULTY_EMAIL,
  ADMIN_EMAIL,
} from './helpers'

const API = 'http://localhost:4000/api'
const CYCLE_LABELS = ['Present', 'Late', 'Absent']

function uniqueStudentId() {
  return `2999-${String(Date.now() % 100000).padStart(5, '0')}-MN-0`
}

test.describe('Privacy Consent Gate', () => {
  let createdStudentId: string | undefined
  let createdStudentNumber = ''

  test.afterEach(async () => {
    if (!createdStudentId) return
    // Disable the disposable student so it can never authenticate again.
    const apiContext = await pwRequest.newContext()
    try {
      await apiContext.post(`${API}/auth/login/faculty`, {
        data: { email: ADMIN_EMAIL, password: SEED_PASSWORD },
      })
      await apiContext.patch(`${API}/users/${createdStudentId}/status`, { data: { isActive: false } })
    } finally {
      await apiContext.dispose()
    }
  })

  test('a fresh student without consent sees the gate, accepts, and the gate clears', async ({ page }) => {
    createdStudentNumber = uniqueStudentId()
    const password = 'E2eTempPass1!'
    const email = `e2e.consent.${Date.now()}@iskolar.pup.edu.ph`

    // Super admin creates a student who has never consented to the privacy notice.
    const apiContext = await pwRequest.newContext()
    try {
      await apiContext.post(`${API}/auth/login/faculty`, {
        data: { email: ADMIN_EMAIL, password: SEED_PASSWORD },
      })
      const createRes = await apiContext.post(`${API}/users/students`, {
        data: {
          fullName: 'E2E Consent Student',
          studentId: createdStudentNumber,
          email,
          password,
          program: 'BSIT',
          yearLevel: 1,
          department: 'CCIS',
        },
      })
      expect(createRes.ok()).toBeTruthy()
      createdStudentId = ((await createRes.json()) as { id: string }).id
    } finally {
      await apiContext.dispose()
    }

    // The student logs in and is immediately blocked by the global consent gate.
    await page.goto('/login/student')
    await page.getByLabel('Student Number').fill(createdStudentNumber)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /Authenticate/i }).click()

    const gate = page.getByRole('dialog', { name: /Attendance uses location evidence/i })
    await expect(gate).toBeVisible({ timeout: 20_000 })
    await expect(gate.getByText('Privacy consent')).toBeVisible()
    await expect(gate.getByRole('button', { name: /I understand and consent/i })).toBeVisible()

    // Accepting records consent and clears the overlay.
    await gate.getByRole('button', { name: /I understand and consent/i }).click()
    await expect(gate).toHaveCount(0, { timeout: 20_000 })
  })
})

test.describe('Faculty Student Detail', () => {
  test.beforeEach(async ({ page }) => {
    await loginFaculty(page)
  })

  test('flips the PUP ID card and cycles attendance statuses back to the original', async ({ page }) => {    const errors = trackErrors(page)
    await page.goto('/faculty/students/s-001?sectionId=sec-001')
    // level: 1 — the ID card also renders the student name as an h2.
    await expect(page.getByRole('heading', { level: 1, name: 'Alexandra Marie Reyes' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('POLYTECHNIC UNIVERSITY')).toBeVisible()

    // Playwright does not honor backface-visibility, so the flip state must be
    // asserted through the rotateY class on the preserve-3d wrapper. Click the
    // card container itself (force: pointer precision is not the point here).
    const card = page.locator('div.cursor-pointer.group')
    const cardWrapper = page.locator('div[class*="preserve-3d"]')
    await expect(cardWrapper).not.toHaveClass(/rotateY\(180deg\)/)

    // Flip to the back face.
    await card.click({ force: true })
    await expect(cardWrapper).toHaveClass(/rotateY\(180deg\)/, { timeout: 10_000 })

    // Flip back to the front face.
    await card.click({ force: true })
    await expect(cardWrapper).not.toHaveClass(/rotateY\(180deg\)/, { timeout: 10_000 })

    // Find a session row whose status is one of the three cyclable states
    // (records may also be Pending/Disputed, which are not in the cycle). The
    // seed only has records for s-001 on older sessions, so scan the 5-per-page
    // pagination until a cyclable record is found.
    const statusButtons = page.locator('button:has(.lucide-refresh-cw)')
    const findCyclable = async () => {
      const count = await statusButtons.count()
      for (let i = 0; i < count; i++) {
        const label = (await statusButtons.nth(i).innerText()).trim()
        if (CYCLE_LABELS.includes(label)) return statusButtons.nth(i)
      }
      return null
    }
    let cycleButton = await findCyclable()
    for (let guard = 0; !cycleButton && guard < 10; guard++) {
      const next = page.getByRole('button', { name: 'Next', exact: true })
      if (!(await next.isEnabled().catch(() => false))) break
      await next.click()
      await page.waitForTimeout(400)
      cycleButton = await findCyclable()
    }
    test.skip(!cycleButton, 'No cyclable attendance record found on the seed student')
    await expect(cycleButton!).toBeVisible()

    const original = (await cycleButton.innerText()).trim()
    const expectedNext = CYCLE_LABELS[(CYCLE_LABELS.indexOf(original) + 1) % CYCLE_LABELS.length]
    await cycleButton.click()
    await expect(cycleButton).toContainText(expectedNext, { timeout: 10_000 })
    // Two more clicks complete the 3-state cycle back to the original status.
    await cycleButton.click()
    await cycleButton.click()
    await expect(cycleButton).toContainText(original, { timeout: 10_000 })
    assertNoErrors(errors)
  })
})

test.describe('Faculty Student Detail (disposable section)', () => {
  // No shared beforeEach: a same-account API login would invalidate the
  // browser session (single-active-session), so the browser login happens
  // inside the test, after all API setup is complete.
  test('removes a student from a disposable section and cleans up via API', async ({ page }) => {
    const errors = trackErrors(page)
    // Use an isolated API context: single-active-session enforcement invalidates
    // a same-account session on every new login, so the API jar and the browser
    // session must never overlap for the same teacher.
    const apiContext = await pwRequest.newContext()
    try {
      await apiContext.post(`${API}/auth/login/faculty`, {
        data: { email: FACULTY_EMAIL, password: SEED_PASSWORD },
      })
      const secRes = await apiContext.post(`${API}/sections`, {
        data: {
          subjectId: 'subj-001',
          section: `E2E-Temp-${Date.now() % 100000}`,
          room: 'E2E Room',
          schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:30' }],
          semester: '2026-2027',
        },
      })
      expect(secRes.ok()).toBeTruthy()
      const sectionId = ((await secRes.json()) as { id: string }).id
      const enrollRes = await apiContext.post(`${API}/sections/${sectionId}/enroll-student`, {
        data: { studentId: 's-001', studentName: 'Alexandra Marie Reyes' },
      })
      expect(enrollRes.ok()).toBeTruthy()

      // Browser login as the same teacher (replaces the API session, which is
      // fine — all API setup is done).
      await loginFaculty(page)

      // Open the student detail scoped to the disposable section and remove via UI.
      await page.goto(`/faculty/students/s-001?sectionId=${sectionId}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Alexandra Marie Reyes' })).toBeVisible({
        timeout: 20_000,
      })
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: /Remove from Subject/i }).click()
      await page.waitForURL((url) => url.pathname === `/faculty/sections/${sectionId}`, { timeout: 20_000 })

      // Verify through the UI: the section roster no longer lists the student.
      await expect(page.getByText(/Alexandra Marie Reyes/i)).toHaveCount(0, { timeout: 15_000 })
      assertNoErrors(errors)

      // Cleanup last: re-login the API context (this replaces the browser
      // session, but no further page assertions run) and delete the section.
      await apiContext.post(`${API}/auth/login/faculty`, {
        data: { email: FACULTY_EMAIL, password: SEED_PASSWORD },
      })
      const delRes = await apiContext.delete(`${API}/sections/${sectionId}`)
      expect(delRes.ok()).toBeTruthy()
    } finally {
      await apiContext.dispose()
    }
  })
})

test.describe('Student Officer Session Creation', () => {
  test('a section president with an active permission creates a session', async ({ page }) => {
    const errors = trackErrors(page)
    // s-001 is seeded as President of sec-001 but has no session permission row;
    // grant a 24-hour permission so the create-session authorization passes.
    // Isolated API context: the browser logs in as the student afterwards.
    const apiContext = await pwRequest.newContext()
    try {
      await apiContext.post(`${API}/auth/login/faculty`, {
        data: { email: FACULTY_EMAIL, password: SEED_PASSWORD },
      })
      const grant = await apiContext.post(`${API}/session-permissions`, {
        data: { sectionId: 'sec-001', studentId: 's-001' },
      })
      expect(grant.ok()).toBeTruthy()

      await loginStudent(page)

      await page.goto('/student/subjects/sec-001/create-session')
      await expect(page.getByRole('heading', { name: 'Create Session' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText(/Software Engineering/i).first()).toBeVisible()

      // Pick a date/time combination that does not collide with existing
      // sessions: the unique (section, date, startTime, endTime) constraint
      // makes a 409 otherwise, and the UI does not surface that error.
      const existing = (await (await apiContext.get(`${API}/sessions?sectionId=sec-001`)).json()) as Array<{
        date: string
        startTime: string
        endTime: string
      }>
      const used = new Set(existing.map((s) => `${s.date}:${s.startTime}:${s.endTime}`))
      const startTime = '09:00'
      const endTime = '10:30'
      let iso = ''
      for (let days = 60; days < 365 && !iso; days++) {
        const candidate = new Date()
        candidate.setDate(candidate.getDate() + days)
        const candidateIso = candidate.toISOString().slice(0, 10)
        if (!used.has(`${candidateIso}:${startTime}:${endTime}`)) iso = candidateIso
      }
      expect(iso).toBeTruthy()
      await page.getByLabel('Date').fill(iso)
      await page.getByLabel('Room').fill('E2E Officer Room')

      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: 'Create Session', exact: true }).click()
      await page.waitForURL((url) => url.pathname === '/student/subjects/sec-001', { timeout: 20_000 })

      // The session is persisted with the expected date.
      const sessions = (await (await apiContext.get(`${API}/sessions?sectionId=sec-001`)).json()) as Array<{
        date: string
      }>
      expect(sessions.some((s) => s.date === iso)).toBeTruthy()
      assertNoErrors(errors)
    } finally {
      // Cleanup: revoke the permission granted for this test.
      await apiContext.delete(`${API}/session-permissions/sec-001/s-001`)
      await apiContext.dispose()
    }
  })
})
