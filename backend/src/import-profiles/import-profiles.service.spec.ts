import { BadRequestException, ForbiddenException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { ImportProfilesService, MAX_IMPORT_PROFILES } from './import-profiles.service'

const superAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const registrar: RequestUser = { id: 'reg-1', role: 'teacher', isUserRegistrar: true, managesAllCourses: true }
const teacher: RequestUser = { id: 't-1', role: 'teacher' }
const student: RequestUser = { id: 's-1', role: 'student' }

function build(options: { stored?: unknown; total?: number } = {}) {
  const prisma = {
    importMappingProfile: {
      findUnique: jest.fn().mockResolvedValue(options.stored ?? null),
      upsert: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(options.total ?? 1),
      findMany: jest.fn().mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  }
  return { service: new ImportProfilesService(prisma as never), prisma }
}

const dto = (overrides: Record<string, unknown> = {}) =>
  ({
    mode: 'students',
    fingerprint: 'student no|name|program',
    headers: ['Student No.', 'Name', 'Program'],
    mapping: { studentId: 0, fullName: 1, program: 2 },
    ...overrides,
  }) as never

describe('ImportProfilesService.sanitizeMapping', () => {
  it('keeps known fields mapped to small non-negative integers', () => {
    expect(
      ImportProfilesService.sanitizeMapping({ studentId: 0, fullName: 3, email: null, program: undefined }),
    ).toEqual({
      studentId: 0,
      fullName: 3,
    })
  })

  it.each([
    ['an unknown field', { studentId: 0, password: 1 }],
    ['a string index', { studentId: '0' }],
    ['a fractional index', { studentId: 1.5 }],
    ['a negative index', { studentId: -1 }],
    ['an absurd index', { studentId: 5_000 }],
    ['no student number column', { fullName: 1 }],
    ['a prototype key', JSON.parse('{"studentId":0,"__proto__":{"x":1}}') as Record<string, unknown>],
  ])('rejects %s', (_label, mapping) => {
    expect(() => ImportProfilesService.sanitizeMapping(mapping as Record<string, unknown>)).toThrow(BadRequestException)
  })
})

describe('ImportProfilesService access', () => {
  it('lets each role use only the imports it can run', async () => {
    for (const [user, mode, allowed] of [
      [superAdmin, 'students', true],
      [superAdmin, 'enrollments', true],
      [registrar, 'students', true],
      [registrar, 'enrollments', true], // a registrar is also a teacher who may own sections
      [teacher, 'enrollments', true],
      [teacher, 'students', false],
      [student, 'students', false],
      [student, 'enrollments', false],
    ] as const) {
      const { service } = build()
      const result = service.find(user, mode, 'x')
      if (allowed) await expect(result).resolves.toEqual({ mapping: null })
      else await expect(result).rejects.toBeInstanceOf(ForbiddenException)
    }
  })

  it('applies the same rule to writes and writes nothing when refused', async () => {
    const { service, prisma } = build()
    await expect(service.save(teacher, dto())).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.importMappingProfile.upsert).not.toHaveBeenCalled()
  })
})

describe('ImportProfilesService storage', () => {
  it('returns the shared mapping for a known layout', async () => {
    const { service, prisma } = build({ stored: { mapping: { studentId: 0, fullName: 1 } } })
    await expect(service.find(superAdmin, 'students', 'fp')).resolves.toEqual({
      mapping: { studentId: 0, fullName: 1 },
    })
    expect(prisma.importMappingProfile.findUnique).toHaveBeenCalledWith({
      where: { mode_fingerprint: { mode: 'students', fingerprint: 'fp' } },
      select: { mapping: true },
    })
  })

  it('upserts a sanitized profile, counting reuse and recording who first made it', async () => {
    const { service, prisma } = build()
    await expect(service.save(registrar, dto())).resolves.toEqual({ saved: true })
    expect(prisma.importMappingProfile.upsert).toHaveBeenCalledWith({
      where: { mode_fingerprint: { mode: 'students', fingerprint: 'student no|name|program' } },
      create: {
        mode: 'students',
        fingerprint: 'student no|name|program',
        headers: ['Student No.', 'Name', 'Program'],
        mapping: { studentId: 0, fullName: 1, program: 2 },
        createdById: 'reg-1',
      },
      update: {
        headers: ['Student No.', 'Name', 'Program'],
        mapping: { studentId: 0, fullName: 1, program: 2 },
        uses: { increment: 1 },
      },
    })
  })

  it('rejects an invalid mapping before writing', async () => {
    const { service, prisma } = build()
    await expect(service.save(superAdmin, dto({ mapping: { role: 0 } }))).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.importMappingProfile.upsert).not.toHaveBeenCalled()
  })

  it('prunes the oldest profiles beyond the ceiling and nothing below it', async () => {
    const over = build({ total: MAX_IMPORT_PROFILES + 2 })
    await over.service.save(superAdmin, dto())
    expect(over.prisma.importMappingProfile.findMany).toHaveBeenCalledWith({
      orderBy: { updatedAt: 'asc' },
      take: 2,
      select: { id: true },
    })
    expect(over.prisma.importMappingProfile.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['old-1', 'old-2'] } },
    })

    const under = build({ total: MAX_IMPORT_PROFILES })
    await under.service.save(superAdmin, dto())
    expect(under.prisma.importMappingProfile.deleteMany).not.toHaveBeenCalled()
  })
})
