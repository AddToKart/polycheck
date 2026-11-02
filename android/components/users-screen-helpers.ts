import type {
  AdminUserFilters,
  AdminUserRoleFilter,
  AdminUserStatusFilter,
  AssignableRole,
  UpdateUserInput,
  User,
  UserRole,
} from '@polycheck/shared'

export const USERS_PAGE_SIZE = 100
export const SEARCH_DEBOUNCE_MS = 300

export type UserRoleTab = 'teachers' | 'students' | 'admins'

export const USER_ROLE_TABS: Array<{ id: UserRoleTab; label: string; role: AdminUserRoleFilter }> = [
  { id: 'teachers', label: 'Teachers', role: 'teacher' },
  { id: 'students', label: 'Students', role: 'student' },
  { id: 'admins', label: 'Admins', role: 'super_admin' },
]

export function roleForTab(tab: UserRoleTab): AdminUserRoleFilter {
  return USER_ROLE_TABS.find((entry) => entry.id === tab)?.role ?? 'teacher'
}

export function tabForRole(role: UserRole): UserRoleTab {
  if (role === 'student') return 'students'
  if (role === 'super_admin') return 'admins'
  return 'teachers'
}

/** Appends a page without duplicating rows that were already rendered. */
export function mergeUserPages(current: User[], incoming: User[]): User[] {
  if (current.length === 0) return incoming
  const seen = new Set(current.map((user) => user.id))
  return [...current, ...incoming.filter((user) => !seen.has(user.id))]
}

/** Offset for the next request; the server echoes `offset`/`data`. */
export function nextUsersOffset(page: { offset: number; data: User[] }): number {
  return page.offset + page.data.length
}

export function normalizeSearchTerm(input: string): string {
  return input.trim()
}

export function buildAdminUserFilters(input: {
  role: AdminUserRoleFilter
  search: string
  department: string
  status: AdminUserStatusFilter | 'all'
  offset: number
  limit?: number
}): AdminUserFilters {
  const search = normalizeSearchTerm(input.search)
  const department = normalizeSearchTerm(input.department)
  return {
    role: input.role,
    ...(search ? { q: search } : {}),
    ...(department ? { department } : {}),
    ...(input.status !== 'all' ? { status: input.status } : {}),
    limit: input.limit ?? USERS_PAGE_SIZE,
    offset: input.offset,
  }
}

/** Departments already present in the loaded page plus the actor's own. */
export function uniqueDepartments(users: User[], extra?: string): string[] {
  const values = new Set<string>()
  for (const user of users) {
    const department = user.department?.trim()
    if (department) values.add(department)
  }
  const extraValue = extra?.trim()
  if (extraValue) values.add(extraValue)
  return [...values].sort((a, b) => a.localeCompare(b))
}

export type UserProfileField = 'fullName' | 'department' | 'email' | 'program' | 'yearLevel'

/** Role-specific fields exposed by the edit sheet (Locked Decision 8). */
export function profileFieldsForRole(role: UserRole): UserProfileField[] {
  switch (role) {
    case 'teacher':
      return ['fullName', 'department', 'email']
    case 'student':
      return ['fullName', 'department', 'program', 'yearLevel']
    default:
      return []
  }
}

export interface UserProfileForm {
  fullName: string
  department: string
  email: string
  program: string
  yearLevel: string
}

export interface ProfileUpdateResult {
  input?: UpdateUserInput
  error?: string
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/**
 * Validates the edit sheet and returns only the whitelisted fields for the
 * target role (no student-number/email mutation for students).
 */
export function buildProfileUpdate(role: UserRole, form: UserProfileForm): ProfileUpdateResult {
  if (role === 'super_admin') {
    return { error: 'Super administrator accounts cannot be edited here.' }
  }

  const fullName = form.fullName.trim()
  if (fullName.length < 2) return { error: 'Enter the account holder’s full name.' }

  const department = form.department.trim()
  if (department.length < 2) return { error: 'A department is required.' }

  const input: UpdateUserInput = { fullName, department }

  if (role === 'teacher') {
    const email = form.email.trim()
    if (!EMAIL_PATTERN.test(email)) return { error: 'Enter a valid faculty email address.' }
    input.email = email
  }

  if (role === 'student') {
    const program = form.program.trim()
    if (program.length < 2) return { error: 'Enter the student’s program.' }
    const yearLevel = Number(form.yearLevel)
    if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 8) {
      return { error: 'Year level must be a whole number from 1 to 8.' }
    }
    input.program = program
    input.yearLevel = yearLevel
  }

  return { input }
}

export function assignableRoleFor(role: UserRole): AssignableRole | null {
  if (role === 'teacher') return 'student'
  if (role === 'student') return 'teacher'
  return null
}

export type RoleChangeBlockReason = 'missing_department' | 'protected_account' | null

export function roleChangeBlockReason(user: User): RoleChangeBlockReason {
  if (user.role === 'super_admin') return 'protected_account'
  if (user.role === 'student' && !user.department?.trim()) return 'missing_department'
  return null
}

export interface RoleChangePrompt {
  role: AssignableRole
  title: string
  message: string
  confirmLabel: string
}

/** Explicit consequence copy shown before a role change (Locked Decision 6). */
export function roleChangePrompt(user: User): RoleChangePrompt | null {
  if (user.role === 'teacher') {
    return {
      role: 'student',
      title: `Change ${user.fullName} to student?`,
      message: 'They lose faculty access to subjects, sessions, and rosters. The change is blocked while they still own a class section.',
      confirmLabel: 'Change to student',
    }
  }

  if (user.role === 'student') {
    return {
      role: 'teacher',
      title: `Change ${user.fullName} to teacher?`,
      message: 'They gain faculty access to create subjects and sessions. A department must be set first; attendance history is kept.',
      confirmLabel: 'Change to teacher',
    }
  }

  return null
}

export function isProtectedAccount(user: User): boolean {
  return user.role === 'super_admin'
}

export function describeAccountRole(user: User): string {
  if (user.role === 'super_admin') return 'Super administrator'
  if (user.role === 'teacher') return 'Faculty'
  return 'Student'
}

export type CancelableDebounce<Args extends unknown[]> = ((...args: Args) => void) & { cancel: () => void }

/** Trailing-edge debounce used by the search inputs (and Jest-testable). */
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number): CancelableDebounce<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = ((...args: Args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delayMs)
  }) as CancelableDebounce<Args>

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return debounced
}
