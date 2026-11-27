import { test, expect, type Locator } from '@playwright/test'
import { API_BASE, loginFaculty, trackErrors, assertNoErrors, installSessionCleanup } from './helpers'

installSessionCleanup()

test.use({ serviceWorkers: 'block' })

// Labels from shared/src/constants/ai-terms.ts.
const AI_TERMS_TITLE = 'Before you use the AI assistant'
const AI_TERMS_ACCEPT_LABEL = 'I agree and continue'

/** First use shows the AI terms; later runs of the same account do not. */
async function acceptTermsIfAsked(dialog: Locator) {
  const accept = dialog.getByRole('button', { name: AI_TERMS_ACCEPT_LABEL })
  const composer = dialog.getByLabel(/Message the assistant/i)
  await expect(accept.or(composer)).toBeVisible({ timeout: 20_000 })
  if (await accept.isVisible()) {
    await expect(dialog.getByText(AI_TERMS_TITLE)).toBeVisible()
    await expect(composer).toHaveCount(0)
    await accept.click()
  }
  await expect(composer).toBeVisible({ timeout: 20_000 })
}

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
    await acceptTermsIfAsked(dialog)
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
    await acceptTermsIfAsked(dialog)
    const composer = dialog.getByLabel(/Message the assistant/i)
    await composer.fill('List my sections')
    await composer.press('Enter')

    await expect(dialog.getByText(/Software Engineering|No sections|sections you can access/i).first()).toBeVisible({
      timeout: 45_000,
    })
    assertNoErrors(errors)
  })
})

