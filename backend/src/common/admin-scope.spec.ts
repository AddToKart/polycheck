import type { RequestUser } from '../auth/authenticated-principal'
import {
  adminCanAccessSection,
  adminCanAccessUser,
  adminDepartmentSectionIds,
  adminEnrollmentWhere,
  adminRecordWhere,
  adminSectionInScope,
  adminSectionWhere,
  adminSessionWhere,
  adminSubjectWhere,
  adminUserWhere,
  assertStudentInAdminScope,
} from './admin-scope'

const departmentAdmin: RequestUser = {
  id: 'admin-1',
  role: 'super_admin',
  scope: 'department',
  department: 'Computer Studies',
}
const departmentFilter = { equals: 'Computer Studies', mode: 'insensitive' }

describe('admin-scope department matching (DD-B7)', () => {
  it('uses a case-insensitive department filter in every query fragment', () => {
    expect(adminSectionWhere(departmentAdmin)).toEqual({ teacher: { department: departmentFilter } })
    expect(adminSessionWhere(departmentAdmin)).toEqual({
      section: { teacher: { department: departmentFilter } },
    })
    expect(adminRecordWhere(departmentAdmin)).toEqual({
      session: { section: { teacher: { department: departmentFilter } } },
    })
    expect(adminEnrollmentWhere(departmentAdmin)).toEqual({
      section: { teacher: { department: departmentFilter } },
    })
    expect(adminSubjectWhere(departmentAdmin)).toEqual({
      OR: [
        { createdBy: { department: departmentFilter } },
        { sections: { some: { teacher: { department: departmentFilter } } } },
      ],
    })
    expect(adminUserWhere(departmentAdmin)).toEqual({ department: departmentFilter })
  })

  it('accepts targets whose department differs only in case', () => {
    expect(adminCanAccessSection(departmentAdmin, 'computer studies')).toBe(true)
    expect(adminCanAccessSection(departmentAdmin, ' COMPUTER STUDIES ')).toBe(true)
    expect(adminCanAccessUser(departmentAdmin, 'Computer studies')).toBe(true)
    expect(adminCanAccessSection(departmentAdmin, 'COE')).toBe(false)
    expect(adminCanAccessSection(departmentAdmin, null)).toBe(false)
  })

  it('queries the section scope case-insensitively', async () => {
    const prisma = { section: { findFirst: jest.fn().mockResolvedValue({ id: 'section-1' }) } }

    await expect(adminSectionInScope(departmentAdmin, 'section-1', prisma as never)).resolves.toBe(true)
    expect(prisma.section.findFirst).toHaveBeenCalledWith({
      where: { id: 'section-1', teacher: { department: departmentFilter } },
      select: { id: true },
    })
  })

  it('queries the student scope case-insensitively', async () => {
    const prisma = { enrollment: { findFirst: jest.fn().mockResolvedValue({ id: 'enrollment-1' }) } }

    await expect(
      assertStudentInAdminScope(departmentAdmin, 'student-1', prisma as never, 'section-1'),
    ).resolves.toBeUndefined()
    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        sectionId: 'section-1',
        section: { teacher: { department: departmentFilter } },
      },
      select: { id: true },
    })
  })

  it('lists department section ids case-insensitively', async () => {
    const prisma = {
      section: { findMany: jest.fn().mockResolvedValue([{ id: 'section-1' }, { id: 'section-2' }]) },
    }

    await expect(adminDepartmentSectionIds(departmentAdmin, prisma as never)).resolves.toEqual([
      'section-1',
      'section-2',
    ])
    expect(prisma.section.findMany).toHaveBeenCalledWith({
      where: { teacher: { department: departmentFilter } },
      select: { id: true },
    })
  })
})
