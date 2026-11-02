import type { RequestUser } from '../../auth/authenticated-principal'
import type { Prisma } from '../../prisma/client'
import { adminScope } from '../admin-scope'

/**
 * Separation-of-duties helpers for the registrar designation.
 *
 * Deliberately separate from `admin-scope.ts`: super-admin scope semantics are
 * load-bearing for twelve modules and must not shift. Registrars are teacher
 * accounts pinned to their own `department`, and only account-administration
 * surfaces consult these helpers.
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
  const department = registrarDepartment(user)
  if (!department) return { id: { in: [] as string[] } }
  return { department: { equals: department, mode: 'insensitive' } }
}

export type AccountAdminScope = { kind: 'unrestricted' } | { kind: 'department'; department: string } | { kind: 'none' }

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
  const department = registrarDepartment(user)
  return department ? { kind: 'department', department } : { kind: 'none' }
}

/** True when the update DTO carries any administrative-designation field. */
export function isDesignationWriteRequest(dto: {
  isItCoordinator?: boolean
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
}): boolean {
  return dto.isItCoordinator !== undefined || dto.isDepartmentHead !== undefined || dto.isUserRegistrar !== undefined
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
