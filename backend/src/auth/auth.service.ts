import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { compareSync } from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import type { User } from '@prisma/client'

const DUMMY_HASH = '$2a$10$R9h/lIPzMRgGq1V468UTuOr.164R5.h2.4yXG5Wv4Jz/aGv1Vv8a.'

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
    scope?: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
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
    const isValidPassword = user ? compareSync(password, user.password) : compareSync(password, DUMMY_HASH)

    if (!user || !isValidPassword) {
      throw new UnauthorizedException('Invalid student ID or password')
    }

    if (user.role !== 'student') {
      throw new ForbiddenException('Account is not a student')
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled')
    }

    return this.generateAuthResult(await this.beginSession(user.id))
  }

  async loginFaculty(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    const isValidPassword = user ? compareSync(password, user.password) : compareSync(password, DUMMY_HASH)

    if (!user || !isValidPassword) {
      throw new UnauthorizedException('Invalid email or password')
    }

    if (user.role === 'student') {
      throw new ForbiddenException('Use student login instead')
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled')
    }

    return this.generateAuthResult(await this.beginSession(user.id))
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')
    return this.sanitizeUser(user)
  }

  async provisionKey(userId: string, publicKey: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User not found')

    await this.prisma.user.update({
      where: { id: userId },
      data: { teacherPublicKey: publicKey },
    })

    return { message: 'Public key provisioned successfully' }
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 } } })
    return { message: 'Logged out successfully' }
  }

  private generateAuthResult(user: User): AuthResult {
    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      studentId: user.studentId,
      sessionVersion: user.authVersion,
    }

    const token = this.jwt.sign(payload)

    return { token, user: this.sanitizeUser(user) }
  }

  private beginSession(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 } } })
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
      scope: user.scope,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
