import type { UserRole } from '../prisma/client'

export interface RequestUser {
  id: string
  role: UserRole
  email?: string | null
  studentId?: string | null
  department?: string | null
  scope?: string | null
  authSessionId?: string
  mustChangePassword?: boolean
  privacyConsentVersion?: string | null
  privacyConsentedAt?: Date | null
  /** Concurrent administrative designations (dual-hat model). */
  isItCoordinator?: boolean
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
  /** Course scope of head/registrar designees (see common/course-scope.ts). */
  managedCourses?: string[]
  managesAllCourses?: boolean
}
