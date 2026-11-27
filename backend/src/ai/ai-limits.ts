import type { ConfigService } from '@nestjs/config'
import {
  AI_DAILY_LIMIT_DEFAULTS,
  AI_DAILY_LIMIT_MAX,
  AI_DAILY_LIMIT_SETTING_KEYS,
  type AiLimitRole,
} from '@polycheck/shared'
import type { SettingsService } from '../settings/settings.service'

/**
 * The messages one account of this role may send per day. A super admin's saved
 * setting wins; without one, students and teachers get the built-in defaults and
 * administrators keep the `AI_MAX_MESSAGES_PER_DAY` server value.
 */
export async function resolveDailyLimit(
  settings: Pick<SettingsService, 'getInteger'>,
  config: Pick<ConfigService, 'get'>,
  role: AiLimitRole,
): Promise<number> {
  const fromServer = Number(config.get('AI_MAX_MESSAGES_PER_DAY'))
  const fallback =
    role === 'super_admin' && Number.isInteger(fromServer) && fromServer > 0
      ? fromServer
      : AI_DAILY_LIMIT_DEFAULTS[role]
  const value = await settings.getInteger(AI_DAILY_LIMIT_SETTING_KEYS[role], fallback)
  return Math.min(AI_DAILY_LIMIT_MAX, Math.max(0, value))
}

const CAMPUS_UTC_OFFSET = '+08:00'

const campusDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The campus calendar day a message counts against, and when the next one starts. */
export function campusDayWindow(now = new Date()): { day: string; resetsAt: string } {
  const day = campusDayFormatter.format(now)
  const start = Date.parse(`${day}T00:00:00${CAMPUS_UTC_OFFSET}`)
  return { day, resetsAt: new Date(start + 24 * 60 * 60 * 1000).toISOString() }
}
