import type { RequestUser } from '../../auth/authenticated-principal'
import type { Prisma } from '../../prisma/client'
import { adminScope } from '../admin-scope'
import { courseInScope, courseScopeMode, designeeCourseScope, type CourseScope } from '../course-scope'

/**
 * Separation-of-duties helpers for the registrar designation.
 *
 * Deliberately separate from `admin-scope.ts`: super-admin scope semantics are
 * load-bearing for twelve modules and must not shift. Registrars are teacher
 * accounts pinned to their own `department`, and only account-administration
 * surfaces consult these helpers.
 *
 * Registrar scope follows `COURSE_SCOPE_MODE`: `legacy` pins registrars to their
 * own `User.department` (the original behavior, unchanged); `course` makes a
 * registrar campus-wide (`managesAllCourses`) or pinned to the students whose
 * `program` is in `managedCourses` (teacher accounts then stay out of reach).
 */

export function isRegistrar(user: RequestUser | null | undefined): boolean {
  return Boolean(user && user.role === 'teacher' && user.isUserRegistrar === true)
}

/**
 * The department an academic-oversight head may inspect, or null.
 * Mirrors the shared `oversightDepartment` helper; kept backend-local so
 * attendance unit specs that mock `@polycheck/shared` keep their whitelist.
 */
export function academicOversightDepartment(user: RequestUser | null | undefined): string | null {
  if (!user || user.role !== 'teacher' || user.isDepartmentHead !== true) return null
  const department = user.department?.trim()
  return department ? department : null
}

/** The department a registrar is pinned to, or null when the account has none. */
export function registrarDepartment(user: RequestUser): string | null {
  if (!isRegistrar(user)) return null
  const department = user.department?.trim()
  return department ? department : null
}

/** Case-insensitive department equality for registrar targets. */
export function registrarCanAccessDepartment(user: RequestUser, targetDepartment: string | null | undefined): boolean {
  const department = registrarDepartment(user)
  if (!department) return false
  const target = targetDepartment?.trim()
  if (!target) return false
  return target.toLowerCase() === department.toLowerCase()
}

/** Prisma user clause pinning a registrar's account queries to their department. */
export function registrarUserWhere(user: RequestUser): Prisma.UserWhereInput {
  if (courseScopeMode() === 'course') return registrarCourseUserWhere(user)
  const department = registrarDepartment(user)
  if (!department) return { id: { in: [] as string[] } }
  return { department: { equals: department, mode: 'insensitive' } }
}

export type AccountAdminScope =
  | { kind: 'unrestricted' }
  | { kind: 'department'; department: string }
  | { kind: 'courses'; courses: string[] }
  | { kind: 'none' }

/** Course scope of a registrar (empty/non-registrar = none, fail-closed). */
export function registrarCourseScope(user: RequestUser | null | undefined): CourseScope {
  return isRegistrar(user) ? designeeCourseScope(user) : { kind: 'none' }
}

/** Prisma user clause for a registrar in course mode: campus-wide, or only students of the pinned courses. */
function registrarCourseUserWhere(user: RequestUser): Prisma.UserWhereInput {
  const scope = registrarCourseScope(user)
  if (scope.kind === 'all') return {}
  if (scope.kind === 'none') return { id: { in: [] as string[] } }
  return {
    role: 'student',
    OR: scope.courses.map((course) => ({ program: { equals: course, mode: 'insensitive' as const } })),
  }
}

/** A target account as far as registrar scoping is concerned. */
export interface AccountTarget {
  role?: string | null
  department?: string | null
  program?: string | null
}

/**
 * Can this registrar administer the target? Legacy: same department. Course
 * mode: an all-courses registrar may administer any non-super-admin account; a
 * course-pinned registrar only students whose program is in scope. Super-admin
 * targets are excluded by every caller.
 */
export function registrarCanAdminister(user: RequestUser, target: AccountTarget): boolean {
  if (courseScopeMode() !== 'course') return registrarCanAccessDepartment(user, target.department)
  const scope = registrarCourseScope(user)
  if (scope.kind === 'all') return true
  if (scope.kind === 'courses') return target.role === 'student' && courseInScope(scope, target.program)
  return false
}

/**
 * Department stored on a registrar-created account. Legacy forces the
 * registrar's own department; course mode keeps whatever the caller supplied
 * (students get the course code auto-filled by the service).
 */
export function registrarForcedDepartment(user: RequestUser, supplied?: string | null): string | null {
  if (courseScopeMode() !== 'course') return registrarDepartment(user)
  const value = supplied?.trim()
  return value ? value : null
}

/**
 * Scope for account-administration surfaces: identical to `adminScope` for
 * super admins, department-pinned for registrars, and `none` for everyone
 * else. Kept out of `admin-scope.ts` so the twelve classroom/admin modules
 * that rely on super-admin scope never change behavior.
 */
export function accountAdminScope(user: RequestUser): AccountAdminScope {
  if (user.role === 'super_admin') {
    const scope = adminScope(user)
    if (scope.kind === 'unrestricted') return { kind: 'unrestricted' }
    if (scope.kind === 'department') return { kind: 'department', department: scope.department }
    return { kind: 'none' }
  }
  if (!isRegistrar(user)) return { kind: 'none' }
  if (courseScopeMode() === 'course') {
    const scope = registrarCourseScope(user)
    if (scope.kind === 'all') return { kind: 'unrestricted' }
    if (scope.kind === 'courses') return { kind: 'courses', courses: scope.courses }
    return { kind: 'none' }
  }
  const department = registrarDepartment(user)
  return department ? { kind: 'department', department } : { kind: 'none' }
}

/** True when the update DTO carries any administrative-designation field. */
export function isDesignationWriteRequest(dto: {
  isItCoordinator?: boolean
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
  managedCourses?: string[]
  managesAllCourses?: boolean
}): boolean {
  return (
    dto.isItCoordinator !== undefined ||
    dto.isDepartmentHead !== undefined ||
    dto.isUserRegistrar !== undefined ||
    dto.managedCourses !== undefined ||
    dto.managesAllCourses !== undefined
  )
}

export type FacultyDesignationField = 'isItCoordinator' | 'isDepartmentHead' | 'isUserRegistrar'

/** Per-field before/after diff for the `admin.user.designations_changed` audit row. */
export function designationChanges(
  before: { isItCoordinator: boolean; isDepartmentHead: boolean; isUserRegistrar: boolean },
  after: { isItCoordinator?: boolean; isDepartmentHead?: boolean; isUserRegistrar?: boolean },
): Array<{ field: FacultyDesignationField; from: boolean; to: boolean }> {
  const fields: FacultyDesignationField[] = ['isItCoordinator', 'isDepartmentHead', 'isUserRegistrar']
  return fields.flatMap((field) => {
    const next = after[field]
    if (next === undefined || next === before[field]) return []
    return [{ field, from: before[field], to: next }]
  })
}
