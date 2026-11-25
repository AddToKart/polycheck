import { ForbiddenException } from '@nestjs/common'
import { AttendanceScopeService } from './attendance-scope.service'
import type { RequestUser } from '../auth/authenticated-principal'

const plainTeacher: RequestUser = { id: 'teacher-1', role: 'teacher', department: 'CCIS' }
const head: RequestUser = {
  id: 'head-1',
  role: 'teacher',
  department: 'CCIS',
  isDepartmentHead: true,
}
const headWithoutDepartment: RequestUser = { id: 'head-2', role: 'teacher', isDepartmentHead: true }

describe('AttendanceScopeService department-head scope', () => {
  let service: AttendanceScopeService

  beforeEach(() => {
    service = new AttendanceScopeService({} as never)
  })

  it('scopes plain teachers to their own sessions', async () => {
    await expect(service.sessionScope(plainTeacher)).resolves.toEqual({ teacherId: 'teacher-1' })
    await expect(service.recordScope(plainTeacher)).resolves.toEqual({
      session: { teacherId: 'teacher-1' },
    })
  })

  it('expands a designated head to their department', async () => {
    await expect(service.sessionScope(head)).resolves.toEqual({
      section: { teacher: { department: { equals: 'CCIS', mode: 'insensitive' } } },
    })
    await expect(service.recordScope(head)).resolves.toEqual({
      session: { section: { teacher: { department: { equals: 'CCIS', mode: 'insensitive' } } } },
    })
  })

  it('treats a head without a department as a plain teacher', async () => {
    await expect(service.sessionScope(headWithoutDepartment)).resolves.toEqual({ teacherId: 'head-2' })
  })

  it('lets a head filter by another teacher inside the department', async () => {
    const where = await service.filteredSessionScope(
      head,
      { teacherId: 'teacher-2' },
      {
        startDate: '2026-11-01',
        endDate: '2026-11-01',
      },
    )
    const clauses = where.AND as unknown[]
    expect(clauses).toEqual(
      expect.arrayContaining([
        { teacherId: 'teacher-2' },
        { section: { teacher: { department: { equals: 'CCIS', mode: 'insensitive' } } } },
      ]),
    )
  })

  it('pins the department filter for heads even when another department is requested', async () => {
    const where = await service.filteredSessionScope(
      head,
      { department: 'CAF' },
      {
        startDate: '2026-11-01',
        endDate: '2026-11-01',
      },
    )
    const clauses = where.AND as unknown[]
    expect(clauses).toContainEqual({
      section: { teacher: { department: { equals: 'CCIS', mode: 'insensitive' } } },
    })
  })

  it('still blocks plain teachers from reporting on another teacher', async () => {
    await expect(
      service.filteredSessionScope(
        plainTeacher,
        { teacherId: 'teacher-2' },
        {
          startDate: '2026-11-01',
          endDate: '2026-11-01',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('keeps institution super admins unrestricted', async () => {
    const admin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
    await expect(service.sessionScope(admin)).resolves.toEqual({})
  })
})

describe('AttendanceScopeService course scope (COURSE_SCOPE_MODE=course)', () => {
  const original = process.env.COURSE_SCOPE_MODE
  const range = { startDate: '2026-11-01', endDate: '2026-11-01' }
  const courseHead: RequestUser = {
    id: 'head-c',
    role: 'teacher',
    department: 'Unspecified',
    isDepartmentHead: true,
    managedCourses: ['BSIT'],
  }
  const programsHead: RequestUser = { id: 'head-all', role: 'teacher', isDepartmentHead: true, managesAllCourses: true }
  const emptyHead: RequestUser = { id: 'head-none', role: 'teacher', department: 'CCIS', isDepartmentHead: true }
  const bsitSections = { OR: [{ course: { equals: 'BSIT', mode: 'insensitive' } }] }
  let service: AttendanceScopeService

  beforeEach(() => {
    process.env.COURSE_SCOPE_MODE = 'course'
    service = new AttendanceScopeService({} as never)
  })

  afterEach(() => {
    if (original === undefined) delete process.env.COURSE_SCOPE_MODE
    else process.env.COURSE_SCOPE_MODE = original
  })

  it('scopes a course head by section.course, not by the teacher department', async () => {
    await expect(service.sessionScope(courseHead)).resolves.toEqual({ section: bsitSections })
    await expect(service.recordScope(courseHead)).resolves.toEqual({ session: { section: bsitSections } })
  })

  it('gives a Head of Academic Programs every course without a predicate', async () => {
    await expect(service.sessionScope(programsHead)).resolves.toEqual({ section: {} })
    await expect(service.recordScope(programsHead)).resolves.toEqual({ session: { section: {} } })
  })

  it('treats a head with no courses as a plain teacher (fail-closed), whatever their department', async () => {
    await expect(service.sessionScope(emptyHead)).resolves.toEqual({ teacherId: 'head-none' })
    await expect(service.recordScope(emptyHead)).resolves.toEqual({ session: { teacherId: 'head-none' } })
  })

  it('never lets a course head widen their scope with the course or department query', async () => {
    const where = await service.filteredSessionScope(courseHead, { course: 'BSHM', department: 'CAF' }, range)
    const clauses = where.AND as unknown[]
    // The pinned scope is always present; the requested course only narrows further.
    expect(clauses).toContainEqual({ section: bsitSections })
    expect(clauses).toContainEqual({ section: { course: { equals: 'BSHM', mode: 'insensitive' } } })
    expect(JSON.stringify(clauses)).not.toContain('CAF')
  })

  it('lets an all-courses head filter to any single course', async () => {
    const where = await service.filteredSessionScope(programsHead, { course: 'BSHM' }, range)
    expect(where.AND as unknown[]).toContainEqual({ section: { course: { equals: 'BSHM', mode: 'insensitive' } } })
  })

  it('lets a course head filter by another teacher inside their courses', async () => {
    const where = await service.filteredSessionScope(courseHead, { teacherId: 'teacher-2' }, range)
    expect(where.AND as unknown[]).toContainEqual({ teacherId: 'teacher-2' })
  })

  it('still blocks plain teachers and empty-scope heads from reporting on another teacher', async () => {
    await expect(service.filteredSessionScope(emptyHead, { teacherId: 'teacher-2' }, range)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('does not change institution super admin scope in course mode', async () => {
    const admin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
    await expect(service.sessionScope(admin)).resolves.toEqual({})
  })

  it('applies the optional course filter for super admins too', async () => {
    const admin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
    const where = await service.filteredSessionScope(admin, { course: 'BSIT' }, range)
    expect(where.AND as unknown[]).toContainEqual({ section: { course: { equals: 'BSIT', mode: 'insensitive' } } })
  })
})
