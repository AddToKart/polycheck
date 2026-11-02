import { test, expect } from '@playwright/test'
import {
  API_BASE,
  ADMIN_EMAIL,
  DEPARTMENT_HEAD_EMAIL,
  IT_COORDINATOR_EMAIL,
  apiLoginFaculty,
  apiLoginStudent,
  assertNoErrors,
  createDisposableSession,
  createFutureSession,
  loginFaculty,
  logout,
  trackErrors,
} from './helpers'

/**
 * Final E2E wave for `plan/wow-factor-suite-plan.md` (§2 F1–F9, §5 matrix).
 *
 * Journeys: ledger verify (F9), dispute forensic timeline (F8), geofence radar
 * (F2), class-record PDF (F4), CHED referral flow (F5), RA 10173 privacy
 * center (F6), outage-simulator replay (F7), and the projector kiosk finale
 * (F1). Every journey cleans up after itself: the outage simulator always
 * disarms in a `finally`, the CHED referral is transitioned to `resolved` so
 * re-runs can re-file, and the ledger verify is read-only by contract.
 */

interface AtRiskRow {
  studentId: string
  studentNumber?: string | null
  studentName: string
  sectionId: string
  sectionName: string
  subjectName: string
  status: 'below_threshold' | 'at_risk' | 'on_track' | 'insufficient_data'
}

interface AtRiskReferralRow {
  id: string
  studentId: string
  sectionId: string
  status: 'generated' | 'acknowledged' | 'counseling_scheduled' | 'resolved'
}

