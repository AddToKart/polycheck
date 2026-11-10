import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  MAINTENANCE_SETTINGS_CHANGED_EVENT,
  MAINTENANCE_SETTING_KEYS,
  clampRetentionDays,
  isMaintenanceSettingKey,
  PRIVACY_DATA_INVENTORY,
  type PrivacyCenterSnapshot,
} from '@polycheck/shared'
import { isSealedSecret, openSecret, sealSecret } from '../common/utils/secret-box'
import {
  GEOLOCATION_RETENTION_DAYS_KEY,
  PRIVACY_SHRED_LAST_RUN_REDIS_KEY,
  PRIVACY_SHRED_LAST_RUN_TTL_SECONDS,
  isShredRecord,
  type PrivacyShredRecord,
} from '../common/constants/privacy'
import { RedisService } from '../infrastructure/redis.service'
import { PrismaService } from '../prisma/prisma.service'

const INTEGER_SETTING_RANGES = {
  default_geofence_radius_meters: { min: 10, max: 500 },
  default_qr_validity_minutes: { min: 1, max: 15 },
  default_grace_period_minutes: { min: 0, max: 60 },
  enrollment_code_expiry_days: { min: 1, max: 90 },
  attendance_min_rate_percent: { min: 0, max: 100 },
  device_cooldown_hours: { min: 1, max: 24 },
  geolocation_retention_days: { min: 7, max: 90 },
} as const

const BOOLEAN_SETTING_KEYS = [
  'allow_teacher_student_provisioning',
  'allow_teacher_password_reset',
  'allow_teacher_emergency_device_unbind',
  'ai_assistant_enabled',
  'ai_assistant_teacher_enabled',
  'ai_assistant_student_enabled',
  'maintenance_mode_enabled',
] as const

const OPTIONAL_STRING_SETTING_KEYS = ['ai_base_url', 'ai_model'] as const

/** Free-text settings (trimmed, may be cleared with an empty value). */
const OPTIONAL_TEXT_SETTING_KEYS = ['maintenance_message'] as const

/** ISO-8601 datetime settings stored as strings; an empty value clears them. */
const OPTIONAL_DATETIME_SETTING_KEYS = ['maintenance_until'] as const

export const AI_API_KEY_SETTING = 'ai_api_key'

export const INSTITUTION_SETTING_KEYS = [
  'institution_name',
  ...BOOLEAN_SETTING_KEYS,
  ...OPTIONAL_STRING_SETTING_KEYS,
  ...OPTIONAL_TEXT_SETTING_KEYS,
  ...OPTIONAL_DATETIME_SETTING_KEYS,
  AI_API_KEY_SETTING,
  ...Object.keys(INTEGER_SETTING_RANGES),
] as const

