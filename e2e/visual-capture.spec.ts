import { test } from '@playwright/test'
import { loginFaculty, loginStudent, shot } from './helpers'

/**
 * Visual capture spec — screenshots every key page at desktop + mobile
 * viewports for the vision agent to review. These are not assertions;
 * they exist purely to produce evidence of UI state.
 */
test.describe('Visual Capture', () => {
  test('capture landing + login pages', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1200)
    await shot(page, '01-landing')

    await page.goto('/login/faculty')
    await page.waitForTimeout(800)
    await shot(page, '02-login-faculty')

    await page.goto('/login/student')
    await page.waitForTimeout(800)
    await shot(page, '03-login-student')
  })

  test('capture faculty dashboard + navigation', async ({ page }) => {
    await loginFaculty(page)
    await page.waitForTimeout(1500)
    await shot(page, '04-faculty-dashboard')

    await page.goto('/faculty/subjects')
    await page.waitForTimeout(1000)
    await shot(page, '05-faculty-subjects')

    await page.goto('/faculty/subjects/subj-001')
    await page.waitForTimeout(1000)
    await shot(page, '06-faculty-subject-detail')

    await page.goto('/faculty/sections/sec-001')
    await page.waitForTimeout(1000)
    await shot(page, '07-faculty-section-detail')

    await page.goto('/faculty/sessions')
    await page.waitForTimeout(1000)
    await shot(page, '08-faculty-sessions')

    await page.goto('/faculty/sessions/sess-001')
    await page.waitForTimeout(1500)
    await shot(page, '09-faculty-session-detail')

    await page.goto('/faculty/attendance')
    await page.waitForTimeout(1000)
    await shot(page, '10-faculty-attendance')

    await page.goto('/faculty/schedule')
    await page.waitForTimeout(1000)
    await shot(page, '11-faculty-schedule')

    await page.goto('/faculty/disputes')
    await page.waitForTimeout(1000)
    await shot(page, '12-faculty-disputes')

    await page.goto('/faculty/search')
    await page.waitForTimeout(1000)
    await shot(page, '14-faculty-search')
  })

  test('capture super admin pages', async ({ page }) => {
    await loginFaculty(page, 'mcreyes@pup.edu.ph')
    await page.waitForTimeout(1500)
    await shot(page, '15-admin-dashboard')

    await page.goto('/faculty/reports')
    await page.waitForTimeout(1500)
    await shot(page, '13-faculty-reports')

    await page.goto('/faculty/users')
    await page.waitForTimeout(1000)
    await shot(page, '16-admin-users')

    await page.goto('/faculty/settings')
    await page.waitForTimeout(1000)
    await shot(page, '17-admin-settings')
  })

  test('capture student pages', async ({ page }) => {
    await loginStudent(page)
    await page.waitForTimeout(1500)
    await shot(page, '18-student-dashboard')

    await page.goto('/student/dashboard?tab=subjects')
    await page.waitForTimeout(1000)
    await shot(page, '19-student-subjects')

    await page.goto('/student/dashboard?tab=attendance')
    await page.waitForTimeout(1000)
    await shot(page, '20-student-attendance')

    await page.goto('/student/schedule')
    await page.waitForTimeout(1000)
    await shot(page, '21-student-schedule')

    await page.goto('/student/subjects/sec-001')
    await page.waitForTimeout(1000)
    await shot(page, '22-student-subject-detail')

    // Enroll is a modal on the dashboard (there is no /student/enroll route)
    await page.goto('/student/dashboard')
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: /Enroll in Subject/i }).click()
    await page.waitForTimeout(800)
    await shot(page, '23-student-enroll')
  })

  test('capture mobile viewport (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForTimeout(1000)
    await shot(page, '24-mobile-landing')

    await page.goto('/login/faculty')
    await page.waitForTimeout(800)
    await shot(page, '25-mobile-login')

    await loginFaculty(page)
    await page.waitForTimeout(1200)
    await shot(page, '26-mobile-faculty-dashboard')
  })
})
