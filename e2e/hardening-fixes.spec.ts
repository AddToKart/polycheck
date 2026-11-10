import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  API_BASE,
  SEED_PASSWORD,
  FACULTY_EMAIL,
  STUDENT_ID,
  apiLoginFaculty,
  apiLoginStudent,
  apiLogout,
  loginFaculty,
  trackErrors,
  assertNoErrors,
  installSessionCleanup,
} from './helpers'

installSessionCleanup()

test.use({ serviceWorkers: 'block' })

/**
 * Vulnerability-hardening patch wave (plan/vulnerability-hardening-plan.md):
 * - V2: concurrent-session conflict — a second scan in a schedule-overlapping
 *   class is disputed, never silently credited (teleportation trap).
 * - V3: enrollment tombstone — a removed student cannot re-enter an unexpired
 *   code; teacher re-enrollment re-admits explicitly.
 * - V4: teacher activation geofence — an in-person activation from far
 *   off-campus requires the explicit override confirm (audited).
 *
 * Cockpit arming is driven through the real UI because tokens are signed
 * client-side; scans/roster/activation-with-coordinates go through the API.
 */

test.describe('V2 — concurrent-session conflict', () => {
  test('a second overlapping class scan is disputed with the conflicting subject name', async ({ page, request }) => {
    await apiLoginFaculty(request)

    // Run-unique overlapping slots so consecutive runs never inherit each
    // other's stored scans (the conflict flag is data-visible across runs by
    // design, so A must be the student's only recent intersecting credit).
    // A and B are created on the SAME date atomically — a partial pairing is
    // discarded rather than adopting one side on another day.
    const slotBase = 3 + (Math.floor(Date.now() / 60_000) % 17)
    const pad = (value: number) => String(value).padStart(2, '0')
    const slotA = { startTime: `01:${pad(slotBase)}`, endTime: `01:${pad(slotBase + 10)}` }
    const slotB = { startTime: `01:${pad(slotBase + 5)}`, endTime: `01:${pad(slotBase + 15)}` }
    let sessionIdA: string | null = null
    let sessionIdB: string | null = null
    for (let offset = 20; offset < 90 && !sessionIdA; offset++) {
      const date = new Date()
      date.setDate(date.getDate() + offset)
      const dateStr = date.toISOString().slice(0, 10)
      const create = async (slot: { startTime: string; endTime: string }) => {
        const res = await request.post(`${API_BASE}/sessions`, {
          data: {
            sectionId: 'sec-001',
            subjectName: 'Software Engineering',
            mode: 'online',
            date: dateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
          failOnStatusCode: false,
        })
        if (res.ok()) return ((await res.json()) as { id: string }).id
        if (res.status() !== 409) {
          throw new Error(`Could not create online session: ${res.status()} ${await res.text()}`)
        }
        return null
      }
      const a = await create(slotA)
      const b = await create(slotB)
      if (a && b) {
        sessionIdA = a
        sessionIdB = b
      }
    }
    expect(sessionIdA, 'paired session A fixture').toBeTruthy()
    expect(sessionIdB, 'paired session B fixture').toBeTruthy()

    // Arm both start checkpoints through the cockpit (client-signed tokens).
    for (const sessionId of [sessionIdA, sessionIdB]) {
      await loginFaculty(page)
      await page.goto(`/faculty/sessions/${sessionId}`)
      await expect(page.getByText(/Online · No GPS/)).toBeVisible({ timeout: 20_000 })
      await page.getByRole('tab', { name: /Step 1/ }).click()
      await page.getByRole('button', { name: /Generate Start QR/ }).click()
      await page.getByRole('button', { name: 'Generate', exact: true }).click()
      await expect(page.getByText(/QR is live/)).toBeVisible({ timeout: 20_000 })
    }
    const tokenA = (
      ((await (await page.request.get(`${API_BASE}/sessions/${sessionIdA}`)).json()) as { startQrToken?: string }) ??
      {}
    ).startQrToken
    const tokenB = (
      ((await (await page.request.get(`${API_BASE}/sessions/${sessionIdB}`)).json()) as { startQrToken?: string }) ??
      {}
    ).startQrToken
    expect(tokenA, 'start token A').toBeTruthy()
    expect(tokenB, 'start token B').toBeTruthy()

    await apiLoginStudent(request)
    const scanA = await request.post(`${API_BASE}/attendance/scan`, {
      data: {
        sessionId: sessionIdA,
        qrToken: tokenA,
        deviceId: 'e2e-v2-device',
        clientAttemptId: `e2e-v2-a-${Date.now()}`,
        inputChannel: 'image',
        mocked: false,
      },
      failOnStatusCode: false,
    })
    const resultA = (await scanA.json()) as { checkInStatus?: string | null; error?: string }
    expect(resultA.error ?? '', `scan A response: ${scanA.status()}`).toBe('')
    expect(resultA.checkInStatus, 'the first overlapping scan must be accepted').toBe('present')

    const scanB = await request.post(`${API_BASE}/attendance/scan`, {
      data: {
        sessionId: sessionIdB,
        qrToken: tokenB,
        deviceId: 'e2e-v2-device',
        clientAttemptId: `e2e-v2-b-${Date.now()}`,
        inputChannel: 'image',
        mocked: false,
      },
      failOnStatusCode: false,
    })
    expect(scanB.status(), 'the conflict is flagged, not crashed').toBeLessThan(500)
    const resultB = (await scanB.json()) as {
      status: string
      disputeReason?: string
      disputeDescription?: string
      error?: string
    }
    expect(resultB.error ?? '').toBe('')
    expect(resultB.status).toBe('disputed')
    expect(resultB.disputeReason).toBe('concurrent_session_conflict')
    expect(resultB.disputeDescription ?? '').toContain('Software Engineering')

    // The teacher's dispute rail surfaces the flagged record.
    const disputesResponse = await request.get(`${API_BASE}/disputes`)
    expect(disputesResponse.ok(), await disputesResponse.text()).toBeTruthy()
    const disputes = (await disputesResponse.json()) as Array<{
      id: string
      sessionId: string
      disputeReason?: string
      disputeDescription?: string
    }>
    const flagged = disputes.find((row) => row.sessionId === sessionIdB)
    expect(flagged, 'the concurrent conflict record should appear in the dispute rail').toBeTruthy()
    expect(flagged?.disputeReason).toBe('concurrent_session_conflict')
    expect(flagged?.disputeDescription ?? '').toContain('Software Engineering')
  })
})

test.describe('V3 — enrollment tombstone', () => {
  test('a removed student is refused at the enrollment code and re-admitted only by the teacher', async ({ request }) => {
    await apiLoginFaculty(request)

    // Resolve the section's live enrollment code (teacher scope).
    const sectionRes = await request.get(`${API_BASE}/sections/sec-002`)
    expect(sectionRes.ok(), await sectionRes.text()).toBeTruthy()
    const section = (await sectionRes.json()) as { enrollmentCode?: string | null }
    expect(section.enrollmentCode, 'the section exposes a live code to its teacher').toBeTruthy()

    const ZOMBIE_USER_ID = 's-002'
    const ZOMBIE_STUDENT_ID = '2024-00002-MN-0'

    // Seed the enrollment and then explicitly remove the student by the
    // instructor — the canonical zombie-student setup.
    const seedEnroll = await request.post(`${API_BASE}/sections/sec-002/enroll-student`, {
      data: { studentId: ZOMBIE_USER_ID, studentName: 'Benjamin Lucas Santos' },
    })
    expect(seedEnroll.ok(), await seedEnroll.text()).toBeTruthy()
    const remove = await request.delete(`${API_BASE}/sections/sec-002/students/${ZOMBIE_USER_ID}`)
    expect(remove.ok(), await remove.text()).toBeTruthy()

    // The zombie attempts the still-live code: 403, typed, non-re-enrolling.
    await apiLoginStudent(request, ZOMBIE_STUDENT_ID)
    const blocked = await request.post(`${API_BASE}/sections/enroll-by-code`, {
      data: { enrollmentCode: section.enrollmentCode },
      failOnStatusCode: false,
    })
    expect(blocked.status()).toBe(403)
    const blockedBody = (await blocked.json()) as { code?: string; message?: string }
    expect(blockedBody.code).toBe('student_blocked_from_section')
    expect(blockedBody.message ?? '').toContain('removed from this section by the instructor')

    // Student logins are single-device now: the first device-less login leaves
    // a live (legacy, null-device) session, and a second device-less login in
    // the same API context would be rejected by the active-session gate.
    // Revoke it non-armingly before switching the jar to the teacher.
    expect((await apiLogout(request)).ok(), 'student session revoked before re-admission').toBeTruthy()

    // Explicit teacher re-admission clears the tombstone and enrolls.
    await apiLoginFaculty(request)
    const readmit = await request.post(`${API_BASE}/sections/sec-002/enroll-student`, {
      data: { studentId: ZOMBIE_USER_ID, studentName: 'Benjamin Lucas Santos' },
    })
    expect(readmit.ok(), await readmit.text()).toBeTruthy()

    // Restore the seed state (the section stays enrollment-free) — and the
    // fresh block persists for any later device-side retries.
    const reRemove = await request.delete(`${API_BASE}/sections/sec-002/students/${ZOMBIE_USER_ID}`)
    expect(reRemove.ok(), await reRemove.text()).toBeTruthy()
    await apiLoginStudent(request, ZOMBIE_STUDENT_ID)
    const reBlocked = await request.post(`${API_BASE}/sections/enroll-by-code`, {
      data: { enrollmentCode: section.enrollmentCode },
      failOnStatusCode: false,
    })
    expect(reBlocked.status()).toBe(403)
    const reBlockedBody = (await reBlocked.json()) as { code?: string }
    expect(reBlockedBody.code).toBe('student_blocked_from_section')

    // Leave no live student session behind for later specs.
    expect((await apiLogout(request)).ok(), 'student session revoked at test end').toBeTruthy()
  })
})

test.describe('V4 — teacher activation geofence', () => {
  let inPersonSession: string | null = null

  async function createInPersonSession(
    context: APIRequestContext,
    slot: { startTime: string; endTime: string },
  ): Promise<string | null> {
    for (let offset = 20; offset < 90; offset++) {
      const date = new Date()
      date.setDate(date.getDate() + offset)
      const res = await context.request.post(`${API_BASE}/sessions`, {
        data: {
          sectionId: 'sec-001',
          subjectName: 'Software Engineering',
          mode: 'in_person',
          date: date.toISOString().slice(0, 10),
          startTime: slot.startTime,
          endTime: slot.endTime,
          geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 50 },
        },
        failOnStatusCode: false,
      })
      if (res.ok()) return ((await res.json()) as { id: string }).id
      if (res.status() !== 409) {
        throw new Error(`Could not create in-person session: ${res.status()} ${await res.text()}`)
      }
    }
    return null
  }

  test('an activation far outside the geofence requires the explicit override confirm', async ({ browser }) => {
    const fixture = await browser.newContext()
    await apiLoginFaculty(fixture.request)
    inPersonSession = await createInPersonSession(fixture, { startTime: '16:00', endTime: '17:00' })
    await fixture.close()
    test.skip(!inPersonSession, 'no free in-person date fixture')

    const errors: string[] = []
    const context = await browser.newContext({
      geolocation: { latitude: 14.05, longitude: 121.4 },
      permissions: ['geolocation'],
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })

    await loginFaculty(page)
    await page.goto(`/faculty/sessions/${inPersonSession}`)
    await expect(page.getByRole('button', { name: /Generate QR code/i })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /Generate QR code/i }).click()
    // The default validity (15) + grace (15) are accepted as-is.
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText(/Outside the classroom geofence/)).toBeVisible({ timeout: 20_000 })
    await expect(dialog.getByText(/recorded in the institutional audit log/)).toBeVisible()
    await dialog.getByRole('button', { name: /Activate anyway/ }).click()

    await expect(page.getByText(/QR Code Generated/)).toBeVisible({ timeout: 20_000 })
    await expect
      .poll(async () => errors.filter((entry) => entry.includes('teacher_location_outside_geofence')).length)
      .toBe(0)

    // The override is on the audit trail (super-admin scope).
    await apiLoginFaculty(page.request, FACULTY_EMAIL)
    const admin = await browser.newContext()
    await apiLoginFaculty(admin.request, 'mcreyes@pup.edu.ph')
    const auditResponse = await admin.request.get(
      `${API_BASE}/audit-logs?action=session.activation_override&pageSize=50`,
      { failOnStatusCode: false },
    )
    expect(auditResponse.ok(), await auditResponse.text()).toBeTruthy()
    const audit = (await auditResponse.json()) as { items?: Array<{ action: string; entityId?: string }> }
    expect(audit.items ?? []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'session.activation_override', entityId: inPersonSession }),
      ]),
    )
    await admin.close()
    await context.close()
  })

  test('an in-range geolocation activates without the override dialog', async ({ browser }) => {
    const fixture = await browser.newContext()
    await apiLoginFaculty(fixture.request)
    const inRangeSession = await createInPersonSession(fixture, { startTime: '18:00', endTime: '19:00' })
    await fixture.close()
    test.skip(!inRangeSession, 'no free in-person date fixture')

    const pageErrors: string[] = []
    const context = await browser.newContext({
      geolocation: { latitude: 14.86972, longitude: 120.99912 },
      permissions: ['geolocation'],
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await loginFaculty(page)
    await page.goto(`/faculty/sessions/${inRangeSession}`)
    await page.getByRole('button', { name: /Generate QR code/i }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByText(/QR Code Generated/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await context.close()
    expect(pageErrors).toEqual([])
  })
})
