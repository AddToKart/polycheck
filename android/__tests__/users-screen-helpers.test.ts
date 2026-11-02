import type { User } from '@polycheck/shared'
import {
  assignableRoleFor,
  buildAdminUserFilters,
  buildProfileUpdate,
  debounce,
  isProtectedAccount,
  mergeUserPages,
  nextUsersOffset,
  normalizeSearchTerm,
  profileFieldsForRole,
  roleChangeBlockReason,
  roleChangePrompt,
  roleForTab,
  SEARCH_DEBOUNCE_MS,
  tabForRole,
  uniqueDepartments,
  USERS_PAGE_SIZE,
} from '../components/users-screen-helpers'

const baseUser = {
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const teacher: User = {
  ...baseUser,
  id: 't-1',
  fullName: 'Prof One',
  email: 'prof@pup.edu.ph',
  role: 'teacher',
  department: 'CCIS',
}

const student: User = {
  ...baseUser,
  id: 's-1',
  fullName: 'Student One',
  studentId: '2024-00001-MN-0',
  role: 'student',
  department: 'CCIS',
  program: 'BS Computer Science',
  yearLevel: 2,
}

const admin: User = { ...baseUser, id: 'a-1', fullName: 'Admin One', role: 'super_admin', department: 'CCIS' }

const profileForm = {
  fullName: '  Updated Name  ',
  department: '  CCIS  ',
  email: '  updated@pup.edu.ph  ',
  program: '  BS Information Technology  ',
  yearLevel: ' 3 ',
}

describe('users screen helpers', () => {
  it('keeps the directory page size and debounce at the plan values', () => {
    expect(USERS_PAGE_SIZE).toBe(100)
    expect(SEARCH_DEBOUNCE_MS).toBe(300)
  })

  it('maps tabs and roles both ways', () => {
    expect(roleForTab('teachers')).toBe('teacher')
    expect(roleForTab('students')).toBe('student')
    expect(roleForTab('admins')).toBe('super_admin')
    expect(tabForRole('teacher')).toBe('teachers')
    expect(tabForRole('student')).toBe('students')
    expect(tabForRole('super_admin')).toBe('admins')
  })

  it('appends pages without duplicating accounts', () => {
    const pageTwo = [student, { ...student, id: 's-2', fullName: 'Student Two' }]
    expect(mergeUserPages([teacher], pageTwo).map((user) => user.id)).toEqual(['t-1', 's-1', 's-2'])
    expect(mergeUserPages([], pageTwo)).toEqual(pageTwo)
  })

  it('computes the next offset from the server page', () => {
    expect(nextUsersOffset({ offset: 100, data: [student, teacher] })).toBe(102)
  })

  it('omits blank search/status and includes the page window', () => {
    expect(buildAdminUserFilters({ role: 'student', search: '  ', department: '', status: 'all', offset: 200 })).toEqual({
      role: 'student',
      limit: 100,
      offset: 200,
    })
    expect(buildAdminUserFilters({ role: 'teacher', search: '  alex  ', department: ' CCIS ', status: 'inactive', offset: 0 })).toEqual({
      role: 'teacher',
      q: 'alex',
      department: 'CCIS',
      status: 'inactive',
      limit: 100,
      offset: 0,
    })
  })

  it('normalizes search terms', () => {
    expect(normalizeSearchTerm('  alexandra  ')).toBe('alexandra')
  })

  it('dedupes and sorts department options', () => {
    expect(uniqueDepartments([teacher, student, { ...student, id: 's-2', department: 'COE' }], 'CCIS')).toEqual(['CCIS', 'COE'])
  })

  it('exposes role-specific edit fields only', () => {
    expect(profileFieldsForRole('teacher')).toEqual(['fullName', 'department', 'email'])
    expect(profileFieldsForRole('student')).toEqual(['fullName', 'department', 'program', 'yearLevel'])
    expect(profileFieldsForRole('super_admin')).toEqual([])
  })

  describe('buildProfileUpdate', () => {
    it('builds a teacher update with full name, department and email', () => {
      const result = buildProfileUpdate('teacher', profileForm)
      expect(result.error).toBeUndefined()
      expect(result.input).toEqual({
        fullName: 'Updated Name',
        department: 'CCIS',
        email: 'updated@pup.edu.ph',
      })
    })

    it('builds a student update without an email mutation', () => {
      const result = buildProfileUpdate('student', profileForm)
      expect(result.input).toEqual({
        fullName: 'Updated Name',
        department: 'CCIS',
        program: 'BS Information Technology',
        yearLevel: 3,
      })
      expect(result.input).not.toHaveProperty('email')
    })

    it('rejects protected, incomplete, and invalid forms', () => {
      expect(buildProfileUpdate('super_admin', profileForm).error).toContain('cannot be edited')
      expect(buildProfileUpdate('teacher', { ...profileForm, fullName: 'A' }).error).toContain('full name')
      expect(buildProfileUpdate('teacher', { ...profileForm, department: '' }).error).toContain('department')
      expect(buildProfileUpdate('teacher', { ...profileForm, email: 'not-an-email' }).error).toContain('email')
      expect(buildProfileUpdate('student', { ...profileForm, yearLevel: '0' }).error).toContain('Year level')
      expect(buildProfileUpdate('student', { ...profileForm, yearLevel: '4.5' }).error).toContain('Year level')
    })
  })

  describe('role changes', () => {
    it('allows only student <-> teacher transitions', () => {
      expect(assignableRoleFor('teacher')).toBe('student')
      expect(assignableRoleFor('student')).toBe('teacher')
      expect(assignableRoleFor('super_admin')).toBeNull()
    })

    it('blocks missing departments and protected accounts', () => {
      expect(roleChangeBlockReason(teacher)).toBeNull()
      expect(roleChangeBlockReason(student)).toBeNull()
      expect(roleChangeBlockReason({ ...student, department: undefined })).toBe('missing_department')
      expect(roleChangeBlockReason(admin)).toBe('protected_account')
    })

    it('writes explicit consequence copy', () => {
      const demotion = roleChangePrompt(teacher)
      expect(demotion).toMatchObject({ role: 'student' })
      expect(demotion?.message).toContain('blocked while they still own a class section')

      const promotion = roleChangePrompt(student)
      expect(promotion).toMatchObject({ role: 'teacher' })
      expect(promotion?.message).toContain('department must be set first')
      expect(roleChangePrompt(admin)).toBeNull()
    })

    it('flags super-admin rows as protected', () => {
      expect(isProtectedAccount(admin)).toBe(true)
      expect(isProtectedAccount(teacher)).toBe(false)
    })
  })

  describe('debounce', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('calls the trailing invocation only', () => {
      const spy = jest.fn()
      const run = debounce(spy, 300)

      run('a')
      jest.advanceTimersByTime(100)
      run('b')
      jest.advanceTimersByTime(299)
      expect(spy).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('b')
    })

    it('can be cancelled', () => {
      const spy = jest.fn()
      const run = debounce(spy, 300)

      run()
      run.cancel()
      jest.advanceTimersByTime(500)

      expect(spy).not.toHaveBeenCalled()
    })
  })
})
