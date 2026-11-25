import { CAMPUS_COURSES, campusCourseByCode, type CampusCourse } from '../constants/campus-courses'
import type { UserRole } from '../types/user'

/**
 * Pure course helpers shared by web, mobile and backend.
 *
 * Course = catalog program code (`BSIT`, `BSHM`, …). See plan/course-scope-plan.md.
 */

export interface NormalizedCourse {
  /** Canonical catalog code when the input matched, otherwise undefined. */
  code?: string
  matched: boolean
  /** The trimmed input, preserved so unmatched values are never silently dropped. */
  raw: string
}

/** Lower-case and strip everything that is not a letter or digit ("B.S.I.T." → "bsit"). */
const compact = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '')

let lookup: Map<string, string> | undefined

function buildLookup(): Map<string, string> {
  const map = new Map<string, string>()
  const add = (key: string, code: string) => {
    if (!key) return
    // First writer wins so a code can never be shadowed by another course's alias.
    if (!map.has(key)) map.set(key, code)
  }
  // Codes first, then names, then aliases: precedence is intentional.
  for (const course of CAMPUS_COURSES) add(compact(course.code), course.code)
  for (const course of CAMPUS_COURSES) add(compact(course.name), course.code)
  for (const course of CAMPUS_COURSES) {
    for (const alias of course.aliases) add(compact(alias), course.code)
  }
  return map
}

/**
 * Case-, spacing- and punctuation-insensitive match of free text against the
 * catalog's codes, full names and aliases. Unknown input comes back
 * `matched: false` with the raw text intact (never dropped), and ambiguous
 * legacy values such as a bare `BSEd` (two majors exist) stay unmatched.
 */
export function normalizeCourse(input?: string | null): NormalizedCourse {
  const raw = (input ?? '').trim()
  if (!raw) return { matched: false, raw }
  lookup ??= buildLookup()
  const code = lookup.get(compact(raw))
  return code ? { code, matched: true, raw } : { matched: false, raw }
}

/** True when the value is (or normalizes to) a catalog course. */
export function isCatalogCourse(input?: string | null): boolean {
  return normalizeCourse(input).matched
}

/** Catalog entry for free text, via {@link normalizeCourse}. */
export function resolveCourse(input?: string | null): CampusCourse | undefined {
  const { code } = normalizeCourse(input)
  return code ? campusCourseByCode(code) : undefined
}

export interface CourseScopeCarrier {
  role: UserRole
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
  managedCourses?: readonly string[] | null
  managesAllCourses?: boolean | null
}

export type CourseScope =
  | { kind: 'all' }
  | { kind: 'courses'; courses: string[] }
  | { kind: 'none' }

/** Upper bound enforced when designee scopes are written. */
export const MAX_MANAGED_COURSES = 20

/**
 * Effective course scope of a designee. `managesAllCourses` wins; otherwise the
 * normalized, de-duplicated `managedCourses`; otherwise **none** (fail-closed).
 * Only teacher designees carry a scope — super admins are resolved by the
 * existing admin-scope helpers, and everyone else has none.
 */
export function courseScope(user: CourseScopeCarrier | null | undefined): CourseScope {
  if (!user || user.role !== 'teacher') return { kind: 'none' }
  if (user.isDepartmentHead !== true && user.isUserRegistrar !== true) return { kind: 'none' }
  if (user.managesAllCourses === true) return { kind: 'all' }
  const courses = normalizeCourseList(user.managedCourses)
  return courses.length > 0 ? { kind: 'courses', courses } : { kind: 'none' }
}

/** Normalize a list of free-text/codes into unique catalog codes (unknown entries are dropped). */
export function normalizeCourseList(input?: readonly string[] | null): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of input ?? []) {
    const { code } = normalizeCourse(entry)
    if (code && !seen.has(code)) {
      seen.add(code)
      out.push(code)
    }
  }
  return out
}

/**
 * Courses an academic-oversight head may inspect, or `null` for "all courses".
 * Returns `[]` when the head has no scope (fail-closed). Non-heads get `[]`.
 */
export function oversightCourses(user: CourseScopeCarrier | null | undefined): string[] | null {
  if (!user || user.role !== 'teacher' || user.isDepartmentHead !== true) return []
  const scope = courseScope(user)
  if (scope.kind === 'all') return null
  return scope.kind === 'courses' ? scope.courses : []
}

/** True when the course (any alias) is inside a scope. */
export function courseInScope(scope: CourseScope, course?: string | null): boolean {
  if (scope.kind === 'all') return true
  if (scope.kind === 'none') return false
  const { code } = normalizeCourse(course)
  return code !== undefined && scope.courses.includes(code)
}

/**
 * Display label for an academic-oversight designee: "Head of Academic Programs"
 * for an all-courses head, "Course Head (BSIT, BSHM)" otherwise.
 */
export function courseHeadLabel(user: CourseScopeCarrier | null | undefined): string {
  const scope = courseScope(user)
  if (scope.kind === 'all') return 'Head of Academic Programs'
  if (scope.kind === 'courses') return `Course Head (${scope.courses.join(', ')})`
  return 'Course Head'
}
