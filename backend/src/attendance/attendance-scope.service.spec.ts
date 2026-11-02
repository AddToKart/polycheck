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
