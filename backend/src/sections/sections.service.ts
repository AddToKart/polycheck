import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RequestUser } from '../auth/strategies/jwt.strategy'
import type { CreateSectionDto } from './dto/create-section.dto'
import type { UpdateSectionDto } from './dto/update-section.dto'
import { DayOfWeek, type Prisma } from '@prisma/client'
import { randomInt } from 'crypto'

const sectionInclude = {
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, fullName: true, department: true } },
  schedule: true,
} as const

type SectionWithIncludes = Prisma.SectionGetPayload<{ include: typeof sectionInclude }>

@Injectable()
export class SectionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: RequestUser, subjectId?: string) {
    if (user.role === 'super_admin') {
      const sections = await this.prisma.section.findMany({
        where: {
          ...(subjectId ? { subjectId } : {}),
          ...this.superAdminSectionScope(user),
        },
        include: sectionInclude,
        orderBy: [{ semester: 'desc' }, { section: 'asc' }],
      })
      return sections.map((section) => this.presentSection(section, false))
    }

    if (user.role === 'teacher') {
      const sections = await this.prisma.section.findMany({
        where: { teacherId: user.id, ...(subjectId ? { subjectId } : {}) },
        include: sectionInclude,
        orderBy: [{ semester: 'desc' }, { section: 'asc' }],
      })
      return sections.map((section) => this.presentSection(section))
    }

