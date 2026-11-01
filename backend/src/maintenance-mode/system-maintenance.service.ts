import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  MAINTENANCE_SETTINGS_CHANGED_EVENT,
  isMaintenanceExempt,
  type MaintenanceStatus,
} from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import { RedisService } from '../infrastructure/redis.service'
import { SettingsService } from '../settings/settings.service'

/**
 * Runtime maintenance-mode state.
 *
 * The settings rows are authoritative; this service only keeps a Redis
 * snapshot (60 s) plus a 2 s in-process memo so the global maintenance guard
 * pays a cache read instead of a Postgres round-trip per protected request.
 * Toggle writes invalidate the snapshot through `SettingsService`.
 *
 * Failure policy: if neither the cache nor the database can be read, the
 * service fails open (returns disabled) and logs at error level. A
 * momentarily unenforced maintenance window is preferable to bricking the
 * entire API on an internal dependency outage (see the plan's Key Decisions).
 */
@Injectable()
export class SystemMaintenanceService {
  private readonly logger = new Logger(SystemMaintenanceService.name)
  private memo: { value: MaintenanceStatus; expiresAt: number } | null = null

  constructor(
    private readonly settings: SettingsService,
    private readonly redis: RedisService,
  ) {}

  async current(): Promise<MaintenanceStatus> {
    const now = Date.now()
    if (this.memo && this.memo.expiresAt > now) return this.memo.value

    let value: MaintenanceStatus
    try {
      const cached = await this.redis.getJson<MaintenanceStatus>(MAINTENANCE_STATE_CACHE_KEY)
      value = cached !== null ? normalizeSnapshot(cached) : await this.refreshFromSettings()
    } catch (error) {
      this.logger.error(
        `Could not resolve maintenance mode state; failing open: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      value = { enabled: false }
    }
    this.memo = { value, expiresAt: now + MEMO_TTL_MS }
    return value
  }

  async isOn(): Promise<boolean> {
    return (await this.current()).enabled
  }

  /** Maintenance exemption: super admins and IT coordinators keep working. */
  bypasses(user: RequestUser | null | undefined): boolean {
    return isMaintenanceExempt(user)
  }

  /** Drops the in-process memo and the distributed snapshot (best-effort). */
  async invalidate(): Promise<void> {
    this.memo = null
    try {
      const deleted = await this.redis.delete(MAINTENANCE_STATE_CACHE_KEY)
      if (!deleted) {
        this.logger.warn('Maintenance state invalidation did not reach every cache tier')
      }
    } catch (error) {
      this.logger.warn(
        `Could not invalidate the maintenance state cache: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Settings writes invalidate this instance's memo immediately and remove the
   * Redis snapshot. Other instances keep at most a 2 s in-process memo and the
   * 60 s snapshot TTL — the setting row remains authoritative.
   */
  @OnEvent(MAINTENANCE_SETTINGS_CHANGED_EVENT, { async: true })
  async handleMaintenanceSettingsChanged(): Promise<void> {
    await this.invalidate()
  }

  private async refreshFromSettings(): Promise<MaintenanceStatus> {
    const state = await this.settings.getMaintenanceState()
    const value: MaintenanceStatus = state.enabled
      ? {
          enabled: true,
          message: state.message || DEFAULT_MAINTENANCE_MESSAGE,
          ...(state.estimatedEnd ? { estimatedEnd: state.estimatedEnd } : {}),
        }
      : { enabled: false }
    const written = await this.redis.setJson(MAINTENANCE_STATE_CACHE_KEY, value, CACHE_TTL_SECONDS)
    if (!written) {
      this.logger.warn('Maintenance state snapshot did not reach Redis; the database remains authoritative')
    }
    return value
  }
}

const MAINTENANCE_STATE_CACHE_KEY = 'maintenance:state'
const CACHE_TTL_SECONDS = 60
const MEMO_TTL_MS = 2_000

/** Defensive normalization for snapshots written by an older/foreign shape. */
function normalizeSnapshot(value: unknown): MaintenanceStatus {
  if (!value || typeof value !== 'object') return { enabled: false }
  const candidate = value as { enabled?: unknown; message?: unknown; estimatedEnd?: unknown }
  if (candidate.enabled !== true) return { enabled: false }
  const message = typeof candidate.message === 'string' ? candidate.message : DEFAULT_MAINTENANCE_MESSAGE
  const estimatedEnd = typeof candidate.estimatedEnd === 'string' ? candidate.estimatedEnd : undefined
  return {
    enabled: true,
    message,
    ...(estimatedEnd ? { estimatedEnd } : {}),
  }
}
