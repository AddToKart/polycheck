import { Injectable, NotFoundException } from '@nestjs/common'
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

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            teacher: { select: { id: true, fullName: true, email: true } },
            _count: { select: { enrollments: true } },
          },
          orderBy: { section: 'asc' },
        },
      },
    })
    if (!subject) throw new NotFoundException('Subject not found')
    return subject
  }

  async create(dto: CreateSubjectDto, teacherId: string) {
    return this.prisma.subject.create({ data: { ...dto, createdById: teacherId } })
  }

  async update(id: string, dto: UpdateSubjectDto) {
    await this.findOne(id)
    return this.prisma.subject.update({ where: { id }, data: dto })
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.prisma.subject.delete({ where: { id } })
    return { message: 'Subject deleted' }
  }

  private subjectScope(user: RequestUser) {
    if (user.role === 'super_admin') return undefined
    if (user.role === 'teacher') {
      return {
        OR: [{ createdById: user.id }, { sections: { some: { teacherId: user.id } } }],
      }
    }
    return { sections: { some: { enrollments: { some: { studentId: user.id } } } } }
  }
}