export type InstitutionSettingKey = (typeof INSTITUTION_SETTING_KEYS)[number]
export type BooleanInstitutionSettingKey = (typeof BOOLEAN_SETTING_KEYS)[number]
export type IntegerInstitutionSettingKey = keyof typeof INTEGER_SETTING_RANGES
export type OptionalTextInstitutionSettingKey = (typeof OPTIONAL_TEXT_SETTING_KEYS)[number]
export type OptionalDatetimeInstitutionSettingKey = (typeof OPTIONAL_DATETIME_SETTING_KEYS)[number]

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name)

  /**
   * Last nightly telemetry shred (F6). Deliberately NOT a settings row:
   * operational telemetry is not configuration, so it lives outside the
   * `INSTITUTION_SETTING_KEYS` whitelist. Redis (`privacy:shred:last`, 48 h
   * TTL) carries the summary across restarts and pods; this static field is
   * the DB-free in-process fallback so a Redis outage still serves the last
   * run this instance performed.
   */
  private static lastShredRun: PrivacyShredRecord | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    // Optional so existing unit tests can construct the service without the
    // globally provided event emitter; production always injects it.
    @Optional() private readonly events?: EventEmitter2,
    @Optional() private readonly redis?: RedisService,
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

  /**
   * Delegated classroom governance policy. Booleans default to enabled so the
   * feature works out of the box; the cooldown is clamped to its documented
   * 1–24 hour range even if a hand-edited row holds an out-of-range value.
   */
  async getTeacherDelegationPolicies() {
    const [teacherPasswordReset, teacherEmergencyUnbind, rawCooldownHours] = await Promise.all([
      this.getBoolean('allow_teacher_password_reset', true),
      this.getBoolean('allow_teacher_emergency_device_unbind', true),
      this.getInteger('device_cooldown_hours', 2),
    ])
    return {
      teacherPasswordReset,
      teacherEmergencyUnbind,
      deviceCooldownHours: Math.min(24, Math.max(1, rawCooldownHours)),
    }
  }

  /**
   * Maintenance-mode snapshot used by the public status endpoint and the
   * maintenance guard's cache refresh. `message` always resolves to the
   * built-in default copy when no custom announcement is configured.
   */
  async getMaintenanceState(): Promise<{ enabled: boolean; message: string; estimatedEnd: string | null }> {
    const rows = await this.prisma.institutionSetting.findMany({
      where: { key: { in: [...MAINTENANCE_SETTING_KEYS] } },
      select: { key: true, value: true },
    })
    const values = new Map(rows.map((row) => [row.key, row.value]))
    const enabled = values.get('maintenance_mode_enabled') === 'true'
    const message = (values.get('maintenance_message') ?? '').trim()
    const rawUntil = (values.get('maintenance_until') ?? '').trim()
    const estimatedEnd = rawUntil && !Number.isNaN(Date.parse(rawUntil)) ? rawUntil : null
    return { enabled, message: message || DEFAULT_MAINTENANCE_MESSAGE, estimatedEnd }
  }

  /** Retention window for ephemeral geolocation telemetry (RA 10173 center). */
  async getGeolocationRetentionDays(): Promise<number> {
    const configured = await this.getInteger(GEOLOCATION_RETENTION_DAYS_KEY, 30)
    return clampRetentionDays(configured)
  }

  /**
   * Called by the nightly shred job in MaintenanceService. Fail-open: the
   * in-memory copy is authoritative for this process and a Redis outage only
   * degrades cross-restart visibility of the last run.
   */
  async recordPrivacyShredRun(summary: PrivacyShredRecord): Promise<void> {
    SettingsService.lastShredRun = isShredRecord(summary) ? summary : null
    try {
      const persisted = await this.redis?.setJson(
        PRIVACY_SHRED_LAST_RUN_REDIS_KEY,
        summary,
        PRIVACY_SHRED_LAST_RUN_TTL_SECONDS,
      )
      if (persisted === false) {
        this.logger.warn('Could not persist the privacy shred summary to Redis; keeping the in-process copy only')
      }
    } catch (error) {
      this.logger.warn(
        `Could not persist the privacy shred summary: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * RA 10173 transparency snapshot (GET /settings/privacy-center). Every
   * number is computed from production data at render time — consent counts
   * straight from the user table, retention clamped 7–90, and the shred
   * summary read through Redis with the in-process fallback.
   */
  async getPrivacyCenterSnapshot(): Promise<PrivacyCenterSnapshot> {
    const version = this.privacyNoticeVersion()
    const [retentionDays, covered, totalActive, storedRun] = await Promise.all([
      this.getGeolocationRetentionDays(),
      this.prisma.user.count({ where: { isActive: true, privacyConsentVersion: version } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.readLastShredRun(),
    ])
    return {
      retentionDays,
      consent: { covered, totalActive, version },
      ephemeral: {
        lastRunAt: storedRun?.lastRunAt ?? null,
        recordsShredded: storedRun?.recordsShredded ?? null,
        attemptsShredded: storedRun?.attemptsShredded ?? null,
      },
      dataInventory: PRIVACY_DATA_INVENTORY,
      breaches: [],
    }
  }

  /** The notice version consent rows are compared against (same source as the consent guard). */
  private privacyNoticeVersion(): string {
    return this.config.getOrThrow<string>('PRIVACY_NOTICE_VERSION')
  }

  /** Read-through last-run lookup: in-memory first, then the 48 h Redis copy. */
  private async readLastShredRun(): Promise<PrivacyShredRecord | null> {
    const memory = SettingsService.lastShredRun
    if (memory) return memory
    try {
      const stored = await this.redis?.getJson<unknown>(PRIVACY_SHRED_LAST_RUN_REDIS_KEY)
      if (stored && isShredRecord(stored)) SettingsService.lastShredRun = stored
      return isShredRecord(stored) ? stored : null
    } catch {
      return null
    }
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

  async set(key: string, value: string, updatedBy: string, actor?: { role: string; ip?: string }) {
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
    const maintenanceKey = isMaintenanceSettingKey(key)
    const previous = maintenanceKey ? await this.readValue(key) : null
    const saved = await this.prisma.institutionSetting.upsert({
      where: { key },
      create: { key, value: normalized, updatedBy },
      update: { value: normalized, updatedBy },
    })
    if (maintenanceKey) {
      this.notifyMaintenanceChanged(key)
      await this.recordMaintenanceAudit(key, previous, normalized, updatedBy, actor)
    }
    return saved
  }

  private async readValue(key: string): Promise<string | null> {
    const row = await this.prisma.institutionSetting.findUnique({ where: { key }, select: { value: true } })
    return row?.value ?? null
  }

  /**
   * Explicit maintenance audit row. The generic audit interceptor already
   * records "PUT /settings/:key"; this row makes the maintenance timeline
   * searchable (`system.maintenance_changed`) with the before/after values.
   * Fail-open: auditing must never block an operator closing the campus.
   */
  private async recordMaintenanceAudit(
    key: string,
    from: string | null,
    to: string,
    actorId: string,
    actor?: { role: string; ip?: string },
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          actorRole: actor?.role ?? 'system',
          action: 'system.maintenance_changed',
          entityType: 'settings',
          entityId: key,
          metadata: { key, from, to, ...(actor?.ip ? { ipAddress: actor.ip } : {}) },
        },
      })
    } catch (error) {
      this.logger.warn(
        `Could not write system.maintenance_changed audit for ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * Best-effort cache invalidation. The maintenance state service owns the
   * Redis snapshot + in-process memo; this emitter is fire-and-forget so a
   * cache failure only widens the bounded staleness window (≤ 60 s).
   */
  private notifyMaintenanceChanged(key: string) {
    try {
      this.events?.emit(MAINTENANCE_SETTINGS_CHANGED_EVENT, { key })
    } catch (error) {
      this.logger.warn(
        `Could not publish maintenance setting change for ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
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
    if (OPTIONAL_TEXT_SETTING_KEYS.includes(key as OptionalTextInstitutionSettingKey)) {
      if (trimmed.length > 500) {
        throw new BadRequestException(`${key} must be 500 characters or fewer`)
      }
      return trimmed
    }
    if (OPTIONAL_DATETIME_SETTING_KEYS.includes(key as OptionalDatetimeInstitutionSettingKey)) {
      if (trimmed.length === 0) return ''
      if (trimmed.length > 64 || Number.isNaN(Date.parse(trimmed))) {
        throw new BadRequestException(`${key} must be a valid ISO-8601 datetime or empty`)
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
