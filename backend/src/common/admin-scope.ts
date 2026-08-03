import { ForbiddenException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Prisma } from '../prisma/client'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * Single source of truth for super-admin scope rules.
 *
 * - Institution-scoped super admins (`scope === 'institution'`) see everything.
 * - Department-scoped super admins are limited to their own `department`.
 * - A scoped super admin with no department can see nothing.
 * - Non-super-admin callers are unrestricted here; their role rules live in
 *   the calling service (these helpers are only reached from admin branches).
 */

type AdminScope = { kind: 'unrestricted' } | { kind: 'department'; department: string } | { kind: 'none' }

/** Resolves the admin's scope: unrestricted, department-limited, or none. */
export function adminScope(user: RequestUser): AdminScope {
  if (user.role !== 'super_admin' || user.scope === 'institution') return { kind: 'unrestricted' }
  return user.department ? { kind: 'department', department: user.department } : { kind: 'none' }
}

/** Department a scoped super admin is limited to, or null when not department-limited. */
export function adminDepartment(user: RequestUser): string | null {
  const scope = adminScope(user)
  return scope.kind === 'department' ? scope.department : null
}

/** Where fragment scoping Section queries to the admin's scope. */
export function adminSectionWhere(user: RequestUser): Prisma.SectionWhereInput {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return {}
  if (scope.kind === 'department') return { teacher: { department: scope.department } }
  return { id: { in: [] as string[] } }
}

/** Where fragment scoping Session queries to the admin's scope. */
export function adminSessionWhere(user: RequestUser): Prisma.SessionWhereInput {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return {}
  if (scope.kind === 'department') return { section: { teacher: { department: scope.department } } }
  return { id: { in: [] as string[] } }
}

/** Where fragment scoping AttendanceRecord queries to the admin's scope. */
export function adminRecordWhere(user: RequestUser): Prisma.AttendanceRecordWhereInput {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return {}
  if (scope.kind === 'department') {
    return { session: { section: { teacher: { department: scope.department } } } }
  }
  return { id: { in: [] as string[] } }
}

/** Where fragment scoping Enrollment queries to the admin's scope. */
export function adminEnrollmentWhere(user: RequestUser): Prisma.EnrollmentWhereInput {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return {}
  if (scope.kind === 'department') return { section: { teacher: { department: scope.department } } }
  return { id: { in: [] as string[] } }
}

/** Where fragment scoping Subject queries to the admin's scope (undefined = all). */
export function adminSubjectWhere(user: RequestUser): Prisma.SubjectWhereInput | undefined {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return undefined
  if (scope.kind === 'department') {
    return {
      OR: [
        { createdBy: { department: scope.department } },
        { sections: { some: { teacher: { department: scope.department } } } },
      ],
    }
  }
  return { id: { in: [] as string[] } }
}

/** Where fragment scoping User queries to the admin's scope (undefined = all). */
export function adminUserWhere(user: RequestUser): Prisma.UserWhereInput | undefined {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return undefined
  if (scope.kind === 'department') return { department: scope.department }
  return { id: { in: [] as string[] } }
}

/** True when the super admin may access a user in the given department. */
export function adminCanAccessUser(user: RequestUser, targetDepartment: string | null | undefined): boolean {
  if (user.role !== 'super_admin') return false
  const scope = adminScope(user)
  return scope.kind === 'unrestricted' || (scope.kind === 'department' && targetDepartment === scope.department)
}

/** True when the super admin may access a section in the given department. */
export function adminCanAccessSection(user: RequestUser, sectionDepartment: string | null | undefined): boolean {
  const scope = adminScope(user)
  return scope.kind === 'unrestricted' || (scope.kind === 'department' && sectionDepartment === scope.department)
}

/** DB-backed check: is the section within the admin's scope? */
export async function adminSectionInScope(
  user: RequestUser,
  sectionId: string,
  prisma: Pick<PrismaService, 'section'>,
): Promise<boolean> {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return true
  const section = await prisma.section.findFirst({
    where: { id: sectionId, teacher: { department: scope.kind === 'department' ? scope.department : '__no_department__' } },
    select: { id: true },
  })
  return Boolean(section)
}

/** Throws when the section is outside the admin's scope (no-op for non-admins). */
export async function assertSectionInAdminScope(
  user: RequestUser,
  sectionId: string,
  prisma: Pick<PrismaService, 'section'>,
  label = 'This resource',
): Promise<void> {
  if (!(await adminSectionInScope(user, sectionId, prisma))) {
    throw new ForbiddenException(`${label} is outside your administrative scope`)
  }
}

/** Throws when the student is outside the admin's scope (no-op for non-admins). */
export async function assertStudentInAdminScope(
  user: RequestUser,
  studentId: string,
  prisma: Pick<PrismaService, 'enrollment'>,
  sectionId?: string,
): Promise<void> {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return
  const allowed = await prisma.enrollment.findFirst({
    where: {
      studentId,
      ...(sectionId ? { sectionId } : {}),
      section: { teacher: { department: scope.kind === 'department' ? scope.department : '__no_department__' } },
    },
    select: { id: true },
  })
  if (!allowed) throw new ForbiddenException('This student is outside your administrative scope')
}

/**
 * Section IDs a department-scoped admin may manage. Returns `null` when the
 * admin is unrestricted (caller should not filter), `[]` when the admin is
 * scoped without a department (nothing matches).
 */
export async function adminDepartmentSectionIds(
  user: RequestUser,
  prisma: Pick<PrismaService, 'section'>,
): Promise<string[] | null> {
  const scope = adminScope(user)
  if (scope.kind === 'unrestricted') return null
  if (scope.kind === 'none') return []
  return (await prisma.section.findMany({ where: { teacher: { department: scope.department } }, select: { id: true } })).map(
    (section) => section.id,
  )
}
