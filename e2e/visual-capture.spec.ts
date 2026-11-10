import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { test, type Page } from '@playwright/test'
import {
  ADMIN_EMAIL,
  DEPARTMENT_HEAD_EMAIL,
  IT_COORDINATOR_EMAIL,
  REGISTRAR_EMAIL,
  loginFaculty,
  loginStudent,
  shot,
  installSessionCleanup,
} from './helpers'
import {
  ANONYMOUS_ROUTES,
  DEPARTMENT_HEAD_ROUTES,
  FACULTY_ROUTES,
  IT_COORDINATOR_ROUTES,
  REGISTRAR_ROUTES,
  SUPER_ADMIN_ROUTES,
  STUDENT_ROUTES,
  type RouteCase,
} from './responsive-routes'

installSessionCleanup()

/**
 * Visual capture spec — screenshots every key page at desktop + mobile
 * viewports for the vision agent to review. These are not assertions;
 * they exist purely to produce evidence of UI state.
 */

const MOBILE_CAPTURE_DIR = path.join('e2e', 'captures', 'mobile')
const MOBILE_VIEWPORT = { width: 375, height: 812 }

interface MobileCaptureGroup {
  role: string
  routes: RouteCase[]
  /** Authenticate the page as this role. Omitted for anonymous routes. */
  login?: (page: Page) => Promise<void>
}

/**
 * Every route enumerated for the responsive gate is captured once here at
 * phone width. One login per role group keeps the evidence run bounded; the
 * seeded designation accounts cover the role-scoped surfaces.
 */
const MOBILE_CAPTURE_GROUPS: MobileCaptureGroup[] = [
  { role: 'anonymous', routes: ANONYMOUS_ROUTES },
  { role: 'faculty', routes: FACULTY_ROUTES, login: (page) => loginFaculty(page) },
  {
    role: 'super-admin',
    routes: SUPER_ADMIN_ROUTES,
    login: (page) => loginFaculty(page, ADMIN_EMAIL),
  },
  { role: 'student', routes: STUDENT_ROUTES, login: (page) => loginStudent(page) },
  {
    role: 'department-head',
    routes: DEPARTMENT_HEAD_ROUTES,
    login: (page) => loginFaculty(page, DEPARTMENT_HEAD_EMAIL),
  },
  {
    role: 'it-coordinator',
    routes: IT_COORDINATOR_ROUTES,
    login: (page) => loginFaculty(page, IT_COORDINATOR_EMAIL),
  },
  {
    role: 'registrar',
    routes: REGISTRAR_ROUTES,
    login: (page) => loginFaculty(page, REGISTRAR_EMAIL),
  },
]

test.describe('Visual Capture', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual evidence is captured once in Chromium')
  })

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
    await loginFaculty(page, ADMIN_EMAIL)
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

  test.describe('mobile (375x812)', () => {
    test.use({ viewport: MOBILE_VIEWPORT })

    test.beforeAll(async () => {
      await mkdir(MOBILE_CAPTURE_DIR, { recursive: true })
    })

    for (const group of MOBILE_CAPTURE_GROUPS) {
      test(`capture ${group.role} routes`, async ({ page }) => {
        // The larger role groups navigate + full-page screenshot every route,
        // which can exceed the default 60s per-test budget.
        test.setTimeout(180_000)

        if (group.login) await group.login(page)

        for (const route of group.routes) {
          await test.step(`${route.name} (${route.path})`, async () => {
            await page.goto(route.path, { waitUntil: 'domcontentloaded' })
            await page.waitForLoadState('load').catch(() => {})
            await page.waitForTimeout(route.settleMs ?? 1200)
            await page.screenshot({
              path: path.join(MOBILE_CAPTURE_DIR, `${group.role}-${route.name}.png`),
              fullPage: true,
            })
          })
        }
      })
    }
  })
})
