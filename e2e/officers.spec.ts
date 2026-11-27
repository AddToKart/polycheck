import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import {
  ADMIN_EMAIL,
  API_BASE,
  apiLoginFaculty,
  loginFaculty,
  loginStudent,
  revokeBrowserSession,
  installSessionCleanup,
  trackErrors,
  assertNoErrors,
} from './helpers'

installSessionCleanup()

/**
 * Section officers end to end: the professor assigns a President (two sessions, 8 hours) and a QAC; the
 * President creates both sessions, starts one from the browser, classmates scan its QR, and the President ends it;
 * the QAC adds class photos; the professor sees them. Uses a new subject and section each run, with the seeded
 * student as both officers and disposable classmates.
 */
const STUDENT_NUMBER = '2024-00001-MN-0'
const ORIGIN = { origin: 'http://localhost:3000' }
const CLASSMATE_PASSWORD = 'PolycheckE2e1!'
const GATEWAY = 'http://localhost:4001'
const AREA = { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 }

/** Campus (UTC+8) date and clock time, `minutes` from now. */
function campus(minutes: number) {
  const iso = new Date(Date.now() + 8 * 3_600_000 + minutes * 60_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

type Method = 'get' | 'post' | 'delete'

async function call<T>(request: APIRequestContext, method: Method, path: string, data?: unknown): Promise<T> {
  const response = await request[method](`${API_BASE}${path}`, { headers: ORIGIN, data })
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy()
  return (await response.json()) as T
}

const send = <T>(page: Page, method: Method, path: string, data?: unknown) =>
  call<T>(page.request, method, path, data)

interface Classmate {
  id: string
  studentId: string
  fullName: string
}

/** Disposable students, so no seeded account is signed in somewhere else by this test. */
async function createClassmate(admin: APIRequestContext, label: string): Promise<Classmate> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const studentId = `2026-${Math.floor(10000 + Math.random() * 89999)}-MN-0`
    const fullName = `E2E Classmate ${label} ${studentId.slice(5, 10)}`
    const response = await admin.post(`${API_BASE}/users/students`, {
      headers: ORIGIN,
      data: { fullName, studentId, department: 'CCIS', program: 'BS Computer Science', yearLevel: 1, password: CLASSMATE_PASSWORD },
    })
    if (response.ok()) return { id: ((await response.json()) as { id: string }).id, studentId, fullName }
    if (response.status() !== 409) throw new Error(`Could not create a classmate: ${await response.text()}`)
  }
  throw new Error('Could not find a free student number')
}

function scanBody(sessionId: string, qrToken: string) {
  const now = new Date().toISOString()
  return {
    sessionId,
    qrToken,
    lat: AREA.latitude,
    lon: AREA.longitude,
    accuracyMeters: 8,
    locationCapturedAt: now,
    scannedAt: now,
    inputChannel: 'camera',
    mocked: false,
    clientAttemptId: crypto.randomUUID(),
  }
}

/** A large, detailed JPEG made in the browser, standing in for a phone photo. */
async function bigPhoto(page: Page, seed: number) {
  const dataUrl = await page.evaluate((offset) => {
    const canvas = document.createElement('canvas')
    canvas.width = 3200
    canvas.height = 2400
    const context = canvas.getContext('2d')!
    for (let index = 0; index < 4000; index += 1) {
      context.fillStyle = `hsl(${(index * 37 + offset * 53) % 360} 60% ${30 + (index % 50)}%)`
      context.fillRect((index * 131) % 3200, (index * 197) % 2400, 40 + (index % 160), 30 + (index % 120))
    }
    return canvas.toDataURL('image/jpeg', 0.98)
  }, seed)
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

/** On a small phone the page must not scroll sideways. A screenshot is kept for review. */
async function fitsPhone(page: Page, name: string) {
  const size = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 700 })
  await page.waitForTimeout(600)
  const width = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))
  expect(width, `${name} scrolls sideways on a 320px phone`).toBeLessThanOrEqual(321)
  await page.screenshot({ path: `e2e/captures/officers/${name}.png`, fullPage: true })
  await page.setViewportSize(size)
}

