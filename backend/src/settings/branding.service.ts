import { BadRequestException, Injectable } from '@nestjs/common'
import {
  BRANDING_LOGO_MAX_BYTES,
  INSTITUTION_CAMPUS_KEY,
  INSTITUTION_LOGO_KEY,
  INSTITUTION_NAME_KEY,
  INSTITUTION_SHORT_NAME_KEY,
  resolveBranding,
  type InstitutionBranding,
} from '@polycheck/shared'
import { decodeImageDataUrl } from '../proofs/image-evidence'
import { PrismaService } from '../prisma/prisma.service'

const BRANDING_KEYS = [INSTITUTION_NAME_KEY, INSTITUTION_SHORT_NAME_KEY, INSTITUTION_CAMPUS_KEY, INSTITUTION_LOGO_KEY]
/** Branding is read on every login screen load; a few seconds of staleness is invisible and saves a query. */
const MEMO_MS = 10_000

/**
 * Institution identity (name, short name, campus, logo). Text fields are ordinary institution settings; the
 * logo lives under its own key so the (potentially large) image never rides along in `GET /settings`.
 */
@Injectable()
export class BrandingService {
  private memo: { at: number; value: InstitutionBranding } | null = null

  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<InstitutionBranding> {
    if (this.memo && Date.now() - this.memo.at < MEMO_MS) return this.memo.value
    const rows = await this.prisma.institutionSetting.findMany({
      where: { key: { in: BRANDING_KEYS } },
      select: { key: true, value: true },
    })
    const byKey = new Map(rows.map((row) => [row.key, row.value]))
    const value = resolveBranding({
      name: byKey.get(INSTITUTION_NAME_KEY),
      shortName: byKey.get(INSTITUTION_SHORT_NAME_KEY),
      campus: byKey.get(INSTITUTION_CAMPUS_KEY),
      logoDataUrl: byKey.get(INSTITUTION_LOGO_KEY) || null,
    })
    this.memo = { at: Date.now(), value }
    return value
  }

  /** Drops the memo so the next read (and the settings page) sees a change immediately. */
  invalidate() {
    this.memo = null
  }

  async setLogo(dataUrl: string, updatedBy: string): Promise<InstitutionBranding> {
    // Validates the type, size and magic bytes; throws 400 otherwise.
    decodeImageDataUrl(dataUrl, BRANDING_LOGO_MAX_BYTES, 'Logo')
    await this.prisma.institutionSetting.upsert({
      where: { key: INSTITUTION_LOGO_KEY },
      create: { key: INSTITUTION_LOGO_KEY, value: dataUrl, updatedBy },
      update: { value: dataUrl, updatedBy },
    })
    this.invalidate()
    return this.current()
  }

  async clearLogo(): Promise<InstitutionBranding> {
    await this.prisma.institutionSetting.deleteMany({ where: { key: INSTITUTION_LOGO_KEY } })
    this.invalidate()
    return this.current()
  }

  static assertLogoBody(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) throw new BadRequestException('A logo image is required')
    return value
  }
}
