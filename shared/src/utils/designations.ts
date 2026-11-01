import type { UserRole } from '../types/user'

/**
 * Pure administrative-designation helpers shared by web, mobile, and backend.
 *
 * PUP Santa Maria "dual-hat" model: teachers keep their classroom identity and
 * may additionally hold one or more administrative designations. Super admins
 * implicitly hold every suite, so the helpers always short-circuit on
 * `role === 'super_admin'` without requiring flags on the account.
 */

export type FacultyDesignation = 'it_operations' | 'academic_oversight' | 'user_admin'

export const FACULTY_DESIGNATIONS: readonly FacultyDesignation[] = [
  'it_operations',
  'academic_oversight',
  'user_admin',
] as const

export const DESIGNATION_FLAGS = {
  it_operations: 'isItCoordinator',
  academic_oversight: 'isDepartmentHead',
  user_admin: 'isUserRegistrar',
} as const

export const DESIGNATION_LABELS: Record<FacultyDesignation, string> = {
  it_operations: 'IT Coordinator',
  academic_oversight: 'Department Head',
  user_admin: 'Registrar',
}

export const DESIGNATION_DESCRIPTIONS: Record<FacultyDesignation, string> = {
  it_operations: 'Server status, issue triage, and maintenance controls.',
  academic_oversight: 'Department-wide reports, excuses, and at-risk oversight.',
  user_admin: 'Department-scoped account creation, resets, and roster imports.',
}

export interface DesignationCarrier {
  role: UserRole
  department?: string | null
  isItCoordinator?: boolean
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
}

type DesignationFlag = (typeof DESIGNATION_FLAGS)[FacultyDesignation]

function teacherHasFlag(user: DesignationCarrier | null | undefined, flag: DesignationFlag): boolean {
  if (!user) return false
  if (user.role === 'super_admin') return true
  return user.role === 'teacher' && user[flag] === true
}

export function hasDesignation(
  user: DesignationCarrier | null | undefined,
  designation: FacultyDesignation,
): boolean {
  return teacherHasFlag(user, DESIGNATION_FLAGS[designation])
}

/** Every active designation, in stable declaration order (empty for students/plain teachers). */
export function activeDesignations(user: DesignationCarrier | null | undefined): FacultyDesignation[] {
  return FACULTY_DESIGNATIONS.filter((designation) => hasDesignation(user, designation))
}

/** IT Operations Suite: server status, issue triage, maintenance controls. */
export function canAccessItOperations(user: DesignationCarrier | null | undefined): boolean {
  return teacherHasFlag(user, 'isItCoordinator')
}

/** Academic Department Oversight: reports, excuses, at-risk — department-scoped server-side. */
export function canAccessAcademicOversight(user: DesignationCarrier | null | undefined): boolean {
  return teacherHasFlag(user, 'isDepartmentHead')
}

/** Registrar Suite: department-scoped account administration. */
export function canAccessUserAdmin(user: DesignationCarrier | null | undefined): boolean {
  return teacherHasFlag(user, 'isUserRegistrar')
}

/** Maintenance-mode exemption is deliberately limited to super admins and IT coordinators. */
export function isMaintenanceExempt(user: DesignationCarrier | null | undefined): boolean {
  return teacherHasFlag(user, 'isItCoordinator')
}

/**
 * The department an academic-oversight actor may inspect. Super admins are not
 * pinned (their scope is resolved by the existing admin-scope helpers), and a
 * designated head without a department gets no oversight at all.
 */
export function oversightDepartment(user: DesignationCarrier | null | undefined): string | null {
  if (!user || user.role !== 'teacher' || user.isDepartmentHead !== true) return null
  const department = user.department?.trim()
  return department ? department : null
}
