import { describe, expect, it } from 'vitest'
import {
  MaintenanceBlockBodySchema,
  MaintenanceMessageSchema,
  MaintenanceStatusSchema,
  MaintenanceUntilSchema,
  isMaintenanceBlockBody,
} from './maintenance'
import { DEFAULT_MAINTENANCE_MESSAGE, MAINTENANCE_SETTING_KEYS, isMaintenanceSettingKey } from '../types/maintenance'

describe('maintenance validation', () => {
  it('accepts the canonical disabled snapshot', () => {
    expect(MaintenanceStatusSchema.parse({ enabled: false })).toEqual({ enabled: false })
  })

  it('accepts an enabled snapshot with announcement fields', () => {
    const parsed = MaintenanceStatusSchema.parse({
      enabled: true,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      estimatedEnd: '2026-11-01T10:30:00.000Z',
    })
    expect(parsed.enabled).toBe(true)
    expect(parsed.estimatedEnd).toBe('2026-11-01T10:30:00.000Z')
  })

  it('parses the canonical 503 body and rejects other codes', () => {
    expect(
      isMaintenanceBlockBody({ code: 'system_maintenance', message: 'Down for maintenance', estimatedEnd: '2026-11-01T10:30:00Z' }),
    ).toBe(true)
    expect(isMaintenanceBlockBody({ code: 'device_cooldown_active', message: 'x' })).toBe(false)
    expect(isMaintenanceBlockBody(null)).toBe(false)
    expect(isMaintenanceBlockBody({ code: 'system_maintenance' })).toBe(false)
    expect(MaintenanceBlockBodySchema.safeParse({ code: 'system_maintenance', message: 'm' }).success).toBe(true)
  })

  it('bounds the announcement message at 500 trimmed characters', () => {
    expect(MaintenanceMessageSchema.parse('  Server maintenance  ')).toBe('Server maintenance')
    expect(MaintenanceMessageSchema.safeParse('x'.repeat(500)).success).toBe(true)
    expect(MaintenanceMessageSchema.safeParse('x'.repeat(501)).success).toBe(false)
  })

  it('accepts an empty estimate (clears it) or a parseable ISO timestamp only', () => {
    expect(MaintenanceUntilSchema.parse('')).toBe('')
    expect(MaintenanceUntilSchema.parse('2026-11-01T10:30:00.000Z')).toBe('2026-11-01T10:30:00.000Z')
    expect(MaintenanceUntilSchema.safeParse('tomorrow-ish').success).toBe(false)
    expect(MaintenanceUntilSchema.safeParse('x'.repeat(65)).success).toBe(false)
  })

  it('exposes the three setting keys and a stable key guard', () => {
    expect(MAINTENANCE_SETTING_KEYS).toEqual([
      'maintenance_mode_enabled',
      'maintenance_message',
      'maintenance_until',
    ])
    expect(isMaintenanceSettingKey('maintenance_mode_enabled')).toBe(true)
    expect(isMaintenanceSettingKey('ai_model')).toBe(false)
  })
})
