import { test, expect } from '@playwright/test'
import { API_BASE, loginFaculty, apiLoginFaculty, apiLoginStudent, trackErrors, assertNoErrors } from './helpers'

test.use({ serviceWorkers: 'block' })

/**
 * Hybrid online attendance (HYB4):
 * - teacher creates an online session (zero-GPS),
 * - arms the start checkpoint with a meeting PIN,
 * - a student replays the signed token with no coordinates and the PIN,
 * - the server records the check-in and persists null coordinates (RA 10173).
 *
 * The student submission is driven through the API because the token only
 * exists on the teacher's screen; the UI assertions cover the cockpit and the
 * zero-GPS wizard.
 */
test.describe('Hybrid online attendance', () => {
  test('online session arms dual checkpoints and records a zero-GPS PIN check-in', async ({ page, request }) => {
    await loginFaculty(page)

    // Create a disposable online session on a free future date.
    let sessionId: string | null = null
    for (let offset = 20; offset < 60 && !sessionId; offset++) {
      const date = new Date()
      date.setDate(date.getDate() + offset)
      const response = await page.request.post(`${API_BASE}/sessions`, {
        data: {
          sectionId: 'sec-001',
          subjectName: 'Software Engineering',
          mode: 'online',
          date: date.toISOString().slice(0, 10),
          startTime: '08:00',
          endTime: '09:00',
        },
      })
      if (response.ok()) {
        sessionId = ((await response.json()) as { id: string }).id
        break
      }
      if (response.status() !== 409) {
        throw new Error(`Could not create online session: ${response.status()} ${await response.text()}`)
      }
    }
    expect(sessionId, 'a disposable online session should be created').toBeTruthy()

    const errors = trackErrors(page)
    await page.goto(`/faculty/sessions/${sessionId}`)
    await expect(page.getByText('Online · No GPS')).toBeVisible({ timeout: 20_000 })

    // Step 1: start-of-class checkpoint with a 2-digit PIN.
    await page.getByRole('tab', { name: /Step 1/ }).click()
    await page.getByRole('button', { name: /Generate Start QR/ }).click()
    await page.getByLabel('Require meeting PIN').check()
    await page.getByLabel('Meeting PIN', { exact: true }).fill('83')
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByText(/PIN 83/)).toBeVisible({ timeout: 20_000 })

    const armed = (await (await page.request.get(`${API_BASE}/sessions/${sessionId}`)).json()) as {
      startQrToken?: string
      pinRequired?: boolean
    }
    expect(armed.startQrToken, 'start checkpoint token should be persisted').toBeTruthy()
    expect(armed.pinRequired).toBe(true)

    // Student check-in: no coordinates, screenshot channel, announced PIN.
    await apiLoginStudent(request)
    const scanResponse = await request.post(`${API_BASE}/attendance/scan`, {
      data: {
        sessionId,
        qrToken: armed.startQrToken,
        deviceId: 'e2e-online-device',
        clientAttemptId: `e2e-online-${Date.now()}`,
        inputChannel: 'image',
        pin: '83',
        mocked: false,
      },
    })
    expect(scanResponse.ok(), await scanResponse.text()).toBeTruthy()
    const record = (await scanResponse.json()) as {
      coordinates: { latitude: number | null; longitude: number | null }
      checkInStatus?: string | null
      status: string
      error?: string
    }
    expect(record.error).toBeUndefined()
    expect(record.coordinates).toEqual({ latitude: null, longitude: null })
    expect(record.checkInStatus).toBe('present')
    // Online rows stay pending until the session closes (dual resolution).
    expect(record.status).toBe('pending')

    // Step 2: end-of-class checkpoint.
    await page.getByRole('tab', { name: /Step 2/ }).click()
    await page.getByRole('button', { name: /Generate End QR/ }).click()
    const endActivation = page.waitForResponse(
      (response) =>
        response.url().includes(`/sessions/${sessionId}/activate`) &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    )
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    const endResponse = await endActivation
    expect(endResponse.ok(), await endResponse.text()).toBeTruthy()
    const ended = (await (await page.request.get(`${API_BASE}/sessions/${sessionId}`)).json()) as {
      endQrToken?: string
    }
    expect(ended.endQrToken, 'end checkpoint token should be persisted').toBeTruthy()

    assertNoErrors(errors)
  })

  test('an online class that ends without an armed end checkpoint keeps check-in credit (V1)', async ({ page, request }) => {
    await apiLoginFaculty(request)

    let sessionId: string | null = null
    for (let offset = 20; offset < 90 && !sessionId; offset++) {
      const date = new Date()
      date.setDate(date.getDate() + offset)
      const response = await request.post(`${API_BASE}/sessions`, {
        data: {
          sectionId: 'sec-001',
          subjectName: 'Software Engineering',
          mode: 'online',
          date: date.toISOString().slice(0, 10),
          startTime: '13:00',
          endTime: '14:00',
        },
      })
      if (response.ok()) {
        sessionId = ((await response.json()) as { id: string }).id
        break
      }
      if (response.status() !== 409) {
        throw new Error(`Could not create online session: ${response.status()} ${await response.text()}`)
      }
    }
    expect(sessionId, 'a disposable online session should be created').toBeTruthy()

    const errors = trackErrors(page)
    await loginFaculty(page)
    await page.goto(`/faculty/sessions/${sessionId}`)
    await expect(page.getByText(/Online · No GPS/)).toBeVisible({ timeout: 20_000 })

    // Arm only the START checkpoint (no meeting PIN in this journey).
    await page.getByRole('tab', { name: /Step 1/ }).click()
    await page.getByRole('button', { name: /Generate Start QR/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByText(/QR is live/)).toBeVisible({ timeout: 20_000 })
    const armed = (await (await page.request.get(`${API_BASE}/sessions/${sessionId}`)).json()) as {
      startQrToken?: string
    }
    expect(armed.startQrToken, 'start checkpoint token should be persisted').toBeTruthy()

    // Student checks in (zero-GPS, PIN-free).
    await apiLoginStudent(request)
    const scanResponse = await request.post(`${API_BASE}/attendance/scan`, {
      data: {
        sessionId,
        qrToken: armed.startQrToken,
        deviceId: 'e2e-v1-device',
        clientAttemptId: `e2e-v1-${Date.now()}`,
        inputChannel: 'image',
        mocked: false,
      },
    })
    expect(scanResponse.ok(), await scanResponse.text()).toBeTruthy()
    const scanned = (await scanResponse.json()) as {
      success: boolean
      checkInStatus?: string | null
      status: string
      pinRequired?: boolean
      error?: string
    }
    // The start arm has no meeting PIN in this journey; a PIN payload is safe
    // to send and ignored by the server.
    expect(scanned.error ?? '').not.toContain('pin')
    expect(scanned.error).toBeUndefined()
    expect(scanned.checkInStatus).toBe('present')
    expect(scanned.status).toBe('pending')

    // The professor's laptop dies: the class is closed WITHOUT Step 2 having
    // ever been armed. The close must keep the check-in credit.
    await apiLoginFaculty(request)
    const endResponse = await request.post(`${API_BASE}/sessions/${sessionId}/end`, {
      failOnStatusCode: false,
    })
    expect(endResponse.ok(), await endResponse.text()).toBeTruthy()

    // The student's row (with the student cookie) now reads present, never
    // incomplete/missed_checkout.
    await apiLoginStudent(request)
    const listResponse = await request.get(`${API_BASE}/attendance/student/s-001`)
    const list = (await listResponse.json()) as Array<{
      sessionId: string
      status: string
      notes?: string | null
      checkInStatus?: string | null
    }>
    const record = list.find((row) => row.sessionId === sessionId)
    expect(record, 'the scanned session record should be visible to the student').toBeTruthy()
    expect(record?.status, 'without an armed end checkpoint the close keeps check-in credit').toBe('present')
    expect(record?.notes ?? '', 'no missed_checkout note may be written').not.toContain('missed_checkout')

    assertNoErrors(errors)
  })
})
