import { Logger } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Prisma } from '../prisma/client'

/**
 * Course scoping for academic-oversight heads and registrars
 * (plan/course-scope-plan.md).
 *
 * This campus has no departments; heads and registrars are scoped by
 * course (the catalog program code) instead. This module is the single place
 * that decides *which* scoping rule is live, selected by `COURSE_SCOPE_MODE`:
 *
 * - `legacy` (default): the exact pre-course behavior — heads inspect sections
 *   whose **teacher's department** matches theirs. Every `where` fragment is
 *   byte-identical to what the call sites used to build inline.
 * - `course`: heads inspect sections whose `course` is in their managed list
 *   (or every course for a Head of Academic Programs).
 *
 * Deliberately separate from `admin-scope.ts` (super-admin scope semantics are
 * load-bearing for twelve modules) and free of imports from `@polycheck/shared`
 * so attendance specs that mock the shared package keep their whitelist.
 */

export type CourseScopeMode = 'legacy' | 'course'

export type CourseScope = { kind: 'all' } | { kind: 'courses'; courses: string[] } | { kind: 'none' }

const logger = new Logger('CourseScope')
let warnedUnknownMode: string | null = null

/** Resolve the live mode. Unknown values degrade to `legacy` with a one-time warning. */
export function courseScopeMode(env: NodeJS.ProcessEnv = process.env): CourseScopeMode {
  const raw = env.COURSE_SCOPE_MODE?.trim().toLowerCase()
  if (!raw || raw === 'legacy') return 'legacy'
  if (raw === 'course') return 'course'
  if (warnedUnknownMode !== raw) {
    warnedUnknownMode = raw
    logger.warn(`Unknown COURSE_SCOPE_MODE "${env.COURSE_SCOPE_MODE}"; falling back to "legacy"`)
  }
  return 'legacy'
}

export function isCourseScopeMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return courseScopeMode(env) === 'course'
}

type ScopeCarrier = Pick<
  RequestUser,
  'role' | 'department' | 'isDepartmentHead' | 'isUserRegistrar' | 'managedCourses' | 'managesAllCourses'
>

function cleanCourses(input: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of input ?? []) {
    const value = typeof entry === 'string' ? entry.trim() : ''
    const key = value.toLowerCase()
    if (value && !seen.has(key)) {
      seen.add(key)
      out.push(value)
    }
  }
  return out
}

/**
 * Effective course scope of a designee: `managesAllCourses` wins, otherwise the
 * managed list, otherwise **none** (fail-closed). Only teacher designees carry
 * a scope; super admins resolve through the existing admin-scope helpers.
 */
export function designeeCourseScope(user: ScopeCarrier | null | undefined): CourseScope {
  if (!user || user.role !== 'teacher') return { kind: 'none' }
  if (user.isDepartmentHead !== true && user.isUserRegistrar !== true) return { kind: 'none' }
  if (user.managesAllCourses === true) return { kind: 'all' }
  const courses = cleanCourses(user.managedCourses)
  return courses.length > 0 ? { kind: 'courses', courses } : { kind: 'none' }
}

/** Case-insensitive membership of a stored course/program value in a scope. */
export function courseInScope(scope: CourseScope, course: string | null | undefined): boolean {
  if (scope.kind === 'all') return true
  if (scope.kind === 'none') return false
  const value = course?.trim().toLowerCase()
  if (!value) return false
  return scope.courses.some((entry) => entry.toLowerCase() === value)
}

/** `section.course` filter for a scope; `none` matches no section. */
export function sectionCourseWhere(scope: CourseScope): Prisma.SectionWhereInput {
  if (scope.kind === 'all') return {}
  if (scope.kind === 'none') return { id: { in: [] as string[] } }
  return { OR: scope.courses.map((course) => ({ course: { equals: course, mode: 'insensitive' as const } })) }
}

function legacyOversightDepartment(user: ScopeCarrier): string | null {
  if (user.role !== 'teacher' || user.isDepartmentHead !== true) return null
  const department = user.department?.trim()
  return department ? department : null
}

/**
 * Section filter an academic-oversight head is pinned to, or `null` when the
 * actor is not an oversight actor (plain teachers, students, super admins,
 * heads with no scope in the live mode). Callers treat `null` exactly as they
 * used to treat a null `academicOversightDepartment`: fall back to the
 * teacher's own sessions.
 */
