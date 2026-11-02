import type {
  AdminUserFilters,
  AdminUserPage,
  AssignableRole,
  UpdateUserInput,
  User,
  UserRole,
} from '@polycheck/shared'

export const USER_PAGE_SIZE = 20
export const MAX_USER_PAGE_SIZE = 100

export type UserRoleTab = 'teacher' | 'student' | 'super_admin'
export type UserStatusFilter = '' | 'active' | 'inactive'

export interface UserFilterState {
  q: string
  department: string
  status: UserStatusFilter
}

export const emptyUserPage: AdminUserPage = {
  data: [],
  total: 0,
  limit: USER_PAGE_SIZE,
  offset: 0,
  hasMore: false,
}

/** Institution-scope admins are the only ones allowed to provision super admins. */
export function isInstitutionAdmin(user: { role: UserRole; scope?: string | null }): boolean {
  return user.role === 'super_admin' && user.scope === 'institution'
}

export function isDepartmentScopedAdmin(user: { role: UserRole; scope?: string | null }): boolean {
  return user.role === 'super_admin' && user.scope === 'department'
}

/** Q1: super-admin rows are managed by DB operations and cannot be edited from the console. */
export function canManageUser(target: Pick<User, 'role'>): boolean {
  return target.role !== 'super_admin'
}

export function assignableRoleFor(target: Pick<User, 'role'>): AssignableRole | null {
  if (target.role === 'teacher') return 'student'
  if (target.role === 'student') return 'teacher'
  return null
}

export function buildUserFilters(
  tab: UserRoleTab,
  filters: UserFilterState,
  offset = 0,
  limit = USER_PAGE_SIZE,
): AdminUserFilters {
  const cappedLimit = Math.min(Math.max(1, Math.trunc(limit)), MAX_USER_PAGE_SIZE)
  const query = filters.q.trim()
  const department = filters.department.trim()
  return {
    role: tab,
    ...(query ? { q: query } : {}),
    ...(department ? { department } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    limit: cappedLimit,
    offset: Math.max(0, Math.trunc(offset)),
  }
}

export type EditableUserField = 'fullName' | 'department' | 'email' | 'program' | 'yearLevel'

export function editableFieldsForRole(role: UserRole): EditableUserField[] {
  if (role === 'teacher') return ['fullName', 'department', 'email']
  if (role === 'student') return ['fullName', 'department', 'program', 'yearLevel']
  return []
}

export function editableValuesForUser(user: User): Record<EditableUserField, string> {
  return {
    fullName: user.fullName ?? '',
    department: user.department ?? '',
    email: user.email ?? '',
    program: user.program ?? '',
    yearLevel: user.yearLevel ? String(user.yearLevel) : '',
  }
}

export function validateUserUpdate(
  target: User,
  values: Record<EditableUserField, string>,
): string | null {
  const fields = new Set(editableFieldsForRole(target.role))
  if (!fields.size) return 'This account type cannot be edited from the console.'
  if (fields.has('fullName') && values.fullName.trim().length < 2) {
    return 'Full name must be at least 2 characters.'
  }
  if (fields.has('department') && target.role === 'student' && values.department.trim().length < 2) {
    return 'Department is required for student accounts.'
  }
  if (fields.has('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return 'Enter a valid PUP email address.'
  }
  if (fields.has('program') && values.program.trim().length < 2) {
    return 'Program must be at least 2 characters.'
  }
  if (fields.has('yearLevel')) {
    const year = Number(values.yearLevel)
    if (!Number.isInteger(year) || year < 1 || year > 8) return 'Year level must be between 1 and 8.'
  }
  return null
}

/** Send only the role-supported fields that actually changed. */
export function buildUserUpdateInput(
  target: User,
  values: Record<EditableUserField, string>,
): UpdateUserInput {
  const fields = new Set(editableFieldsForRole(target.role))
  const input: UpdateUserInput = {}
  if (fields.has('fullName')) {
    const fullName = values.fullName.trim()
    if (fullName && fullName !== target.fullName) input.fullName = fullName
  }
  if (fields.has('department')) {
    const department = values.department.trim()
    if (department && department !== (target.department ?? '')) input.department = department
  }
  if (fields.has('email')) {
    const email = values.email.trim()
    if (email && email !== (target.email ?? '')) input.email = email
  }
  if (fields.has('program')) {
    const program = values.program.trim()
    if (program && program !== (target.program ?? '')) input.program = program
  }
  if (fields.has('yearLevel')) {
    const yearLevel = Number(values.yearLevel)
    if (Number.isInteger(yearLevel) && yearLevel >= 1 && yearLevel <= 8 && yearLevel !== target.yearLevel) {
      input.yearLevel = yearLevel
    }
  }
  return input
}

export function hasUserChanges(input: UpdateUserInput): boolean {
  return Object.keys(input).length > 0
}

export function roleChangeRequiresDepartment(target: Pick<User, 'department'>, nextRole: AssignableRole): boolean {
  return nextRole === 'teacher' && !target.department?.trim()
}

export interface RoleChangeCopy {
  title: string
  consequence: string
  confirmLabel: string
}

export function roleChangeCopy(target: Pick<User, 'fullName' | 'role'>, nextRole: AssignableRole): RoleChangeCopy {
  if (nextRole === 'student') {
    return {
      title: 'Change to Student',
      consequence:
        `${target.fullName} will lose teaching access. The change is blocked while this teacher still has ` +
        'sections assigned, so reassign or remove those sections first.',
      confirmLabel: 'Change to Student',
    }
  }
  return {
    title: 'Change to Teacher',
    consequence:
      `${target.fullName} will gain teaching access and keep their enrollment history. ` +
      'A department is required before this student can become a teacher.',
    confirmLabel: 'Change to Teacher',
  }
}

export function userPageCount(page: AdminUserPage): number {
  return page.limit > 0 ? Math.ceil(page.total / page.limit) : 0
}

export function userPageNumber(page: AdminUserPage): number {
  return page.limit > 0 ? Math.floor(page.offset / page.limit) + 1 : 1
}

export function userRangeLabel(page: AdminUserPage): string {
  if (page.total === 0) return '0 accounts'
  const first = page.offset + 1
  const last = Math.min(page.offset + page.data.length, page.total)
  return `${first}–${last} of ${page.total.toLocaleString()}`
}

export function roleLabel(role: UserRole): string {
  if (role === 'super_admin') return 'Super Admin'
  if (role === 'teacher') return 'Teacher'
  return 'Student'
}

export function roleTabLabel(tab: UserRoleTab): string {
  if (tab === 'super_admin') return 'Super Admins'
  if (tab === 'teacher') return 'Teachers'
  return 'Students'
}