const loadedImages = (page: Page) =>
  page
    .getByRole('img', { name: /^Class photo from/ })
    .evaluateAll((images) => images.filter((image) => (image as HTMLImageElement).naturalWidth > 0).length)

test.describe('Section officers', () => {
  test('president runs a session classmates can scan, the QAC adds photos, the professor sees both', async ({
    page,
    context,
    browserName,
    playwright,
  }) => {
    test.skip(browserName !== 'chromium', 'One browser is enough for this long journey')
    test.setTimeout(300_000)
    const stamp = Date.now().toString().slice(-7)
    const admin = await playwright.request.newContext()
    await apiLoginFaculty(admin, ADMIN_EMAIL)
    const first = await createClassmate(admin, 'A')
    const second = await createClassmate(admin, 'B')
    await call(admin, 'post', '/auth/logout', { armDeviceCooldown: false })

    // ---------- professor: a fresh section with the three students in it
    await loginFaculty(page)
    const subject = await send<{ id: string }>(page, 'post', '/subjects', {
      name: `E2E Officers ${stamp}`,
      code: `E2EO-${stamp}`,
    })
    const today = campus(0).date
    const section = await send<{ id: string }>(page, 'post', '/sections', {
      subjectId: subject.id,
      section: '4-1',
      course: 'BSIT',
      room: 'Officer Room',
      semester: '1st Semester AY 2026-2027',
      schedule: [{ day: 'Mon', startTime: '09:00', endTime: '10:00' }],
    })
    const directory = await send<Array<{ id: string; studentId: string; fullName: string }>>(page, 'get', '/users/students')
    const student = directory.find((entry) => entry.studentId === STUDENT_NUMBER)!
    for (const member of [student, first, second]) {
      await send(page, 'post', `/sections/${section.id}/enroll-student`, {
        studentId: member.id,
        studentName: member.fullName,
      })
    }

    // assign both roles on the real screen: two sessions, 8 hours
    await page.goto(`/faculty/sections/${section.id}`)
    await page.getByRole('button', { name: 'Assign President' }).click()
    await page.getByRole('button', { name: new RegExp(STUDENT_NUMBER) }).click()
    await page.getByLabel('Number of sessions allowed').fill('2')
    await page.getByLabel('How long the permission lasts').selectOption('8')
    await page.getByRole('button', { name: 'Give permission' }).click()
    await expect(page.getByText(/0 of 2 sessions used/)).toBeVisible()
    await page.getByRole('button', { name: 'Assign QAC' }).click()
    await page.getByRole('button', { name: new RegExp(STUDENT_NUMBER) }).click()
    await expect(page.getByText('No QAC assigned')).toHaveCount(0)
    await fitsPhone(page, 'teacher-officers')

    const permissions = await send<Array<{ expiresAt: string; grantedAt: string; sessionLimit: number }>>(
      page,
      'get',
      `/session-permissions/${section.id}`,
    )
    expect(permissions[0].sessionLimit).toBe(2)
    expect(new Date(permissions[0].expiresAt).getTime() - new Date(permissions[0].grantedAt).getTime()).toBe(8 * 3_600_000)

    // ---------- president: creates both allowed sessions
    await revokeBrowserSession(page)
    await loginStudent(page)
    const errors = trackErrors(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: AREA.latitude, longitude: AREA.longitude, accuracy: 10 })
    await page.goto(`/student/subjects/${section.id}`)
    await expect(page.getByText(/You can create 2 more sessions until/)).toBeVisible()
    await page.getByRole('button', { name: 'Create Session' }).click()
    await page.getByLabel('Date').fill(today)
    await page.getByLabel('Start Time').fill(campus(-10).time)
    await page.getByLabel('End Time').fill(campus(80).time)
    await page.getByRole('button', { name: 'Create Session' }).click()
    await page.waitForURL(new RegExp(`/student/subjects/${section.id}/sessions/`), { timeout: 30_000 })
    const sessionId = page.url().split('/').pop()!

    const sessionData = (start: number) => ({
      sectionId: section.id,
      subjectName: 'ignored',
      date: today,
      startTime: campus(start).time,
      endTime: campus(start + 30).time,
      geofence: AREA,
    })
    await send(page, 'post', '/sessions', sessionData(120))
    const third = await page.request.post(`${API_BASE}/sessions`, { headers: ORIGIN, data: sessionData(200) })
    expect(third.status(), `a third session must be refused: ${await third.text()}`).toBe(403)
    await page.goto(`/student/subjects/${section.id}`)
    await expect(page.getByText(/You have used all 2 of your sessions/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Session' })).toBeDisabled()
    await expect(page.getByText('You run this').first()).toBeVisible()
    await fitsPhone(page, 'president-used-up')

    // the professor's activation route stays closed to the president
    const asProfessor = await page.request.post(`${API_BASE}/sessions/${sessionId}/activate`, {
      headers: ORIGIN,
      data: { validityMinutes: 5, token: 'x'.repeat(100) },
    })
    expect(asProfessor.status()).toBe(403)

    // ---------- president: starts it, inside the class area
    await page.goto(`/student/subjects/${section.id}/sessions/${sessionId}`)
    await page.getByRole('button', { name: 'Start session' }).click()
    await expect(page.getByText('You were marked present.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('img', { name: 'Attendance QR code for this session' })).toBeVisible()
    await expect(page.getByText('1 of 3 checked in')).toBeVisible()

    const hosted = await send<{ qrToken: string }>(page, 'get', `/sessions/${sessionId}/host`)

    // ---------- classmates scan the president's QR: through the server, and through the scan gateway
    const phone = await playwright.request.newContext()
    await call(phone, 'post', '/auth/login/student', {
      studentId: first.studentId,
      password: CLASSMATE_PASSWORD,
      deviceId: `web-officers-${stamp}`,
    })
    const notice = await call<{ version: string }>(phone, 'get', '/auth/privacy-notice')
    await call(phone, 'post', '/auth/privacy-consent', { version: notice.version })
    const scanned = await call<{ status: string; disputeReason?: string | null }>(phone, 'post', '/attendance/scan', {
      ...scanBody(sessionId, hosted.qrToken),
      deviceId: `web-officers-${stamp}`,
    })
    expect([scanned.status, scanned.disputeReason ?? null]).toEqual(['present', null])
    await expect(page.getByText('2 of 3 checked in')).toBeVisible({ timeout: 20_000 })

    let expected = 2
    const gatewayUp = await phone
      .get(`${GATEWAY}/health/ready`, { timeout: 3_000 })
      .then((response) => response.ok())
      .catch(() => false)
    if (gatewayUp) {
      const handset = await playwright.request.newContext()
      const login = await call<{ token: string }>(handset, 'post', '/auth/mobile/login/student', {
        studentId: second.studentId,
        password: CLASSMATE_PASSWORD,
        deviceId: `mobile-officers-${stamp}`,
      })
      const bearer = { authorization: `Bearer ${login.token}` }
      await handset.post(`${API_BASE}/auth/privacy-consent`, { headers: bearer, data: { version: notice.version } })
      const through = await handset.post(`${GATEWAY}/api/attendance/scan`, {
        headers: bearer,
        data: { ...scanBody(sessionId, hosted.qrToken), deviceId: `mobile-officers-${stamp}` },
      })
      expect(through.ok(), `gateway scan: ${through.status()} ${await through.text()}`).toBeTruthy()
      expected = 3
      // saved by the gateway's writer, which checks the signature a second time
      await expect(page.getByText('3 of 3 checked in')).toBeVisible({ timeout: 30_000 })
      await handset.dispose()
    }
    console.log(`scan gateway checked: ${gatewayUp}`)
    await fitsPhone(page, 'president-running')

    // ---------- president: ends it
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'End session' }).click()
    await expect(page.getByText('Session ended.')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'End session' })).toHaveCount(0)
    await expect(page.getByText(`${expected} of 3 checked in`)).toBeVisible()

    // ---------- QAC: the new page, four photos to the ongoing class
    await page.goto('/student/dashboard')
    await page.getByRole('link', { name: 'Class Photos (QAC)' }).click()
    await page.getByRole('button', { name: new RegExp(`E2E Officers ${stamp}`) }).click()
    await expect(page.getByText('Happening now')).toBeVisible()
    const originals = [await bigPhoto(page, 1), await bigPhoto(page, 2), await bigPhoto(page, 3), await bigPhoto(page, 4), await bigPhoto(page, 5)]
    await page.getByLabel('Choose photos').setInputFiles(
      originals.map((buffer, index) => ({ name: `class-${index}.jpg`, mimeType: 'image/jpeg', buffer })),
    )
    await expect(page.getByText(/The extra ones were left out/)).toBeVisible({ timeout: 60_000 })
    await page.getByRole('button', { name: 'Upload 4 photos' }).click()
    await expect(page.getByText('4 photos uploaded.')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('You have added all 4 photos for this session.')).toBeVisible()
    await expect.poll(() => loadedImages(page), { timeout: 30_000 }).toBe(4)
    await fitsPhone(page, 'qac-photos')

    const proofs = await send<Array<{ id: string; uploadedBy: string }>>(page, 'get', `/proofs/${sessionId}`)
    expect(proofs).toHaveLength(4)
    expect(proofs.every((proof) => proof.uploadedBy === student.id)).toBe(true)
    let stored = 0
    for (const proof of proofs) {
      const file = await page.request.get(`${API_BASE}/proofs/${proof.id}/file`)
      expect(file.headers()['content-type']).toContain('image/jpeg')
      stored = Math.max(stored, (await file.body()).length)
    }
    const smallestOriginal = Math.min(...originals.map((buffer) => buffer.length))
    console.log(`photo sizes: originals from ${Math.round(smallestOriginal / 1024)} KB, stored at most ${Math.round(stored / 1024)} KB`)
    expect(stored).toBeLessThanOrEqual(600_000)
    expect(stored).toBeLessThan(smallestOriginal / 2)

    const fifth = await page.request.post(`${API_BASE}/proofs`, {
      headers: ORIGIN,
      data: { sectionId: section.id, sessionId, photoData: `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}` },
    })
    expect(fifth.status(), 'a fifth photo is refused').toBe(400)
    assertNoErrors(errors)

    // ---------- professor: sees the attendance and the real photos, then revokes
    await revokeBrowserSession(page)
    await loginFaculty(page)
    const records = await send<Array<{ studentId: string; status: string }>>(page, 'get', `/attendance?sessionId=${sessionId}`)
    const statusOf = (id: string) => records.find((record) => record.studentId === id)?.status
    expect([statusOf(student.id), statusOf(first.id), statusOf(second.id)]).toEqual([
      'present',
      'present',
      expected === 3 ? 'present' : 'absent',
    ])
    await page.goto(`/faculty/sessions/${sessionId}`)
    await expect(page.getByText('Proof of Class')).toBeVisible()
    await expect.poll(() => loadedImages(page), { timeout: 30_000 }).toBe(4)
    await page.getByRole('button', { name: /View the photo from/ }).first().click()
    await expect(page.getByRole('dialog')).toContainText('Class photo')
    await page.keyboard.press('Escape')
    await send(page, 'delete', `/session-permissions/${section.id}/${student.id}`)

    // the president's attendance and the scans are part of an intact ledger
    await apiLoginFaculty(admin, ADMIN_EMAIL)
    const ledger = await call<{ status: string; brokenLinks?: unknown[] }>(admin, 'post', '/audit-logs/ledger/verify', {})
    expect(ledger.status, JSON.stringify(ledger).slice(0, 600)).toBe('verified')
    await call(admin, 'post', '/auth/logout', { armDeviceCooldown: false })

    // leave the seeded student without roles for other tests
    await send(page, 'delete', `/section-roles/${section.id}/${student.id}/president`)
    await send(page, 'delete', `/section-roles/${section.id}/${student.id}/qac`)
    await phone.dispose()
    await admin.dispose()
  })
})
