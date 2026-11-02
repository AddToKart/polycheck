import { test, expect } from '@playwright/test'
import { loginFaculty, trackErrors, assertNoErrors } from './helpers'

const MASTER_CSV = [
  'Student No.,Name,Program,Year Level,College/Department',
  '2024-00901-MN-0,E2E Import One,BSIT,1st Year,CCIS',
  '2024-00902-MN-0,E2E Import Two,BSIT,2nd Year,CCIS',
].join('\n')

test.describe('Bulk import wizards', () => {
  test('super admin validates a student master list without committing', async ({ page }) => {
    await loginFaculty(page, 'mcreyes@pup.edu.ph')
    const errors = trackErrors(page)
    await page.goto('/faculty/users')
    await page.getByRole('button', { name: 'Students', exact: true }).click()
    await page.getByRole('button', { name: 'Import Students' }).click()

    await expect(page.getByRole('dialog')).toContainText('Import students')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'master-list.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(MASTER_CSV),
    })

    await expect(page.getByText(/Confirm the mapping/i)).toBeVisible()
    await expect(page.getByLabel('Student number')).toBeVisible()
    await page.getByRole('button', { name: 'Validate rows' }).click()

    await expect(page.getByText('Rows in file')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Importable')).toBeVisible()
    // Validation only: never execute in this smoke test.
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    assertNoErrors(errors)
  })

  test('teacher opens the section roster import', async ({ page }) => {
    await loginFaculty(page)
    const errors = trackErrors(page)
    await page.goto('/faculty/sections/sec-001')
    await expect(page.getByRole('heading', { level: 1 }).filter({ hasText: 'Software Engineering' })).toBeVisible()
    await page.getByText('Enroll Student', { exact: true }).click()
    await page.getByRole('button', { name: 'Import from master list' }).click()
    await expect(page.getByRole('dialog')).toContainText('Import section enrollment')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    assertNoErrors(errors)
  })
})
