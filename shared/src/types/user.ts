export type UserRole = 'super_admin' | 'teacher' | 'student'

export interface User {
  id: string
  studentId?: string
  fullName: string
  email?: string
  role: UserRole
  program?: string
  yearLevel?: number
  department?: string
  photoUrl?: string
  isActive: boolean
  privacyConsentVersion?: string
  privacyConsentedAt?: string
  /** True for bulk-generated or admin-reset credentials until the user changes it. */
  mustChangePassword?: boolean
  /** Mobile installation id bound to a student account (anti-cheat device binding). */
  boundDeviceId?: string | null
  deviceBoundAt?: string | null
  /** While set and in the future, student logins from other devices are rejected. */
  deviceCooldownUntil?: string | null
  /** Device exempt from the cooldown (the device that logged out or unregistered). */
  cooldownDeviceId?: string | null
  /** Nullable per-teacher override; null means "follow the institution setting". */
  canResetStudentPasswords?: boolean | null
  canEmergencyUnbindDevices?: boolean | null
  /** Effective teacher capabilities (post institution-policy merge), teacher accounts only. */
  delegatedPermissions?: {
    canResetStudentPasswords: boolean
    canEmergencyUnbindDevices: boolean
  }
  /**
   * Concurrent administrative designations (PUP Santa Maria dual-hat model).
   * Teacher accounts only; super admins hold all three suites implicitly.
   */
  isItCoordinator?: boolean
  isDepartmentHead?: boolean
  isUserRegistrar?: boolean
  /** Secondary contact channels owned by the user (never the login identity). */
  contactEmail?: string | null
  contactPhone?: string | null
  createdAt: string
  updatedAt: string
}

export interface Teacher extends User {
  role: 'teacher'
  department?: string
}

export interface Student extends User {
  role: 'student'
  studentId: string
  program: string
  yearLevel: number
  enrolledSectionIds: string[]
}

export interface SuperAdmin extends User {
  role: 'super_admin'
  scope: 'department' | 'institution'
}
