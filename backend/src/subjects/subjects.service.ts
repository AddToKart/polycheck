import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateSubjectDto } from './dto/create-subject.dto'
import type { UpdateSubjectDto } from './dto/update-subject.dto'
import type { RequestUser } from '../auth/strategies/jwt.strategy'

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: RequestUser) {
    return this.prisma.subject.findMany({
      where: this.subjectScope(user),
      orderBy: { code: 'asc' },
    })
  }

  async findOne(id: string, user: RequestUser) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, ...this.subjectScope(user) },
      include: {
        sections: {
          where:
            user.role === 'teacher'
              ? { teacherId: user.id }
              : user.role === 'student'
                ? { enrollments: { some: { studentId: user.id } } }
                : undefined,
          include: {
            teacher: { select: { id: true, fullName: true, email: true } },
            _count: { select: { enrollments: true } },
          },
          orderBy: { section: 'asc' },
        },
      },
    })
    if (!subject) throw new NotFoundException('Subject not found')
    if (user.role === 'student') {
      return {
        ...subject,
        sections: subject.sections.map(
          ({ enrollmentCode: _code, enrollmentCodeExpiry: _expiry, ...section }) => section,
        ),
      }
    }
    return subject
  }

  async create(dto: CreateSubjectDto, user: RequestUser) {
    if (user.role !== 'teacher') throw new ForbiddenException('Only teachers can create subjects')
    return this.prisma.subject.create({ data: { ...dto, createdById: user.id } })
  }

  async update(id: string, dto: UpdateSubjectDto, user: RequestUser) {
    const subject = await this.prisma.subject.findUnique({ where: { id }, select: { createdById: true } })
    if (!subject) throw new NotFoundException('Subject not found')
    if (user.role !== 'teacher' || subject.createdById !== user.id) {
      throw new ForbiddenException('You can only update subjects you created')
    }
    return this.prisma.subject.update({ where: { id }, data: dto })
  }

  async remove(id: string, user: RequestUser) {
    const subject = await this.prisma.subject.findUnique({ where: { id }, select: { createdById: true } })
    if (!subject) throw new NotFoundException('Subject not found')
    if (user.role !== 'teacher' || subject.createdById !== user.id) {
      throw new ForbiddenException('You can only delete subjects you created')
    }
    await this.prisma.subject.delete({ where: { id } })
    return { message: 'Subject deleted' }
  }

  private subjectScope(user: RequestUser) {
    if (user.role === 'super_admin') {
      if (user.scope === 'institution') return undefined
      return user.department
        ? {
            OR: [
              { createdBy: { department: user.department } },
              { sections: { some: { teacher: { department: user.department } } } },
            ],
          }
        : { id: { in: [] as string[] } }
    }
    if (user.role === 'teacher') {
      return {
        OR: [{ createdById: user.id }, { sections: { some: { teacherId: user.id } } }],
      }
    }
    return { sections: { some: { enrollments: { some: { studentId: user.id } } } } }
  }
}
