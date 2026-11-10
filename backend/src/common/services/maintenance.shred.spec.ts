import { MaintenanceService } from './maintenance.service'
import type { PrivacyShredRecord } from '../constants/privacy'

const MS_PER_DAY = 24 * 60 * 60 * 1000

type FindManyMock = jest.Mock & { mock: { calls: unknown[][] } }
type UpdateManyMock = jest.Mock & { mock: { calls: unknown[][] } }

function firstCallArguments(mock: FindManyMock | UpdateManyMock): Record<string, unknown> {
  const call = mock.mock.calls[0]
  return (Array.isArray(call) ? call[0] : undefined) as Record<string, unknown>
}

function makePrisma(
  options: {
    attendanceBatches?: number[][]
    attemptBatches?: number[][]
    updateCounts?: [number, number]
  } = {},
) {
  const { attendanceBatches = [], attemptBatches = [], updateCounts = [1, 2] } = options
  return {
    attendanceRecord: {
      findMany: jest.fn(async (_query: unknown) =>
        (attendanceBatches.shift() ?? []).map((index) => ({ id: `rec-${index}` })),
      ) as unknown as FindManyMock,
      updateMany: jest.fn(async (_arguments_: unknown) => ({ count: updateCounts[0] })) as unknown as UpdateManyMock,
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    scanAttempt: {
      findMany: jest.fn(async (_query: unknown) =>
        (attemptBatches.shift() ?? []).map((index) => ({ id: `attempt-${index}` })),
      ) as unknown as FindManyMock,
      updateMany: jest.fn(async (_arguments_: unknown) => ({ count: updateCounts[1] })) as unknown as UpdateManyMock,
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  }
}
function buildFixtures(options: { retentionDays?: number; settingsError?: Error } = {}): {
  prisma: ReturnType<typeof makePrisma>
  settings: { getInteger: jest.Mock; recordPrivacyShredRun: jest.Mock }
  redis: { acquireLock: jest.Mock; releaseLock: jest.Mock }
  service: MaintenanceService
} {
  const { retentionDays, settingsError } = options
  const prisma = makePrisma()
  const settings = {
    getInteger: settingsError
      ? jest.fn(async () => {
          throw settingsError
        })
      : jest.fn(async () => retentionDays ?? 30),
    recordPrivacyShredRun: jest.fn(async (_summary: PrivacyShredRecord) => undefined),
  }
  const redis = {
    acquireLock: jest.fn(async () => 'owner-token'),
    releaseLock: jest.fn(async () => true),
  }
  const service = new MaintenanceService(
    prisma as never,
    { expireStale: jest.fn() } as never,
    redis as never,
    undefined,
    undefined,
    settings as never,
  )
  return { prisma, settings, redis, service }
}

describe('MaintenanceService ephemeral telemetry shredding (F6)', () => {
  it('nulls coordinates on both tables past the default 30-day window and never deletes attempts', async () => {
    const { prisma, settings, service } = buildFixtures()
    prisma.attendanceRecord.findMany
      .mockResolvedValueOnce([{ id: 'rec-1' }, { id: 'rec-2' }, { id: 'rec-3' }])
      .mockResolvedValueOnce([])
    prisma.scanAttempt.findMany
      .mockResolvedValueOnce([{ id: 'attempt-4' }, { id: 'attempt-5' }])
      .mockResolvedValueOnce([])
    prisma.attendanceRecord.updateMany.mockResolvedValue({ count: 3 })
    prisma.scanAttempt.updateMany.mockResolvedValue({ count: 2 })

    await service.shredEphemeralTelemetry()

    const recordQuery = firstCallArguments(prisma.attendanceRecord.findMany as FindManyMock)
    expect(recordQuery.where).toEqual({
      timestamp: { lt: expect.any(Date) },
      OR: [{ latitude: { not: null } }, { longitude: { not: null } }],
    })
    const cutoff = (recordQuery.where as { timestamp: { lt: Date } }).timestamp.lt
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(29 * MS_PER_DAY)
    expect(Date.now() - cutoff.getTime()).toBeLessThanOrEqual(31 * MS_PER_DAY)
    expect(recordQuery.take).toBe(1_000)
    expect(recordQuery.orderBy).toEqual({ id: 'asc' })
    const recordUpdate = firstCallArguments(prisma.attendanceRecord.updateMany as UpdateManyMock)
    expect(recordUpdate).toEqual({
      where: { id: { in: ['rec-1', 'rec-2', 'rec-3'] } },
      data: { latitude: null, longitude: null },
    })

    const attemptQuery = firstCallArguments(prisma.scanAttempt.findMany as FindManyMock)
    const attemptWhere = attemptQuery.where as { OR: unknown[]; timestamp: unknown }
    expect(attemptWhere.OR).toEqual([
      { latitude: { not: null } },
      { longitude: { not: null } },
      { accuracyMeters: { not: null } },
      { riskSignals: { not: expect.anything() } },
    ])
    expect(attemptWhere.timestamp).toEqual({ lt: expect.any(Date) })
    const attemptUpdate = firstCallArguments(prisma.scanAttempt.updateMany as UpdateManyMock)
    expect(attemptUpdate.where).toEqual({ id: { in: ['attempt-4', 'attempt-5'] } })
    expect(attemptUpdate.data).toEqual({
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      riskSignals: expect.anything(),
    })
    // Denied-attempt retention stays owned by the existing prune job — shredding only blanks columns.
    expect(prisma.scanAttempt.deleteMany).not.toHaveBeenCalled()
    expect(prisma.attendanceRecord.deleteMany).not.toHaveBeenCalled()
    // Decisional metadata is preserved: the data clause never touches it.
    expect(Object.keys(attemptUpdate.data as Record<string, unknown>)).toEqual([
      'latitude',
      'longitude',
      'accuracyMeters',
      'riskSignals',
    ])
    expect(Object.keys(recordUpdate.data as Record<string, unknown>)).toEqual(['latitude', 'longitude'])
    expect(settings.recordPrivacyShredRun).toHaveBeenCalledWith({
      lastRunAt: expect.any(String),
      recordsShredded: 3,
      attemptsShredded: 2,
    })
  })

  it.each([
    [75, 75 * MS_PER_DAY],
    [120, 90 * MS_PER_DAY],
    [2, 7 * MS_PER_DAY],
  ])('honors the retention setting and clamps it to 7–90 days: %i', async (configured, expectedWindow) => {
    const { prisma, service } = buildFixtures({ retentionDays: configured })
    prisma.attendanceRecord.findMany.mockResolvedValue([]).mockResolvedValueOnce([[]])

    await service.shredEphemeralTelemetry()

    const query = firstCallArguments(prisma.attendanceRecord.findMany as FindManyMock)
    const cutoff = (query.where as { timestamp: { lt: Date } }).timestamp.lt
    const age = Date.now() - cutoff.getTime()
    expect(age).toBeGreaterThanOrEqual(expectedWindow - MS_PER_DAY)
    expect(age).toBeLessThanOrEqual(expectedWindow + 2 * MS_PER_DAY)
  })

  it('falls back to the 30-day default when the settings read fails or is absent', async () => {
    const failing = buildFixtures({ settingsError: new Error('settings unavailable') })
    failing.prisma.attendanceRecord.findMany.mockResolvedValue([])
    failing.prisma.scanAttempt.findMany.mockResolvedValue([])
    await failing.service.shredEphemeralTelemetry()
    const failingQuery = firstCallArguments(failing.prisma.attendanceRecord.findMany as FindManyMock)
    const failingCutoff = (failingQuery.where as { timestamp: { lt: Date } }).timestamp.lt
    expect(Date.now() - failingCutoff.getTime()).toBeGreaterThanOrEqual(29 * MS_PER_DAY)

    const legacyPrisma = {
      attendanceRecord: {
        findMany: jest.fn(async () => []),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      scanAttempt: {
        findMany: jest.fn(async () => []),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    }
    const legacy = new MaintenanceService(
      legacyPrisma as never,
      { expireStale: jest.fn() } as never,
      { acquireLock: jest.fn(async () => 'owner-token'), releaseLock: jest.fn(async () => true) } as never,
    )
    await legacy.shredEphemeralTelemetry()
    const legacyWhere = firstCallArguments(legacyPrisma.attendanceRecord.findMany as unknown as FindManyMock)
    const legacyCutoff = (legacyWhere.where as { timestamp: { lt: Date } }).timestamp.lt
    expect(Date.now() - legacyCutoff.getTime()).toBeGreaterThanOrEqual(29 * MS_PER_DAY)
  })

  it('processes in bounded 1000-row batches, accumulates the counts, and terminates on exhausted rows', async () => {
    const firstBatch = Array.from({ length: 1_000 }, (_, index) => ({ id: `rec-${index}` }))
    const attemptsFirst = Array.from({ length: 1_000 }, (_, index) => ({ id: `attempt-${index}` }))
    const prisma = {
      attendanceRecord: {
        findMany: jest
          .fn(async () => firstBatch)
          .mockResolvedValueOnce(firstBatch)
          .mockResolvedValueOnce([]),
        updateMany: jest.fn(async () => ({ count: 1_000 })),
        deleteMany: jest.fn(),
      },
      scanAttempt: {
        findMany: jest
          .fn(async () => attemptsFirst)
          .mockResolvedValueOnce(attemptsFirst)
          .mockResolvedValueOnce([]),
        updateMany: jest.fn(async () => ({ count: 1_000 })),
        deleteMany: jest.fn(),
      },
    }
    const settings = {
      getInteger: jest.fn(async () => 30),
      recordPrivacyShredRun: jest.fn(async (_summary: PrivacyShredRecord) => undefined),
    }
    const service = new MaintenanceService(
      prisma as never,
      { expireStale: jest.fn() } as never,
      { acquireLock: jest.fn(async () => 'owner-token'), releaseLock: jest.fn(async () => true) } as never,
      undefined,
      undefined,
      settings as never,
    )

    await service.shredEphemeralTelemetry()

    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledTimes(2)
    expect(firstCallArguments(prisma.attendanceRecord.findMany as FindManyMock).take).toBe(1_000)
    expect(prisma.scanAttempt.findMany).toHaveBeenCalledTimes(2)
    expect(prisma.attendanceRecord.deleteMany).not.toHaveBeenCalled()
    expect(settings.recordPrivacyShredRun).toHaveBeenCalledWith({
      lastRunAt: expect.any(String),
      recordsShredded: 1_000,
      attemptsShredded: 1_000,
    })
    expect(settings.recordPrivacyShredRun.mock.calls[0]?.[0]?.lastRunAt).toBeTruthy()

    // Second run with everything already shredded (hybrid online rows are never selected at all).
    prisma.attendanceRecord.findMany.mockReset().mockResolvedValue([])
    prisma.scanAttempt.findMany.mockReset().mockResolvedValue([])
    await service.shredEphemeralTelemetry()
    expect(settings.recordPrivacyShredRun).toHaveBeenLastCalledWith({
      lastRunAt: expect.any(String),
      recordsShredded: 0,
      attemptsShredded: 0,
    })
  })

  it('runs under the dedicated Redis lock and leaves the anchor/prune locks untouched', async () => {
    const { redis, service, prisma } = buildFixtures()
    prisma.attendanceRecord.findMany.mockResolvedValue([])
    prisma.scanAttempt.findMany.mockResolvedValue([])

    await service.shredEphemeralTelemetry()

    expect(redis.acquireLock).toHaveBeenCalledWith('maintenance:shred-ephemeral-telemetry', 25 * 60 * 60)
    expect(redis.releaseLock).toHaveBeenCalledWith('maintenance:shred-ephemeral-telemetry', 'owner-token')
  })

  it('stays fail-open when shredding or summary publication fails', async () => {
    const failingUpdates = buildFixtures()
    failingUpdates.prisma.attendanceRecord.findMany.mockRejectedValue(new Error('database unavailable'))
    await expect(failingUpdates.service.shredEphemeralTelemetry()).resolves.toBeUndefined()

    const failingSummary = buildFixtures()
    failingSummary.settings.recordPrivacyShredRun.mockRejectedValue(new Error('redis snapshot down'))
    failingSummary.prisma.attendanceRecord.findMany.mockResolvedValue([]).mockResolvedValueOnce([{ id: 'rec-1' }])
    await expect(failingSummary.service.shredEphemeralTelemetry()).resolves.toBeUndefined()
  })
})