export function oversightSectionWhere(
  user: ScopeCarrier | null | undefined,
  mode: CourseScopeMode = courseScopeMode(),
): Prisma.SectionWhereInput | null {
  if (!user || user.role !== 'teacher' || user.isDepartmentHead !== true) return null
  if (mode === 'legacy') {
    const department = legacyOversightDepartment(user)
    return department ? { teacher: { department: { equals: department, mode: 'insensitive' as const } } } : null
  }
  const scope = designeeCourseScope(user)
  return scope.kind === 'none' ? null : sectionCourseWhere(scope)
}

/** True when the actor is an oversight head with a live scope. */
export function hasOversightScope(user: ScopeCarrier | null | undefined, mode?: CourseScopeMode): boolean {
  return oversightSectionWhere(user, mode) !== null
}

/** `Session` filter for the oversight scope (`{ section: … }`), or null. */
export function oversightSessionWhere(
  user: ScopeCarrier | null | undefined,
  mode?: CourseScopeMode,
): Prisma.SessionWhereInput | null {
  const section = oversightSectionWhere(user, mode)
  return section ? { section } : null
}

/** `AttendanceRecord` filter for the oversight scope (`{ session: { section } }`), or null. */
export function oversightRecordWhere(
  user: ScopeCarrier | null | undefined,
  mode?: CourseScopeMode,
): Prisma.AttendanceRecordWhereInput | null {
  const section = oversightSectionWhere(user, mode)
  return section ? { session: { section } } : null
}

/** The slice of a section that scope predicates need (course + the owning teacher's department). */
export interface ScopedSectionShape {
  course?: string | null
  teacher?: { department?: string | null } | null
}

/**
 * In-memory twin of {@link oversightSectionWhere} for records that were already
 * loaded: is this section inside the head's oversight scope? Never true for
 * non-oversight actors.
 */
export function sectionInOversightScope(
  user: ScopeCarrier | null | undefined,
  section: ScopedSectionShape | null | undefined,
  mode: CourseScopeMode = courseScopeMode(),
): boolean {
  if (!user || !section || user.role !== 'teacher' || user.isDepartmentHead !== true) return false
  if (mode === 'legacy') {
    const oversight = legacyOversightDepartment(user)
    const target = section.teacher?.department?.trim()
    return Boolean(oversight && target && target.toLowerCase() === oversight.toLowerCase())
  }
  return courseInScope(designeeCourseScope(user), section.course)
}

/**
 * Candidate heads to notify for a section: in legacy mode the exact previous
 * query (active heads of the section teacher's department); in course mode
 * every active head, to be narrowed in memory with {@link headCoversSection}
 * (a handful of rows, and `managedCourses` matching must be case-insensitive).
 */
export function headCandidatesWhere(
  section: { teacherDepartment?: string | null },
  mode: CourseScopeMode = courseScopeMode(),
): Prisma.UserWhereInput | null {
  if (mode === 'legacy') {
    const department = section.teacherDepartment?.trim()
    if (!department) return null
    return {
      role: 'teacher',
      isActive: true,
      isDepartmentHead: true,
      department: { equals: department, mode: 'insensitive' },
    }
  }
  return { role: 'teacher', isActive: true, isDepartmentHead: true }
}

/**
 * True when a head returned by {@link headCandidatesWhere} covers the section.
 * Legacy mode trusts the department query (it already filtered in SQL), so the
 * result is unchanged from before; course mode narrows in memory because
 * `managedCourses` matching must be case-insensitive.
 */
export function headCoversSection(
  head: ScopeCarrier,
  section: ScopedSectionShape,
  mode: CourseScopeMode = courseScopeMode(),
): boolean {
  if (mode === 'legacy') return true
  return sectionInOversightScope(head, section, mode)
}

/** Courses a head may filter by in the UI/queries; `null` = every course, `[]` = none. */
export function oversightCourseList(user: ScopeCarrier | null | undefined): string[] | null {
  if (!user || user.role !== 'teacher' || user.isDepartmentHead !== true) return []
  const scope = designeeCourseScope(user)
  if (scope.kind === 'all') return null
  return scope.kind === 'courses' ? scope.courses : []
}

/** Test seam: forget the one-time unknown-mode warning. */
export function resetCourseScopeWarningForTests(): void {
  warnedUnknownMode = null
}
