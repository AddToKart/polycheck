import { MaintenanceService, completedUtcDayWindow } from './maintenance.service'

describe('completedUtcDayWindow', () => {
  it('selects the completed UTC calendar day at the scheduled 02:00 run', () => {
    expect(completedUtcDayWindow(new Date('2026-11-04T02:00:00.000Z'))).toEqual({
      date: '2026-11-03',
      windowStart: new Date('2026-11-03T00:00:00.000Z'),
      windowEnd: new Date('2026-11-04T00:00:00.000Z'),
    })
  })

  it('handles month and year boundaries', () => {
    expect(completedUtcDayWindow(new Date('2027-01-01T02:00:00.000Z'))).toEqual({
      date: '2026-12-31',
      windowStart: new Date('2026-12-31T00:00:00.000Z'),
      windowEnd: new Date('2027-01-01T00:00:00.000Z'),
    })
  })
})

describe('MaintenanceService', () => {
  it('expires permissions and prunes only unlinked denied scan attempts older than 90 days', async () => {
    const prisma = {
      scanAttempt: {
        findMany: jest.fn().mockResolvedValue([{ id: 'attempt-1' }, { id: 'attempt-2' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    }
    const permissions = { expireStale: jest.fn().mockResolvedValue(3) }
    const redis = {
      acquireLock: jest.fn().mockResolvedValue('owner-token'),
      releaseLock: jest.fn().mockResolvedValue(true),
    }
    const service = new MaintenanceService(prisma as never, permissions as never, redis as never)

    await service.expireStalePermissions()
    await service.pruneScanAttempts()
    await service.pruneAuditLogs()

    expect(permissions.expireStale).toHaveBeenCalledTimes(1)
    expect(redis.releaseLock).toHaveBeenCalledTimes(3)
    const findWhere = prisma.scanAttempt.findMany.mock.calls[0][0].where
    const cutoff = findWhere.createdAt.lt as Date
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(89 * 24 * 60 * 60 * 1000)
    expect(findWhere).toEqual(expect.objectContaining({ outcome: 'denied', acceptedAttendanceRecord: { is: null } }))
    expect(prisma.scanAttempt.deleteMany.mock.calls[0][0].where).toEqual({
      id: { in: ['attempt-1', 'attempt-2'] },
      acceptedAttendanceRecord: { is: null },
    })
  })

  it('prunes denied attempts in bounded batches while preserving linked evidence', async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({ id: `attempt-${index}` }))
    const prisma = {
      scanAttempt: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(firstBatch)
          .mockResolvedValueOnce([{ id: 'attempt-last' }]),
        deleteMany: jest.fn().mockResolvedValueOnce({ count: 1000 }).mockResolvedValueOnce({ count: 1 }),
      },
    }
    const redis = { acquireLock: jest.fn().mockResolvedValue('owner-token'), releaseLock: jest.fn() }
    const service = new MaintenanceService(prisma as never, { expireStale: jest.fn() } as never, redis as never)

    await service.pruneScanAttempts()

    expect(prisma.scanAttempt.findMany).toHaveBeenCalledTimes(2)
    expect(prisma.scanAttempt.findMany.mock.calls[0][0].take).toBe(1000)
    expect(prisma.scanAttempt.deleteMany).toHaveBeenCalledTimes(2)
  })

  it('prunes audit logs in bounded batches using the configured retention window', async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({ id: `audit-${index}` }))
    const prisma = {
      auditLog: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(firstBatch)
          .mockResolvedValueOnce([{ id: 'audit-last' }]),
        deleteMany: jest.fn().mockResolvedValueOnce({ count: 1000 }).mockResolvedValueOnce({ count: 1 }),
      },
    }
    const redis = { acquireLock: jest.fn().mockResolvedValue('owner-token'), releaseLock: jest.fn() }
    const config = { get: jest.fn().mockReturnValue(365) }
    const service = new MaintenanceService(
      prisma as never,
      { expireStale: jest.fn() } as never,
      redis as never,
      config as never,
    )

    await service.pruneAuditLogs()

    expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(2)
    expect(prisma.auditLog.findMany.mock.calls[0][0].take).toBe(1000)
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledTimes(2)
    const cutoff = prisma.auditLog.findMany.mock.calls[0][0].where.createdAt.lt as Date
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(364 * 24 * 60 * 60 * 1000)
  })

  it('contains maintenance failures so cron execution remains healthy', async () => {
    const prisma = { scanAttempt: { findMany: jest.fn().mockRejectedValue(new Error('database unavailable')) } }
    const permissions = { expireStale: jest.fn().mockRejectedValue(new Error('database unavailable')) }
    const redis = {
      acquireLock: jest.fn().mockResolvedValue('owner-token'),
      releaseLock: jest.fn().mockResolvedValue(true),
    }
    const service = new MaintenanceService(prisma as never, permissions as never, redis as never)

    await expect(service.expireStalePermissions()).resolves.toBeUndefined()
    await expect(service.pruneScanAttempts()).resolves.toBeUndefined()
  })

  it('prunes notifications through the nightly retention job', async () => {
    const redis = { acquireLock: jest.fn().mockResolvedValue('owner-token'), releaseLock: jest.fn() }
    const notifications = { pruneExpired: jest.fn().mockResolvedValue(5) }
    const service = new MaintenanceService(
      {} as never,
      { expireStale: jest.fn() } as never,
      redis as never,
      undefined,
      notifications as never,
    )

    await service.pruneNotifications()

    expect(notifications.pruneExpired).toHaveBeenCalledWith(30)
    expect(redis.releaseLock).toHaveBeenCalledWith('maintenance:prune-notifications', 'owner-token')
  })

  it('does no maintenance work when another replica owns the job lock', async () => {
    const prisma = { scanAttempt: { findMany: jest.fn(), deleteMany: jest.fn() } }
    const permissions = { expireStale: jest.fn() }
    const redis = { acquireLock: jest.fn().mockResolvedValue(null), releaseLock: jest.fn() }
    const service = new MaintenanceService(prisma as never, permissions as never, redis as never)

    await service.expireStalePermissions()
    await service.pruneScanAttempts()

    expect(permissions.expireStale).not.toHaveBeenCalled()
    expect(prisma.scanAttempt.deleteMany).not.toHaveBeenCalled()
    expect(redis.releaseLock).not.toHaveBeenCalled()
  })

  describe('attendance ledger anchoring (F9)', () => {
    const makeService = (prisma: Record<string, unknown>) =>
      new MaintenanceService(
        prisma as never,
        { expireStale: jest.fn() } as never,
        { acquireLock: jest.fn().mockResolvedValue('owner-token'), releaseLock: jest.fn() } as never,
      )

    it('publishes the day head into an append-only audit row at 2AM', async () => {
      const prisma = {
        attendanceRecord: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'rec-2',
            sessionId: 'sess-1',
            recordHash: 'head-hash',
          }),
          count: jest.fn().mockResolvedValue(9),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      }
      const service = makeService(prisma)

      await service.anchorAttendanceLedger()

      const headWhere = prisma.attendanceRecord.findFirst.mock.calls[0][0]
      expect(headWhere.where).toEqual(
        expect.objectContaining({
          recordHash: { not: null },
          timestamp: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
        }),
      )
      const start = headWhere.where.timestamp.gte as Date
      const end = headWhere.where.timestamp.lt as Date
      expect((end.getTime() - start.getTime()) % (24 * 3600_000)).toBe(0)
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1)
      const row = prisma.auditLog.create.mock.calls[0][0].data
      expect(row).toEqual(
        expect.objectContaining({
          actorId: 'system',
          actorRole: 'system',
          action: 'ledger.anchored',
          entityType: 'ledger',
        }),
      )
      expect(row.metadata).toEqual(
        expect.objectContaining({
          lastRecordHash: 'head-hash',
          recordsCounted: 9,
          sessionId: 'sess-1',
          recordId: 'rec-2',
        }),
      )
      expect(row.metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('skips the anchor row when the day has no chained records', async () => {
      const prisma = {
        attendanceRecord: {
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        auditLog: { create: jest.fn() },
      }
      const service = makeService(prisma)

      await service.anchorAttendanceLedger()

      expect(prisma.auditLog.create).not.toHaveBeenCalled()
      expect(prisma.attendanceRecord.count).not.toHaveBeenCalled()
    })

    it('stays fail-open when the anchor write fails', async () => {
      const prisma = {
        attendanceRecord: {
          findFirst: jest.fn().mockResolvedValue({ id: 'rec-1', sessionId: 'sess-1', recordHash: 'hash' }),
          count: jest.fn().mockResolvedValue(1),
        },
        auditLog: { create: jest.fn().mockRejectedValue(new Error('audit table down')) },
      }
      const service = makeService(prisma)

      await expect(service.anchorAttendanceLedger()).resolves.toBeUndefined()
    })
  })
})
