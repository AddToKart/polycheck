import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const INTEGER_SETTING_RANGES = {
  default_geofence_radius_meters: { min: 10, max: 500 },
  default_qr_validity_minutes: { min: 1, max: 15 },
  default_grace_period_minutes: { min: 0, max: 60 },
  enrollment_code_expiry_days: { min: 1, max: 90 },
} as const

export const INSTITUTION_SETTING_KEYS = [
  'institution_name',
  ...Object.keys(INTEGER_SETTING_RANGES),
] as const

export type InstitutionSettingKey = (typeof INSTITUTION_SETTING_KEYS)[number]

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.institutionSetting.findMany({ orderBy: { key: 'asc' } })
  }

  async set(key: string, value: string, updatedBy: string) {
    const normalized = this.validate(key, value)
    return this.prisma.institutionSetting.upsert({
      where: { key },
      create: { key, value: normalized, updatedBy },
      update: { value: normalized, updatedBy },
    })
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
    const range = INTEGER_SETTING_RANGES[key as keyof typeof INTEGER_SETTING_RANGES]
    if (!/^\d+$/.test(trimmed)) throw new BadRequestException(`${key} must be a whole number`)
    const numeric = Number(trimmed)
    if (numeric < range.min || numeric > range.max) {
      throw new BadRequestException(`${key} must be between ${range.min} and ${range.max}`)
    }
    return String(numeric)
  }
}
