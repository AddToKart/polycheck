import { DEFAULT_MAINTENANCE_MESSAGE } from '@polycheck/shared'
import { SettingsService } from './settings.service'

describe('SettingsService maintenance mode', () => {
  function build(rows: Array<{ key: string; value: string }>) {
    const prisma = {
      institutionSetting: {
        findMany: jest.fn().mockResolvedValue(rows),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }: { create: unknown }) => create),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    }
    const events = { emit: jest.fn() }
    const service = new SettingsService(prisma as never, { get: jest.fn() } as never, events as never)
    return { prisma, events, service }
  }

  it('resolves the maintenance snapshot from the setting rows', async () => {
    const { service } = build([
      { key: 'maintenance_mode_enabled', value: 'true' },
      { key: 'maintenance_message', value: 'We will return at 10 AM.' },
      { key: 'maintenance_until', value: '2026-11-01T10:00:00.000Z' },
    ])
    await expect(service.getMaintenanceState()).resolves.toEqual({
      enabled: true,
      message: 'We will return at 10 AM.',
      estimatedEnd: '2026-11-01T10:00:00.000Z',
    })
  })

  it('substitutes the default announcement when no message is configured', async () => {
    const { service } = build([{ key: 'maintenance_mode_enabled', value: 'true' }])
    await expect(service.getMaintenanceState()).resolves.toEqual({
      enabled: true,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      estimatedEnd: null,
    })
  })

  it('ignores malformed stored datetimes instead of echoing them', async () => {
    const { service } = build([
      { key: 'maintenance_mode_enabled', value: 'true' },
      { key: 'maintenance_until', value: 'not-a-date' },
    ])
    const state = await service.getMaintenanceState()
    expect(state.estimatedEnd).toBeNull()
  })

  it('accepts the maintenance setting keys through validation', async () => {
    const { prisma, service } = build([])
    await service.set('maintenance_mode_enabled', 'true', 'admin-1', { role: 'teacher' })
    await service.set('maintenance_message', '  Planned outage  ', 'admin-1', { role: 'teacher' })
    await service.set('maintenance_until', '2026-11-01T10:00:00.000Z', 'admin-1', { role: 'teacher' })
    await service.set('maintenance_until', '', 'admin-1', { role: 'teacher' })

    const writes = prisma.institutionSetting.upsert.mock.calls.map((call) => call[0].create)
    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'maintenance_mode_enabled', value: 'true' }),
        expect.objectContaining({ key: 'maintenance_message', value: 'Planned outage' }),
        expect.objectContaining({ key: 'maintenance_until', value: '2026-11-01T10:00:00.000Z' }),
        expect.objectContaining({ key: 'maintenance_until', value: '' }),
      ]),
    )
  })

  it('rejects malformed dates and overlong messages', async () => {
    const { service } = build([])
    await expect(service.set('maintenance_until', 'tomorrow', 'admin-1')).rejects.toThrow(
      'maintenance_until must be a valid ISO-8601 datetime or empty',
    )
    await expect(service.set('maintenance_message', 'x'.repeat(501), 'admin-1')).rejects.toThrow(
      'maintenance_message must be 500 characters or fewer',
    )
  })

  it('emits the invalidation event and writes an audit row for maintenance keys', async () => {
    const { prisma, events, service } = build([])
    await service.set('maintenance_mode_enabled', 'true', 'admin-1', {
      role: 'teacher',
      ip: '10.0.0.5',
    })

    expect(events.emit).toHaveBeenCalledWith('settings.maintenance-changed', {
      key: 'maintenance_mode_enabled',
    })
    const audit = prisma.auditLog.create.mock.calls[0][0].data
    expect(audit.action).toBe('system.maintenance_changed')
    expect(audit.metadata).toEqual(expect.objectContaining({ key: 'maintenance_mode_enabled', from: null, to: 'true' }))
  })

  it('does not emit maintenance events for unrelated settings', async () => {
    const { events, service } = build([])
    await service.set('institution_name', 'PUP Santa Maria', 'admin-1')
    expect(events.emit).not.toHaveBeenCalled()
  })
})