    // student — enrolled sections only
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: user.id },
      select: { sectionId: true },
    })
    const sectionIds = enrollments.map((e) => e.sectionId)

    const sections = await this.prisma.section.findMany({
      where: { id: { in: sectionIds }, ...(subjectId ? { subjectId } : {}) },
      include: sectionInclude,
      orderBy: [{ semester: 'desc' }, { section: 'asc' }],
    })
    return sections.map((section) => this.presentSection(section, false))
  }

  async findOne(id: string, user: RequestUser) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: sectionInclude,
    })
    if (!section) throw new NotFoundException('Section not found')

    if (user.role === 'teacher' && section.teacherId !== user.id) {
      throw new ForbiddenException('You can only view your own sections')
    }
    if (
      user.role === 'super_admin' &&
      user.scope !== 'institution' &&
      (!user.department || section.teacher.department !== user.department)
    ) {
      throw new ForbiddenException('This section is outside your administrative scope')
    }

    // Students can only view sections they're enrolled in
    if (user.role === 'student') {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { studentId_sectionId: { studentId: user.id, sectionId: id } },
      })
      if (!enrollment) throw new ForbiddenException('You are not enrolled in this section')
    }

    return this.presentSection(section, user.role === 'teacher')
  }

  async create(dto: CreateSectionDto, user: RequestUser) {
    if (user.role !== 'teacher') throw new ForbiddenException('Only teachers can create sections')
    // Verify subject exists
    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } })
    if (!subject) throw new BadRequestException('Subject not found')

    const { schedule, subjectId, section, room, semester } = dto
    this.assertScheduleRanges(schedule)

    const created = await this.prisma.section.create({
      data: {
        subjectId,
        section,
        room,
        semester,
        teacherId: user.id,
        enrollmentCode: this.generateEnrollmentCode(),
        enrollmentCodeExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        schedule: {
          create: schedule.map((s) => ({
            day: s.day as DayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room,
          })),
        },
      },
      include: sectionInclude,
    })
    return this.presentSection(created)
  }

  async update(id: string, dto: UpdateSectionDto, user: RequestUser) {
    const section = await this.findOne(id, user)

    if (user.role !== 'teacher' || section.teacherId !== user.id) {
      throw new ForbiddenException('You can only update your own sections')
    }

    const { schedule, ...sectionData } = dto
    if (schedule) this.assertScheduleRanges(schedule)

    const updated = await this.prisma.$transaction(async (tx) => {
      if (schedule) {
        await tx.scheduleDay.deleteMany({ where: { sectionId: id } })
        await tx.scheduleDay.createMany({
          data: schedule.map((s) => ({
            sectionId: id,
            day: s.day as DayOfWeek,
            startTime: s.startTime!,
            endTime: s.endTime!,
            room: s.room,
          })),
        })
      }
      return tx.section.update({ where: { id }, data: sectionData, include: sectionInclude })
    })
    return this.presentSection(updated)
  }

  async remove(id: string, user: RequestUser) {
    const section = await this.findOne(id, user)

    if (user.role !== 'teacher' || section.teacherId !== user.id) {
      throw new ForbiddenException('You can only delete your own sections')
    }

    // Guard against deleting sections that have active session history
    const sessionCount = await this.prisma.session.count({ where: { sectionId: id } })
    if (sessionCount > 0) {
      throw new BadRequestException('Cannot delete a section with existing session history')
    }

    // Clean up all related tables in a transaction
    await this.prisma.$transaction([
      this.prisma.scheduleDay.deleteMany({ where: { sectionId: id } }),
      this.prisma.enrollment.deleteMany({ where: { sectionId: id } }),
      this.prisma.sectionRole.deleteMany({ where: { sectionId: id } }),
      this.prisma.sessionPermission.deleteMany({ where: { sectionId: id } }),
      this.prisma.proofOfClass.deleteMany({ where: { sectionId: id } }),
      this.prisma.section.delete({ where: { id } }),
    ])

    return { message: 'Section deleted' }
  }

  async getStudents(sectionId: string, user: RequestUser) {
    const section = await this.findOne(sectionId, user)

    if (user.role === 'teacher' && section.teacherId !== user.id) {
      throw new ForbiddenException('You can only view students in your own sections')
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
            email: true,
            program: true,
            yearLevel: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { student: { fullName: 'asc' } },
    })

    // Single grouped query for attendance counts (eliminates N+1)
    const attendanceCounts = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: { sectionId },
      _count: { status: true },
    })

    const attendanceMap = new Map<string, { present: number; late: number; absent: number; disputed: number }>()
    for (const count of attendanceCounts) {
      const entry = attendanceMap.get(count.studentId) ?? { present: 0, late: 0, absent: 0, disputed: 0 }
      if (count.status === 'present') entry.present += count._count.status
      else if (count.status === 'late') entry.late += count._count.status
      else if (count.status === 'absent') entry.absent += count._count.status
      else if (count.status === 'disputed') entry.disputed += count._count.status
      attendanceMap.set(count.studentId, entry)
    }

    const result = enrollments.map((enrollment) => ({
      ...enrollment.student,
      attendance: attendanceMap.get(enrollment.studentId) ?? { present: 0, late: 0, absent: 0, disputed: 0 },
    }))

    return result
  }

  async enrollViaCode(sectionId: string, studentId: string, enrollmentCode: string) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')

    if (!section.enrollmentCode || section.enrollmentCode !== enrollmentCode.trim().toUpperCase()) {
      throw new BadRequestException('Invalid enrollment code')
    }

    if (section.enrollmentCodeExpiry && section.enrollmentCodeExpiry < new Date()) {
      throw new BadRequestException('Enrollment code has expired')
    }

    // Check if already enrolled
    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId, sectionId } },
    })
    if (existing) throw new ConflictException('Already enrolled in this section')

    return this.createEnrollment(studentId, sectionId)
  }

  async enrollByCode(studentId: string, enrollmentCode: string) {
    const normalizedCode = enrollmentCode.trim().toUpperCase()
    const section = await this.prisma.section.findUnique({ where: { enrollmentCode: normalizedCode } })
    if (!section || !section.enrollmentCode) throw new BadRequestException('Invalid enrollment code')
    if (section.enrollmentCodeExpiry && section.enrollmentCodeExpiry < new Date()) {
      throw new BadRequestException('Enrollment code has expired')
    }
    return this.createEnrollment(studentId, section.id)
  }

  async enrollStudent(sectionId: string, teacherId: string, studentId: string, _studentName?: string) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')

    if (section.teacherId !== teacherId) {
      throw new ForbiddenException('You can only enroll students in your own sections')
    }

    const student = await this.prisma.user.findUnique({ where: { id: studentId } })
    if (!student || student.role !== 'student') {
      throw new BadRequestException('Invalid student')
    }

    return this.createEnrollment(studentId, sectionId)
  }

  async removeStudent(sectionId: string, teacherId: string, studentId: string) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')

    if (section.teacherId !== teacherId) {
      throw new ForbiddenException('You can only remove students from your own sections')
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId, sectionId } },
    })
    if (!enrollment) throw new NotFoundException('Student is not enrolled in this section')

    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.delete({ where: { studentId_sectionId: { studentId, sectionId } } })
      const studentCount = await tx.enrollment.count({ where: { sectionId } })
      await tx.section.update({ where: { id: sectionId }, data: { studentCount } })
    })

    return { message: 'Student removed from section' }
  }

  async resetEnrollmentCode(sectionId: string, teacherId: string) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')
    if (section.teacherId !== teacherId) throw new ForbiddenException()

    const newCode = this.generateEnrollmentCode()
    await this.prisma.section.update({
      where: { id: sectionId },
      data: {
        enrollmentCode: newCode,
        enrollmentCodeExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    })

    return { enrollmentCode: newCode }
  }

  async disableEnrollmentCode(sectionId: string, teacherId: string) {
    const section = await this.prisma.section.findUnique({ where: { id: sectionId } })
    if (!section) throw new NotFoundException('Section not found')
    if (section.teacherId !== teacherId) throw new ForbiddenException()

    await this.prisma.section.update({
      where: { id: sectionId },
      data: { enrollmentCode: null, enrollmentCodeExpiry: null },
    })

    return { message: 'Enrollment code disabled' }
  }

  async getEnrollments(sectionId: string, user: RequestUser) {
    const section = await this.findOne(sectionId, user)
    if (user.role === 'teacher' && section.teacherId !== user.id) {
      throw new ForbiddenException()
    }

    return this.prisma.enrollment.findMany({
      where: { sectionId },
      include: {
        student: {
          select: { id: true, studentId: true, fullName: true, program: true, yearLevel: true },
        },
      },
      orderBy: { enrolledAt: 'asc' },
    })
  }

  async findEnrollments(user: RequestUser) {
    let where: Prisma.EnrollmentWhereInput

    if (user.role === 'student') {
      where = { studentId: user.id }
    } else if (user.role === 'teacher') {
      where = { section: { teacherId: user.id } }
    } else if (user.scope === 'institution') {
      where = {}
    } else {
      where = user.department
        ? { section: { teacher: { department: user.department } } }
        : { id: { in: [] } }
    }

    return this.prisma.enrollment.findMany({
      where,
      orderBy: { enrolledAt: 'asc' },
    })
  }

  private generateEnrollmentCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 7; i++) {
      code += chars[randomInt(chars.length)]
    }
    return code
  }

  private async createEnrollment(studentId: string, sectionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.enrollment.findUnique({
        where: { studentId_sectionId: { studentId, sectionId } },
      })
      if (existing) throw new ConflictException('Already enrolled in this section')

      const enrollment = await tx.enrollment.create({ data: { studentId, sectionId } })
      const studentCount = await tx.enrollment.count({ where: { sectionId } })
      await tx.section.update({ where: { id: sectionId }, data: { studentCount } })
      return enrollment
    })
  }

  private presentSection(section: SectionWithIncludes, includeEnrollmentCode = true) {
    return {
      id: section.id,
      subjectId: section.subjectId,
      section: section.section,
      room: section.room,
      schedule: section.schedule,
      semester: section.semester,
      teacherId: section.teacherId,
      teacherName: section.teacher.fullName,
      ...(includeEnrollmentCode
        ? {
            enrollmentCode: section.enrollmentCode ?? undefined,
            enrollmentCodeExpiry: section.enrollmentCodeExpiry ?? undefined,
          }
        : {}),
      studentCount: section.studentCount,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    }
  }

  private superAdminSectionScope(user: RequestUser) {
    if (user.scope === 'institution') return {}
    return user.department ? { teacher: { department: user.department } } : { id: { in: [] as string[] } }
  }

  private assertScheduleRanges(schedule: Array<{ startTime?: string; endTime?: string }>) {
    if (schedule.some((item) => !item.startTime || !item.endTime || item.endTime <= item.startTime)) {
      throw new BadRequestException('Every schedule endTime must be after startTime')
    }
  }
}
