import { test, expect } from '@playwright/test'
import { API_BASE, loginFaculty, trackErrors, assertNoErrors } from './helpers'

test.use({ serviceWorkers: 'block' })

interface ApiSection {
  id: string
  subjectId: string
}

test.describe('Dashboard filters', () => {
  test('attendance deep link applies subject and section filters', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page)

    const sectionsResponse = await page.request.get(`${API_BASE}/sections`)
    expect(sectionsResponse.ok(), await sectionsResponse.text()).toBeTruthy()
    const sections = (await sectionsResponse.json()) as ApiSection[]
    const section = sections.find((candidate) => candidate.id === 'sec-001')
    if (!section) {
      test.skip(true, 'Seeded section sec-001 is unavailable')
      return
    }

    await page.goto(`/faculty/attendance?subjectId=${section.subjectId}&sectionId=sec-001`)
    await expect(page.getByLabel('Attendance filters')).toBeVisible()
    await expect(page.locator('#attendance-subject')).toHaveValue(section.subjectId)
    await expect(page.locator('#attendance-section')).toHaveValue('sec-001')
    await expect(page).toHaveURL(new RegExp(`subjectId=${section.subjectId}.*sectionId=sec-001`))
    assertNoErrors(errors)
  })

  test('sessions page shows and clears the active section context', async ({ page }) => {
    const errors = trackErrors(page)
    await loginFaculty(page)

    await page.goto('/faculty/sessions?sectionId=sec-001')
    const context = page.getByLabel('Active section context')
    await expect(context).toBeVisible({ timeout: 20_000 })
    await expect(context).toContainText('Section context')

    await context.getByRole('link', { name: /Clear section/i }).click()
    await expect(page).not.toHaveURL(/sectionId=/)
    await expect(page.getByLabel('Active section context')).toHaveCount(0)
    assertNoErrors(errors)
  })
})

