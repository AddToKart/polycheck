import { test, expect, type Page } from '@playwright/test'
import {
  loginFaculty,
  loginStudent,
  ADMIN_EMAIL,
  DEPARTMENT_HEAD_EMAIL,
  IT_COORDINATOR_EMAIL,
  REGISTRAR_EMAIL,
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

/**
 * Responsive gate — every route must fit every phone/tablet width.
 *
 * The app is a PWA first for students, so a page-level horizontal overflow is
 * treated as a failure, not a cosmetic nit. Elements inside an explicit
 * horizontal scroll region are allowed (deliberate contained scroll); the
 * document itself must never grow wider than the viewport.
 */

const VIEWPORTS = [
  { label: 'phone-375x812', width: 375, height: 812 },
  { label: 'phone-390x844', width: 390, height: 844 },
  { label: 'android-412x915', width: 412, height: 915 },
  { label: 'tablet-768x1024', width: 768, height: 1024 },
]

interface Violation {
  route: string
  viewport: string
  docWidth: number
  viewportWidth: number
  offenders: string[]
}

interface Measurement {
  docWidth: number
  viewportWidth: number
  offenders: string[]
}

async function measureOverflow(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const docWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0,
    )

    const offenders: string[] = []
    if (docWidth <= viewportWidth + 1) return { docWidth, viewportWidth, offenders }

    const insideScrollableAncestor = (el: HTMLElement): boolean => {
      let parent = el.parentElement
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent)
        if (/(auto|scroll|hidden)/.test(style.overflowX)) {
          const rect = parent.getBoundingClientRect()
          if (rect.right <= viewportWidth + 1 && rect.left >= -1) return true
        }
        parent = parent.parentElement
      }
      return false
    }

    const elements = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
    for (const el of elements) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) continue
      if (rect.right <= viewportWidth + 1 && rect.left >= -1) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (insideScrollableAncestor(el)) continue
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const classes =
        typeof el.className === 'string'
          ? el.className
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 5)
              .map((token) => `.${token}`)
              .join('')
          : ''
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 48)
      offenders.push(
        `${tag}${id}${classes} [right=${Math.round(rect.right)}px, w=${Math.round(rect.width)}px]${text ? ` "${text}"` : ''}`,
      )
      if (offenders.length >= 8) break
    }

    return { docWidth, viewportWidth, offenders }
  })
}

function describeViolations(violations: Violation[]): string {
  if (violations.length === 0) return 'No horizontal overflow.'
  return violations
    .map(
      (violation) =>
        `${violation.viewport} | ${violation.route}\n` +
        `    document=${violation.docWidth}px viewport=${violation.viewportWidth}px\n` +
        violation.offenders.map((offender) => `    - ${offender}`).join('\n'),
    )
    .join('\n\n')
}

async function auditRoutes(
  page: Page,
  routes: RouteCase[],
  viewport: string,
): Promise<Violation[]> {
  const violations: Violation[] = []

  for (const route of routes) {
    await test.step(`${route.name} (${route.path})`, async () => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('load').catch(() => {})
      await page.waitForTimeout(route.settleMs ?? 900)
      const measurement = await measureOverflow(page)
      if (measurement.docWidth > measurement.viewportWidth + 1) {
        violations.push({ route: `${route.name} (${route.path})`, viewport, ...measurement })
      }
    })
  }

  return violations
}

test.describe.configure({ mode: 'serial' })

for (const viewport of VIEWPORTS) {
  test.describe(`responsive ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test.beforeEach(({ browserName }) => {
      test.skip(browserName !== 'chromium', 'Responsive gate runs once in Chromium')
    })

    test('anonymous routes fit', async ({ page }) => {
      const violations = await auditRoutes(page, ANONYMOUS_ROUTES, viewport.label)
      expect(violations, `Horizontal overflow detected:\n\n${describeViolations(violations)}`).toEqual([])
    })

    test('faculty routes fit', async ({ page }) => {
      await loginFaculty(page)
      const violations = await auditRoutes(page, FACULTY_ROUTES, viewport.label)
      expect(violations, `Horizontal overflow detected:\n\n${describeViolations(violations)}`).toEqual([])
    })

    test('super admin routes fit', async ({ page }) => {
      await loginFaculty(page, ADMIN_EMAIL)
      const violations = await auditRoutes(page, SUPER_ADMIN_ROUTES, viewport.label)
      expect(violations, `Horizontal overflow detected:\n\n${describeViolations(violations)}`).toEqual([])
    })

    test('student routes fit', async ({ page }) => {
      await loginStudent(page)
      const violations = await auditRoutes(page, STUDENT_ROUTES, viewport.label)
      expect(violations, `Horizontal overflow detected:\n\n${describeViolations(violations)}`).toEqual([])
    })

    test('department head routes fit', async ({ page }) => {
      await loginFaculty(page, DEPARTMENT_HEAD_EMAIL)
      const violations = await auditRoutes(page, DEPARTMENT_HEAD_ROUTES, viewport.label)
      expect(violations, `Horizontal overflow detected:\n\n${describeViolations(violations)}`).toEqual([])
    })

    test('IT coordinator routes fit', async ({ page }) => {
      await loginFaculty(page, IT_COORDINATOR_EMAIL)
      const violations = await auditRoutes(page, IT_COORDINATOR_ROUTES, viewport.label)
      expect(violations, `Horizontal overflow detected:\n\n${describeViolations(violations)}`).toEqual([])
    })

    test('registrar routes fit', async ({ page }) => {
      await loginFaculty(page, REGISTRAR_EMAIL)
      const violations = await auditRoutes(page, REGISTRAR_ROUTES, viewport.label)
      expect(violations, `Horizontal overflow detected:\n\n${describeViolations(violations)}`).toEqual([])
    })
  })
}
