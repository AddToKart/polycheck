import { DEFAULT_MAINTENANCE_MESSAGE } from '@polycheck/shared'
import { SystemMaintenanceService } from './system-maintenance.service'
import type { SettingsService } from '../settings/settings.service'
import type { RedisService } from '../infrastructure/redis.service'

describe('SystemMaintenanceService', () => {
  let settings: { getMaintenanceState: jest.Mock }
  let redis: { getJson: jest.Mock; setJson: jest.Mock; delete: jest.Mock }
  let service: SystemMaintenanceService

  beforeEach(() => {
    settings = { getMaintenanceState: jest.fn() }
    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
    }
    service = new SystemMaintenanceService(settings as unknown as SettingsService, redis as unknown as RedisService)
  })

  it('serves a disabled snapshot from the database on a cache miss', async () => {
    settings.getMaintenanceState.mockResolvedValue({
      enabled: false,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      estimatedEnd: null,
    })
    await expect(service.current()).resolves.toEqual({ enabled: false })
    expect(redis.setJson).toHaveBeenCalledWith('maintenance:state', { enabled: false }, 60)
  })

  it('serves an enabled snapshot with the resolved message and estimate', async () => {
    settings.getMaintenanceState.mockResolvedValue({
      enabled: true,
      message: 'Campus maintenance',
      estimatedEnd: '2026-11-01T10:00:00.000Z',
    })
    await expect(service.current()).resolves.toEqual({
      enabled: true,
      message: 'Campus maintenance',
      estimatedEnd: '2026-11-01T10:00:00.000Z',
    })
  })

  it('falls back to the built-in copy when no announcement is configured', async () => {
    settings.getMaintenanceState.mockResolvedValue({ enabled: true, message: '', estimatedEnd: null })
    await expect(service.current()).resolves.toEqual({
      enabled: true,
      message: DEFAULT_MAINTENANCE_MESSAGE,
    })
  })

  it('prefers the cached snapshot over the database', async () => {
    redis.getJson.mockResolvedValue({ enabled: true, message: 'Cached' })
    await expect(service.current()).resolves.toEqual({ enabled: true, message: 'Cached' })
    expect(settings.getMaintenanceState).not.toHaveBeenCalled()
  })

  it('memoizes briefly so back-to-back guard checks share one lookup', async () => {
    settings.getMaintenanceState.mockResolvedValue({
      enabled: false,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      estimatedEnd: null,
    })
    await service.current()
    await service.current()
    expect(redis.getJson).toHaveBeenCalledTimes(1)
  })

  it('fails open (disabled) when neither the cache nor the database is readable', async () => {
    redis.getJson.mockRejectedValue(new Error('redis down'))
    settings.getMaintenanceState.mockRejectedValue(new Error('db down'))
    await expect(service.current()).resolves.toEqual({ enabled: false })
  })

  it('treats a malformed cached snapshot as disabled', async () => {
    redis.getJson.mockResolvedValue({ enabled: 'yes' })
    await expect(service.current()).resolves.toEqual({ enabled: false })
  })

  it('invalidates the memo and the distributed snapshot', async () => {
    settings.getMaintenanceState.mockResolvedValue({
      enabled: false,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      estimatedEnd: null,
    })
    await service.current()
    await service.invalidate()
    expect(redis.delete).toHaveBeenCalledWith('maintenance:state')
    redis.getJson.mockResolvedValue(null)
    await service.current()
    expect(redis.getJson).toHaveBeenCalledTimes(2)
  })

  it('clears state when the settings-changed event fires', async () => {
    await service.handleMaintenanceSettingsChanged()
    expect(redis.delete).toHaveBeenCalledWith('maintenance:state')
  })

  it('exempts only super admins and IT coordinators', () => {
    expect(service.bypasses({ id: 'a1', role: 'super_admin' })).toBe(true)
    expect(service.bypasses({ id: 't1', role: 'teacher', isItCoordinator: true })).toBe(true)
    expect(service.bypasses({ id: 't2', role: 'teacher', isDepartmentHead: true })).toBe(false)
    expect(service.bypasses({ id: 's1', role: 'student' })).toBe(false)
    expect(service.bypasses(undefined)).toBe(false)
  })
})
