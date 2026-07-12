import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { compareSync, hashSync } from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import type { User } from '@prisma/client'

export interface AuthResult {
  token: string
  user: {
    id: string
    fullName: string
    email?: string | null
    studentId?: string | null
    role: string
    program?: string | null
    yearLevel?: number | null
    department?: string | null
    photoUrl?: string | null
  }
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async loginStudent(studentId: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { studentId } })
    if (!user) throw new NotFoundException('Student not found')
    if (user.role !== 'student') throw new ForbiddenException('Account is not a student')
    if (!user.isActive) throw new ForbiddenException('Account is disabled')
    if (!compareSync(password, user.password)) throw new UnauthorizedException('Invalid password')

    return this.generateAuthResult(user)
  }

  async loginFaculty(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) throw new NotFoundException('Account not found')
    if (user.role === 'student') throw new ForbiddenException('Use student login instead')
    if (!user.isActive) throw new ForbiddenException('Account is disabled')
    if (!compareSync(password, user.password)) throw new UnauthorizedException('Invalid password')

    return this.generateAuthResult(user)
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    return this.sanitizeUser(user)
  }

  async provisionKey(userId: string, publicKey: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    if (user.role !== 'teacher') throw new ForbiddenException('Only teachers can provision keys')

    await this.prisma.user.update({
      where: { id: userId },
      data: { teacherPublicKey: publicKey },
    })

    return { message: 'Public key provisioned successfully' }
  }

  private generateAuthResult(user: User): AuthResult {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      studentId: user.studentId,
    }

    const token = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
    })

    return { token, user: this.sanitizeUser(user) }
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      studentId: user.studentId,
      role: user.role,
      program: user.program,
      yearLevel: user.yearLevel,
      department: user.department,
      photoUrl: user.photoUrl,
    }
  }
}
