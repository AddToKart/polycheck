import {
  clearMaintenance,
  formatMaintenanceRemaining,
  getMaintenanceSnapshot,
  isMaintenanceError,
  maintenanceDetailFromError,
  setMaintenanceActive,
  subscribeToMaintenance,
} from '../lib/maintenance'

describe('maintenance store', () => {
  afterEach(() => clearMaintenance())

  it('publishes the canonical snapshot with the default announcement', () => {
    const seen: Array<unknown> = []
    const unsubscribe = subscribeToMaintenance((value) => seen.push(value))
    setMaintenanceActive({ estimatedEnd: '2026-11-01T10:00:00.000Z' })

    expect(getMaintenanceSnapshot()).toEqual({
      message: expect.stringContaining('scheduled maintenance'),
      estimatedEnd: '2026-11-01T10:00:00.000Z',
    })
    expect(seen.length).toBeGreaterThanOrEqual(1)
    unsubscribe()
  })

  it('uses a custom announcement and clears back to open', () => {
    setMaintenanceActive({ message: 'Back at 10 AM' })
    expect(getMaintenanceSnapshot()?.message).toBe('Back at 10 AM')

    clearMaintenance()
    expect(getMaintenanceSnapshot()).toBeNull()
  })

  it('recognises only the canonical 503 shape', () => {
    expect(isMaintenanceError({ status: 503, code: 'system_maintenance' })).toBe(true)
    expect(isMaintenanceError({ status: 503, code: 'other' })).toBe(false)
    expect(isMaintenanceError({ status: 403, code: 'system_maintenance' })).toBe(false)
    expect(isMaintenanceError(new Error('offline'))).toBe(false)
    expect(isMaintenanceError(null)).toBe(false)
  })

  it('extracts announcement fields defensively', () => {
    expect(
      maintenanceDetailFromError({
        status: 503,
        code: 'system_maintenance',
        message: 'Down',
        estimatedEnd: '2026-11-01T10:00:00Z',
      }),
    ).toEqual({ message: 'Down', estimatedEnd: '2026-11-01T10:00:00Z' })
    expect(maintenanceDetailFromError(new Error('boom'))).toEqual({ message: 'boom' })
    expect(maintenanceDetailFromError(null)).toEqual({})
  })
})

describe('maintenance countdown', () => {
  const NOW = Date.parse('2026-11-01T09:00:00.000Z')

  it('hides when no estimate exists', () => {
    expect(formatMaintenanceRemaining(undefined, NOW).tone).toBe('none')
    expect(formatMaintenanceRemaining('garbage', NOW).tone).toBe('none')
  })

  it('counts down in minutes and hours', () => {
    expect(formatMaintenanceRemaining('2026-11-01T09:10:00.000Z', NOW).label).toBe(
      'Estimated resumption in 10 min',
    )
    expect(formatMaintenanceRemaining('2026-11-01T10:35:00.000Z', NOW).label).toBe(
      'Estimated resumption in 1 h 35 min',
    )
  })

  it('flags overdue estimates without implying auto-off', () => {
    expect(formatMaintenanceRemaining('2026-11-01T08:00:00.000Z', NOW)).toEqual({
      tone: 'overdue',
      label: 'Resumption is overdue — contact the IT desk',
    })
  })
})
