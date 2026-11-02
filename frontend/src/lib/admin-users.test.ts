import { describe, expect, it } from 'vitest'
import type { AdminUserPage, User } from '@polycheck/shared'
import {
  assignableRoleFor,
  buildUserFilters,
  buildUserUpdateInput,
  canManageUser,
  editableFieldsForRole,
  editableValuesForUser,
  isDepartmentScopedAdmin,
  isInstitutionAdmin,
  MAX_USER_PAGE_SIZE,
  roleChangeCopy,
  roleChangeRequiresDepartment,
  userPageCount,
  userPageNumber,
  userRangeLabel,
  validateUserUpdate,
} from './admin-users'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    fullName: 'Test User',
    role: 'teacher',
    email: 'test@pup.edu.ph',
    department: 'CCIS',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function page(overrides: Partial<AdminUserPage> = {}): AdminUserPage {
  return { data: [], total: 0, limit: 20, offset: 0, hasMore: false, ...overrides }
}

describe('admin user helpers', () => {
  it('distinguishes institution and department super-admins', () => {
    expect(isInstitutionAdmin({ role: 'super_admin', scope: 'institution' })).toBe(true)
    expect(isInstitutionAdmin({ role: 'super_admin', scope: 'department' })).toBe(false)
    expect(isInstitutionAdmin({ role: 'teacher', scope: 'institution' })).toBe(false)
    expect(isDepartmentScopedAdmin({ role: 'super_admin', scope: 'department' })).toBe(true)
    expect(isDepartmentScopedAdmin({ role: 'super_admin' })).toBe(false)
  })

  it('never offers management actions for super-admin targets (Q1)', () => {
    expect(canManageUser({ role: 'teacher' })).toBe(true)
    expect(canManageUser({ role: 'student' })).toBe(true)
    expect(canManageUser({ role: 'super_admin' })).toBe(false)
    expect(assignableRoleFor({ role: 'super_admin' })).toBeNull()
  })

  it('builds server filters with trimmed values and a capped page size', () => {
    expect(
      buildUserFilters(
        'student',
        { q: '  Reyes  ', department: ' CCIS ', status: 'inactive' },
        40,
        500,
      ),
    ).toEqual({
      role: 'student',
      q: 'Reyes',
      department: 'CCIS',
      status: 'inactive',
      limit: MAX_USER_PAGE_SIZE,
      offset: 40,
    })

    expect(buildUserFilters('teacher', { q: '  ', department: '', status: '' }, -10, 0)).toEqual({
      role: 'teacher',
      limit: 1,
      offset: 0,
    })
  })

  it('exposes role-specific edit fields', () => {
    expect(editableFieldsForRole('teacher')).toEqual(['fullName', 'department', 'email'])
    expect(editableFieldsForRole('student')).toEqual(['fullName', 'department', 'program', 'yearLevel'])
    expect(editableFieldsForRole('super_admin')).toEqual([])
  })

  it('sends only changed, role-supported profile fields', () => {
    const teacher = makeUser()
    const values = editableValuesForUser(teacher)
    expect(buildUserUpdateInput(teacher, values)).toEqual({})

    const changed = {
      ...values,
      fullName: '  Updated Name ',
      email: 'updated@pup.edu.ph',
      program: 'Should be ignored',
      yearLevel: '4',
    }
    expect(buildUserUpdateInput(teacher, changed)).toEqual({
      fullName: 'Updated Name',
      email: 'updated@pup.edu.ph',
    })

    const student = makeUser({
      role: 'student',
      studentId: '2024-00001-MN-0',
      program: 'BSIT',
      yearLevel: 2,
      email: 'student@pup.edu.ph',
    })
    expect(
      buildUserUpdateInput(student, {
        ...editableValuesForUser(student),
        program: 'BSCS',
        yearLevel: '3',
        email: 'ignored@pup.edu.ph',
      }),
    ).toEqual({ program: 'BSCS', yearLevel: 3 })
  })

  it('validates required role fields before submitting', () => {
    const teacher = makeUser()
    const base = editableValuesForUser(teacher)
    expect(validateUserUpdate(teacher, base)).toBeNull()
    expect(validateUserUpdate(teacher, { ...base, fullName: 'A' })).toContain('at least 2')
    expect(validateUserUpdate(teacher, { ...base, email: 'not-an-email' })).toContain('valid PUP email')

    const student = makeUser({ role: 'student', program: 'BSIT', yearLevel: 2 })
    const studentValues = editableValuesForUser(student)
    expect(validateUserUpdate(student, { ...studentValues, department: '' })).toContain('Department is required')
    expect(validateUserUpdate(student, { ...studentValues, yearLevel: '9' })).toContain('between 1 and 8')
    expect(validateUserUpdate(student, { ...studentValues, program: '' })).toContain('Program')
  })

  it('describes role-change consequences and department requirements', () => {
    const teacher = makeUser({ role: 'teacher', fullName: 'Prof. Reyes' })
    expect(roleChangeCopy(teacher, 'student')).toEqual(
      expect.objectContaining({
        title: 'Change to Student',
        consequence: expect.stringContaining('lose teaching access'),
      }),
    )
    const student = makeUser({ role: 'student', fullName: 'Sam Student', department: '' })
    expect(roleChangeCopy(student, 'teacher').consequence).toContain('A department is required')
    expect(roleChangeRequiresDepartment(student, 'teacher')).toBe(true)
    expect(roleChangeRequiresDepartment({ department: 'CCIS' }, 'teacher')).toBe(false)
  })

  it('formats pagination ranges and page counts safely', () => {
    expect(userPageCount(page())).toBe(0)
    expect(userPageNumber(page())).toBe(1)
    expect(userRangeLabel(page())).toBe('0 accounts')

    const populated = page({ data: Array.from({ length: 20 }, () => makeUser()), total: 45, offset: 20, hasMore: true })
    expect(userPageCount(populated)).toBe(3)
    expect(userPageNumber(populated)).toBe(2)
    expect(userRangeLabel(populated)).toBe('21–40 of 45')
  })
})