test.describe('Wow-factor suite (F1–F9)', () => {
  test('F9: super admin verifies the attendance hash-chain ledger', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page, ADMIN_EMAIL)
    await page.goto('/faculty/audit-logs')
    await expect(page.getByRole('heading', { name: /Audit Log/i })).toBeVisible({ timeout: 20_000 })

    const verify = page.getByTestId('verify-ledger-button')
    await expect(verify).toBeVisible()
    await verify.click()

    const banner = page.getByTestId('ledger-verify-result')
    await expect(banner).toBeVisible({ timeout: 30_000 })
    await expect(banner).toContainText('Ledger intact')
    const bannerText = (await banner.textContent()) ?? ''
    const counts = bannerText.match(/([\d,]+) records across ([\d,]+) sessions verified/)
    expect(counts, `banner should carry both counts: ${bannerText}`).toBeTruthy()
    expect(Number.parseInt(counts![1].replaceAll(',', ''), 10)).toBeGreaterThan(0)
    expect(Number.parseInt(counts![2].replaceAll(',', ''), 10)).toBeGreaterThan(0)
    assertNoErrors(errors)
  })

  test('F8: dispute drawer replays the forensic timeline with a recommendation chip', async ({ page, request }) => {
    // Deterministic disputed record: a rooted-device scan carrying a valid
    // signed token is persisted as disputed attendance for teacher review
    // (`rooted_device` is a persistable security-dispute reason).
    await apiLoginFaculty(request)
    const sessionId = await createFutureSession(request, { daysFromNow: 12 })

    const errors = trackErrors(page)
    await loginFaculty(page)
    await page.goto(`/faculty/sessions/${sessionId}`)
    await expect(page.getByRole('heading', { name: 'Software Engineering' })).toBeVisible({ timeout: 20_000 })

    // Activate in person (this browser provisions its teacher signing key).
    await page.getByRole('button', { name: /Generate QR Code/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByAltText('Scannable session QR code').first()).toBeVisible({ timeout: 20_000 })

    const session = (await (await request.get(`${API_BASE}/sessions/${sessionId}`)).json()) as {
      qrToken?: string
    }
    expect(session.qrToken, 'the activated session exposes its signed token to the teacher').toBeTruthy()

    await apiLoginStudent(request)
    const scan = await request.post(`${API_BASE}/attendance/scan`, {
      data: {
        sessionId,
        qrToken: session.qrToken,
        deviceId: 'e2e-wow-rooted-device',
        lat: 14.8697,
        lon: 120.9991,
        accuracyMeters: 8,
        inputChannel: 'camera',
        mocked: false,
        clientAttemptId: `e2e-wow-dispute-${Date.now()}`,
        deviceSecurity: { rootDetected: true },
      },
    })
    expect(scan.ok(), await scan.text()).toBeTruthy()
    const flagged = (await scan.json()) as { status?: string; error?: string }
    expect(flagged.error).toBeUndefined()
    expect(flagged.status).toBe('disputed')

    await page.goto('/faculty/disputes')
    await expect(page.getByRole('heading', { name: /Disputed Records/i })).toBeVisible({ timeout: 20_000 })

    // Groups render collapsed: subject → section → record card.
    await page.getByRole('button', { name: /Software Engineering \(CCIS 3104\)/i }).click()
    await page.getByRole('button', { name: /Section A/i }).click()
    const card = page.getByRole('button', { name: /Review dispute from Alexandra Marie Reyes/i }).first()
    await expect(card).toBeVisible()
    await card.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Forensic timeline')
    const recommendation = page.getByTestId('timeline-recommendation')
    await expect(recommendation).toBeVisible({ timeout: 20_000 })
    await expect(recommendation).toContainText('RECOMMENDATION:')
    // A rationale follows the em dash (variant may be accept/review/reject).
    await expect(recommendation).toContainText(/—\s*\S/)
    expect(await page.getByTestId('timeline-event').count()).toBeGreaterThan(0)
    assertNoErrors(errors)
  })

  test('F2: cockpit radar modal renders the geofence map with live counters', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page)
    const sessionId = await createDisposableSession(page, { daysFromNow: 13 })
    await page.goto(`/faculty/sessions/${sessionId}`)
    await expect(page.getByRole('heading', { name: 'Software Engineering' })).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Open live geofence radar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Live geofence radar')
    const counters = dialog.getByTestId('radar-counters')
    await expect(counters).toContainText(/Inside: \d+/, { timeout: 20_000 })
    await expect(counters).toContainText(/Denied: \d+/)
    // The geofence circle paints into the MapLibre canvas surface.
    await expect(dialog.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 20_000 })
    await expect(dialog.getByTestId('radar-nogps-list')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 })
    assertNoErrors(errors)
  })

  test('F4: section detail downloads the official PUP class record PDF', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page)
    // The section detail h1 carries the parent subject name.
    await page.goto('/faculty/sections/sec-001')
    await expect(page.getByRole('heading', { name: 'Software Engineering' })).toBeVisible({ timeout: 20_000 })
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Class record \(PUP\)/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^PUP-Class-Record-.*\.pdf$/)
    assertNoErrors(errors)
  })

  test('F5: CHED notice of impending drop files a referral the oversight queue resolves', async ({ page, request }) => {
    // Pick the target row through the API so the UI row click and the filed
    // (student, section) pair stay in lockstep, and skip cleanly when the
    // seeded 30-day window has no eligible student free of an active referral.
    await apiLoginFaculty(request, DEPARTMENT_HEAD_EMAIL)
    const rows = (await (await request.get(`${API_BASE}/attendance/at-risk?limit=50`)).json()) as AtRiskRow[]
    const referrals = (await (await request.get(`${API_BASE}/attendance/at-risk/referrals`)).json()) as AtRiskReferralRow[]
    const activeKeys = new Set(
      referrals.filter((referral) => referral.status !== 'resolved').map((r) => `${r.studentId}:${r.sectionId}`),
    )
    const eligible = rows.filter(
      (row) =>
        (row.status === 'below_threshold' || row.status === 'at_risk') &&
        row.studentNumber &&
        !activeKeys.has(`${row.studentId}:${row.sectionId}`),
    )
    const candidate = eligible.find(
      (row) =>
        eligible.filter(
          (other) => other.studentNumber === row.studentNumber && other.subjectName === row.subjectName,
        ).length === 1,
    )
    if (!candidate) {
      test.skip(true, 'No CHED-eligible at-risk row without an active referral is available')
      return
    }

    const errors = trackErrors(page)
    // The at-risk console is academic-oversight-gated, so the issuing actor is
    // the department head (a faculty account); the super admin resolves below.
    await loginFaculty(page, DEPARTMENT_HEAD_EMAIL)
    await page.goto('/faculty/at-risk')
    await expect(page.getByRole('heading', { name: /At-risk students/i })).toBeVisible({ timeout: 20_000 })

    const row = page
      .locator('tbody tr')
      .filter({ hasText: candidate.studentNumber! })
      .filter({ hasText: candidate.subjectName })
      .first()
    await expect(row).toBeVisible({ timeout: 20_000 })
    await row.getByRole('button', { name: `Issue CHED notice for ${candidate.studentName}` }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Issue CHED notice')
    const downloadPromise = page.waitForEvent('download')
    await dialog.getByRole('button', { name: /Generate notice/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^PUP-CHED-Drop-Notice\.pdf$/)

    // The referral lands in the guidance queue with the generated status pill.
    await page.getByRole('tab', { name: 'Referrals' }).click()
    const card = page
      .getByRole('listitem')
      .filter({ hasText: candidate.studentNumber! })
      .filter({ hasText: candidate.subjectName })
      .first()
    await expect(card).toBeVisible({ timeout: 20_000 })
    await expect(card).toContainText('Generated')

    // Second actor: the super admin transitions the referral to `resolved`
    // (cleanup so re-runs can re-file the same student+section pair).
    await logout(page)
    await loginFaculty(page, ADMIN_EMAIL)
    await page.goto('/faculty/at-risk')
    await page.getByRole('tab', { name: 'Referrals' }).click()
    const adminCard = page
      .getByRole('listitem')
      .filter({ hasText: candidate.studentNumber! })
      .filter({ hasText: candidate.subjectName })
      .first()
    await expect(adminCard).toBeVisible({ timeout: 20_000 })
    await adminCard.getByRole('button', { name: 'Mark resolved' }).click()
    await expect(adminCard.getByText('Resolved', { exact: true })).toBeVisible({ timeout: 20_000 })
    assertNoErrors(errors)
  })

  test('F6: privacy center renders the live attestation and downloads the DPO summary', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page, IT_COORDINATOR_EMAIL)
    await page.goto('/faculty/settings?tab=privacy')
    await expect(page.getByRole('heading', { name: /RA 10173 transparency center/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('tab', { name: /Privacy \(RA 10173\)/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const attestation = page.getByTestId('privacy-attestation')
    await expect(attestation).toBeVisible({ timeout: 20_000 })
    await expect(attestation.getByText('0', { exact: true })).toBeVisible()
    await expect(attestation).toContainText(/rows live beyond retention/i)

    // The plain-language data inventory renders its rows.
    await expect(page.getByRole('columnheader', { name: 'Lawful basis' })).toBeVisible()
    expect(await page.getByRole('row').count()).toBeGreaterThan(1)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'DPO summary (PDF)' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^PUP-DPO-Summary\.pdf$/)
    assertNoErrors(errors)
  })

  test('F7: outage simulator queues manual attendance and reconciles on restore', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page)
    const sessionId = await createDisposableSession(page, { daysFromNow: 14 })
    await page.goto(`/faculty/sessions/${sessionId}`)
    await expect(page.getByRole('heading', { name: 'Software Engineering' })).toBeVisible({ timeout: 20_000 })

    const pill = page.getByTestId('outage-pill')
    await expect(pill).toBeVisible()
    await expect(pill).toContainText('LIVE')

    // Arm the killswitch (accept the demo confirmation dialog).
    let armed = false
    page.once('dialog', (dialog) => dialog.accept())
    await pill.click()
    const panel = page.getByTestId('outage-panel')
    await expect(panel).toBeVisible()
    armed = true
    await expect(page.getByTestId('outage-banner')).toContainText(/Offline mode/i)
    await expect(page.getByTestId('outage-receipt')).toContainText(/Receipt #\d+/)

    try {
      // The faculty cockpit has no student-scan surface, so the manual
      // attendance flow is the cockpit roster tap: the write fails with the
      // simulated outage and lands in the encrypted local queue.
      const firstStudentRow = page.locator('button.w-full.border-b').first()
      await firstStudentRow.click()
      await expect(page.getByTestId('outage-receipt')).toContainText(/Receipt #\d+ · [0-9a-f]{8}/, {
        timeout: 20_000,
      })
      await expect(panel).toContainText(/1 evidence item queued/)

      // Restore & Replay: disarm → drain → server commit → realtime reconcile.
      await panel.getByRole('button', { name: /Restore & Replay/i }).click()
      const toastRegion = page.getByRole('region', { name: 'Notifications' })
      await expect(toastRegion).toContainText(/reconcil/i, { timeout: 30_000 })
      // The reconciled record appears in the roster through attendance:updated.
      await expect(firstStudentRow.getByText('Present')).toBeVisible({ timeout: 30_000 })
    } finally {
      // Always disarm: Restore (which disarms first) if the panel is still up,
      // then assert the pill is back in its LIVE state.
      const panelStillUp = page.getByTestId('outage-panel')
      if (armed && (await panelStillUp.isVisible().catch(() => false))) {
        await panelStillUp.getByRole('button', { name: /Restore & Replay/i }).click()
      }
      if (armed) {
        const pillAtEnd = page.getByTestId('outage-pill')
        await expect(pillAtEnd).toBeVisible({ timeout: 20_000 })
        await expect(pillAtEnd).toContainText('LIVE')
      }
    }
    assertNoErrors(errors)
  })

  test('F1: kiosk stage renders live and celebrates the finale when the class ends', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page)
    const sessionId = await createDisposableSession(page, { daysFromNow: 15 })

    // end() only closes an active session, so activate from the cockpit first.
    await page.goto(`/faculty/sessions/${sessionId}`)
    await expect(page.getByRole('heading', { name: 'Software Engineering' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /Generate QR Code/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByAltText('Scannable session QR code').first()).toBeVisible({ timeout: 20_000 })

    // The projector stage runs in a second tab of the same signed-in context.
    const kioskPage = await page.context().newPage()
    const kioskErrors = trackErrors(kioskPage)
    await kioskPage.goto(`/faculty/sessions/${sessionId}/kiosk`)
    const stage = kioskPage.locator('main[data-polycheck-kiosk-active="true"]')
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(stage.getByTestId('kiosk-qr-ring')).toBeVisible()
    await expect(stage.getByAltText('Scannable session QR code')).toBeVisible({ timeout: 20_000 })
    await expect(stage.getByTestId('kiosk-capacity-ring')).toBeVisible()
    await expect(stage.getByTestId('kiosk-capacity-text')).toContainText(/\d+\s*\/\s*\d+/)
    await expect(stage.locator('[aria-live="polite"]')).toBeVisible()
    await expect(stage.getByTestId('kiosk-viewer-count')).toContainText(/Projectors viewing: \d+/)

    // End the class from the cockpit; the finale broadcasts over realtime.
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: /End Session/i }).click()

    await expect(stage.getByTestId('kiosk-finale-count').first()).toBeVisible({ timeout: 30_000 })
    await expect(stage.getByText('Final', { exact: true })).toBeVisible()
    expect(await stage.getByTestId('kiosk-finale-count').count()).toBeGreaterThanOrEqual(7)

    assertNoErrors(errors)
    assertNoErrors(kioskErrors)
    await kioskPage.close()
  })
})
