import { test, expect } from '@playwright/test'
import { API_BASE, loginFaculty, trackErrors, assertNoErrors } from './helpers'

test.use({ serviceWorkers: 'block' })

test.describe('Assistant panel', () => {
  test('launcher opens dock, expands to theater, and the Esc ladder closes it', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page)

    const capabilitiesResponse = await page.request.get(`${API_BASE}/ai/capabilities`)
    const capabilities = (await capabilitiesResponse.json()) as { enabled?: boolean; policyBlocked?: boolean }
    if (!capabilities.enabled) {
      test.skip(true, 'Assistant is not configured or is policy-blocked')
      return
    }

    const launcher = page.getByRole('button', { name: 'Open faculty assistant' })
    await expect(launcher).toBeVisible({ timeout: 20_000 })
    await launcher.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Assistant' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'List my sections' })).toBeVisible()

    await dialog.getByRole('button', { name: 'Expand assistant to theater' }).click()
    await expect(dialog.getByRole('button', { name: 'Collapse assistant to dock' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog.getByRole('button', { name: 'Expand assistant to theater' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(launcher).toBeVisible()
    assertNoErrors(errors)
  })

  test('assistant answers a section lookup when E2E_AI is enabled', async ({ page }) => {
    test.skip(process.env.E2E_AI !== '1', 'Set E2E_AI=1 to run provider-bound assistant journeys')
    const errors = trackErrors(page)
    await loginFaculty(page)

    const launcher = page.getByRole('button', { name: 'Open faculty assistant' })
    await expect(launcher).toBeVisible({ timeout: 20_000 })
    await launcher.click()

    const dialog = page.getByRole('dialog')
    const composer = dialog.getByLabel(/Message the assistant/i)
    await composer.fill('List my sections')
    await composer.press('Enter')

    await expect(dialog.getByText(/Software Engineering|No sections|sections you can access/i).first()).toBeVisible({
      timeout: 45_000,
    })
    assertNoErrors(errors)
  })
})

