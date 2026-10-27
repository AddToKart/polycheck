import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { isSealedSecret, openSecret, sealSecret } from '../common/utils/secret-box'
import { PrismaService } from '../prisma/prisma.service'

const INTEGER_SETTING_RANGES = {
  default_geofence_radius_meters: { min: 10, max: 500 },
  default_qr_validity_minutes: { min: 1, max: 15 },
  default_grace_period_minutes: { min: 0, max: 60 },
  enrollment_code_expiry_days: { min: 1, max: 90 },
  attendance_min_rate_percent: { min: 0, max: 100 },
} as const

const BOOLEAN_SETTING_KEYS = [
  'allow_teacher_student_provisioning',
  'ai_assistant_enabled',
  'ai_assistant_teacher_enabled',
  'ai_assistant_student_enabled',
] as const

const OPTIONAL_STRING_SETTING_KEYS = ['ai_base_url', 'ai_model'] as const

export const AI_API_KEY_SETTING = 'ai_api_key'

export const INSTITUTION_SETTING_KEYS = [
  'institution_name',
  ...BOOLEAN_SETTING_KEYS,
  ...OPTIONAL_STRING_SETTING_KEYS,
  AI_API_KEY_SETTING,
  ...Object.keys(INTEGER_SETTING_RANGES),
] as const

export type InstitutionSettingKey = (typeof INSTITUTION_SETTING_KEYS)[number]
export type BooleanInstitutionSettingKey = (typeof BOOLEAN_SETTING_KEYS)[number]
export type IntegerInstitutionSettingKey = keyof typeof INTEGER_SETTING_RANGES

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  list() {
    return this.prisma.institutionSetting.findMany({
      where: { key: { not: AI_API_KEY_SETTING } },
      orderBy: { key: 'asc' },
    })
  }

  /**
   * Boolean settings are stored as the strings 'true'/'false'. Missing rows
   * resolve to the supplied default (false for opt-in features).
   */
  async getBoolean(key: BooleanInstitutionSettingKey, fallback = false): Promise<boolean> {
    const setting = await this.prisma.institutionSetting.findUnique({ where: { key }, select: { value: true } })
    if (!setting) return fallback
    return setting.value === 'true'
  }

  /**
   * Integer settings are stored as decimal strings. Missing or malformed rows
   * resolve to the supplied fallback so callers keep a safe default.
   */
  async getInteger(key: IntegerInstitutionSettingKey, fallback: number): Promise<number> {
    const setting = await this.prisma.institutionSetting.findUnique({ where: { key }, select: { value: true } })
    if (!setting) return fallback
    const trimmed = setting.value.trim()
    if (!/^-?\d+$/.test(trimmed)) return fallback
    const parsed = Number.parseInt(trimmed, 10)
    return Number.isSafeInteger(parsed) ? parsed : fallback
  }

  /** Decrypted AI API key stored by a super admin, or null when unset. */
  async getAiApiKey(): Promise<string | null> {
    const setting = await this.prisma.institutionSetting.findUnique({
      where: { key: AI_API_KEY_SETTING },
      select: { value: true },
    })
    if (!setting?.value) return null
    if (!isSealedSecret(setting.value)) {
      this.logger.warn('Stored ai_api_key is not sealed; treating it as a legacy plaintext value')
      return setting.value
    }
    const decrypted = openSecret(setting.value, this.encryptionSecret())
    if (decrypted === null) {
      this.logger.warn('Stored ai_api_key could not be decrypted; re-enter it in Institution Settings')
      return null
    }
    return decrypted
  }

  async set(key: string, value: string, updatedBy: string) {
    const normalized = this.validate(key, value)
    if (key === AI_API_KEY_SETTING) {
      if (!normalized) {
        await this.prisma.institutionSetting.deleteMany({ where: { key } })
        return { key, value: '', updatedBy, updatedAt: new Date() }
      }
      const sealed = sealSecret(normalized, this.encryptionSecret())
      const saved = await this.prisma.institutionSetting.upsert({
        where: { key },
        create: { key, value: sealed, updatedBy },
        update: { value: sealed, updatedBy },
      })
      return { ...saved, value: '' }
    }
    return this.prisma.institutionSetting.upsert({
      where: { key },
      create: { key, value: normalized, updatedBy },
      update: { value: normalized, updatedBy },
    })
  }

  private encryptionSecret() {
    const dedicated = this.config.get<string>('AI_KEY_ENCRYPTION_SECRET')?.trim()
    if (dedicated) return dedicated
    const fallback = this.config.get<string>('BETTER_AUTH_SECRET')?.trim()
    if (!fallback) throw new Error('No secret is available to encrypt the AI API key')
    return fallback
  }

  private validate(key: string, value: string) {
    if (!INSTITUTION_SETTING_KEYS.includes(key as InstitutionSettingKey)) {
      throw new BadRequestException('Unknown institution setting')
    }
    const trimmed = value.trim()
    if (key === 'institution_name') {
      if (trimmed.length < 2 || trimmed.length > 150) {
        throw new BadRequestException('Institution name must be 2-150 characters')
      }
      return trimmed
    }
    if (BOOLEAN_SETTING_KEYS.includes(key as BooleanInstitutionSettingKey)) {
      if (trimmed !== 'true' && trimmed !== 'false') {
        throw new BadRequestException(`${key} must be either true or false`)
      }
      return trimmed
    }
    if (key === AI_API_KEY_SETTING) {
      if (trimmed.length === 0) return ''
      if (/\s/.test(trimmed)) throw new BadRequestException('The AI API key must not contain whitespace')
      if (trimmed.length < 8 || trimmed.length > 500) {
        throw new BadRequestException('The AI API key must be 8-500 characters')
      }
      return trimmed
    }
    if (key === 'ai_base_url') {
      if (trimmed.length === 0) return ''
      if (trimmed.length > 500) throw new BadRequestException('ai_base_url must be 500 characters or fewer')
      let url: URL
      try {
        url = new URL(trimmed)
      } catch {
        throw new BadRequestException('ai_base_url must be a valid URL')
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new BadRequestException('ai_base_url must use http or https')
      }
      return trimmed.replace(/\/+$/, '')
    }
    if (key === 'ai_model') {
      if (trimmed.length === 0) return ''
      if (trimmed.length > 100 || /\s/.test(trimmed)) {
        throw new BadRequestException('ai_model must be 100 characters or fewer without spaces')
      }
      return trimmed
    }
    const range = INTEGER_SETTING_RANGES[key as keyof typeof INTEGER_SETTING_RANGES]
    if (!/^\d+$/.test(trimmed)) throw new BadRequestException(`${key} must be a whole number`)
    const numeric = Number(trimmed)
    if (numeric < range.min || numeric > range.max) {
      throw new BadRequestException(`${key} must be between ${range.min} and ${range.max}`)
    }
    return String(numeric)
  }
}
