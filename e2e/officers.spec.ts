import { test, expect, type Page } from '@playwright/test'
import {
  API_BASE,
  loginFaculty,
  loginStudent,
  revokeBrowserSession,
  installSessionCleanup,
  trackErrors,
  assertNoErrors,
} from './helpers'

installSessionCleanup()

/**
 * Section officers end to end: the professor assigns a President (with a timed, one-session permission) and a
 * QAC; the President creates one session; the QAC adds class photos to it; the professor sees them.
 * Uses a new subject and section each run, with the seeded student as both officers.
 */
const STUDENT_NUMBER = '2024-00001-MN-0'
const ORIGIN = { origin: 'http://localhost:3000' }

/** Campus (UTC+8) date and clock time, `minutes` from now. */
function campus(minutes: number) {
  const iso = new Date(Date.now() + 8 * 3_600_000 + minutes * 60_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

async function send<T>(page: Page, method: 'get' | 'post' | 'delete', path: string, data?: unknown): Promise<T> {
  const response = await page.request[method](`${API_BASE}${path}`, { headers: ORIGIN, data })
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy()
  return (await response.json()) as T
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
  test('president creates one session, the QAC adds photos, the professor sees them', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'One browser is enough for this long journey')
    test.setTimeout(240_000)
    const stamp = Date.now().toString().slice(-7)

    // ---------- professor: a fresh section with the student in it
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
    await send(page, 'post', `/sections/${section.id}/enroll-student`, {
      studentId: student.id,
      studentName: student.fullName,
    })

    // assign both roles on the real screen, with an 8 hour permission
    await page.goto(`/faculty/sections/${section.id}`)
    await page.getByRole('button', { name: 'Assign President' }).click()
    await page.getByRole('button', { name: new RegExp(`${STUDENT_NUMBER}`) }).click()
    await page.getByLabel('How long the permission lasts').selectOption('8')
    await page.getByRole('button', { name: 'Give permission' }).click()
    await expect(page.getByText(/Can create 1 session until/)).toBeVisible()
    await page.getByRole('button', { name: 'Assign QAC' }).click()
    await page.getByRole('button', { name: new RegExp(`${STUDENT_NUMBER}`) }).click()
    await expect(page.getByText('No QAC assigned')).toHaveCount(0)
    await fitsPhone(page, 'teacher-officers')

    const permissions = await send<Array<{ expiresAt: string; grantedAt: string }>>(
      page,
      'get',
      `/session-permissions/${section.id}`,
    )
    expect(new Date(permissions[0].expiresAt).getTime() - new Date(permissions[0].grantedAt).getTime()).toBe(8 * 3_600_000)

    // ---------- president: one session, on the real form
    await revokeBrowserSession(page)
    await loginStudent(page)
    const errors = trackErrors(page)
    await page.goto(`/student/subjects/${section.id}`)
    await expect(page.getByText('You can create one session for this section')).toBeVisible()
    await page.getByRole('button', { name: 'Create Session' }).click()
    const start = campus(-10).time
    const end = campus(80).time
    await page.getByLabel('Date').fill(today)
    await page.getByLabel('Start Time').fill(start)
    await page.getByLabel('End Time').fill(end)
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Create Session' }).click()
    await page.waitForURL(new RegExp(`/student/subjects/${section.id}$`), { timeout: 30_000 })
    await expect(page.getByText('No active session permission. Ask your teacher to grant it.')).toBeVisible()

    const again = await page.request.post(`${API_BASE}/sessions`, {
      headers: ORIGIN,
      data: {
        sectionId: section.id,
        subjectName: 'ignored',
        date: today,
        startTime: campus(120).time,
        endTime: campus(180).time,
        geofence: { latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 },
      },
    })
    expect(again.status(), `a used permission must not create a second session: ${await again.text()}`).toBe(403)

    // ---------- QAC: the new page, four photos to the ongoing class (its QR was never started)
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

    const sessions = await send<Array<{ id: string; sectionId: string }>>(page, 'get', `/sessions?sectionId=${section.id}`)
    const sessionId = sessions.find((session) => session.sectionId === section.id)!.id
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

    // ---------- professor: the real photos, not placeholders
    await revokeBrowserSession(page)
    await loginFaculty(page)
    await page.goto(`/faculty/sessions/${sessionId}`)
    await expect(page.getByText('Proof of Class')).toBeVisible()
    await expect.poll(() => loadedImages(page), { timeout: 30_000 }).toBe(4)
    await page.getByRole('button', { name: /View the photo from/ }).first().click()
    await expect(page.getByRole('dialog')).toContainText('Class photo')
    await page.keyboard.press('Escape')

    // leave the seeded student without roles for other tests
    await send(page, 'delete', `/section-roles/${section.id}/${student.id}/president`)
    await send(page, 'delete', `/section-roles/${section.id}/${student.id}/qac`)
  })
})
