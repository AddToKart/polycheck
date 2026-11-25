import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { isRegistrar } from '../common/designations/department-pin'
import { PrismaService } from '../prisma/prisma.service'
import type { ImportProfileMode, UpsertImportProfileDto } from './dto/import-profile.dto'

/** The only fields a mapping may name (mirrors `ImportColumnMapping` in shared). */
export const MAPPING_FIELDS = ['studentId', 'fullName', 'email', 'program', 'yearLevel', 'department'] as const
const MAX_COLUMN_INDEX = 200
/** Hard ceiling so a shared table can never grow without bound. */
export const MAX_IMPORT_PROFILES = 500

export type StoredMapping = Partial<Record<(typeof MAPPING_FIELDS)[number], number>>

/**
 * Shared column-mapping profiles. Contains header names and column positions only — never student data —
 * so sharing across administrators needs no extra privacy review. Who may read or write follows who may
 * run that import: account admins (super admins, registrars) for student imports, section teachers for roster
 * imports.
 */
@Injectable()
export class ImportProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertMayUse(user: RequestUser, mode: ImportProfileMode): void {
    const allowed =
      user.role === 'super_admin' ||
      (mode === 'students' && isRegistrar(user)) ||
      (mode === 'enrollments' && user.role === 'teacher')
    if (!allowed) throw new ForbiddenException('You cannot use import mapping profiles for this import')
  }

  /** Reject anything but known fields mapped to small non-negative integers. */
  static sanitizeMapping(raw: Record<string, unknown>): StoredMapping {
    const clean: StoredMapping = {}
    for (const [key, value] of Object.entries(raw)) {
      if (!(MAPPING_FIELDS as readonly string[]).includes(key)) {
        throw new BadRequestException(`Unknown mapping field: ${key}`)
      }
      if (value === undefined || value === null) continue
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_COLUMN_INDEX) {
        throw new BadRequestException(`Invalid column index for ${key}`)
      }
      clean[key as keyof StoredMapping] = value
    }
    if (clean.studentId === undefined) throw new BadRequestException('A mapping must include the student number column')
    return clean
  }

  async find(
    user: RequestUser,
    mode: ImportProfileMode,
    fingerprint: string,
  ): Promise<{ mapping: StoredMapping | null }> {
    this.assertMayUse(user, mode)
    const profile = await this.prisma.importMappingProfile.findUnique({
      where: { mode_fingerprint: { mode, fingerprint } },
      select: { mapping: true },
    })
    return { mapping: (profile?.mapping as StoredMapping | undefined) ?? null }
  }

  async save(user: RequestUser, dto: UpsertImportProfileDto): Promise<{ saved: true }> {
    this.assertMayUse(user, dto.mode)
    const mapping = ImportProfilesService.sanitizeMapping(dto.mapping)
    const headers = dto.headers.map((header) => header.trim()).slice(0, 100)
    await this.prisma.importMappingProfile.upsert({
      where: { mode_fingerprint: { mode: dto.mode, fingerprint: dto.fingerprint } },
      create: { mode: dto.mode, fingerprint: dto.fingerprint, headers, mapping, createdById: user.id },
      update: { headers, mapping, uses: { increment: 1 } },
    })
    await this.enforceCeiling()
    return { saved: true }
  }

  /** Drop the least recently updated profiles beyond the ceiling. */
  private async enforceCeiling(): Promise<void> {
    const total = await this.prisma.importMappingProfile.count()
    if (total <= MAX_IMPORT_PROFILES) return
    const surplus = await this.prisma.importMappingProfile.findMany({
      orderBy: { updatedAt: 'asc' },
      take: total - MAX_IMPORT_PROFILES,
      select: { id: true },
    })
    await this.prisma.importMappingProfile.deleteMany({ where: { id: { in: surplus.map((profile) => profile.id) } } })
  }
}
