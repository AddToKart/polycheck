import { MaintenanceService } from './maintenance.service'

describe('MaintenanceService', () => {
  it('expires permissions and prunes only unlinked denied scan attempts older than 90 days', async () => {
    const prisma = {
      scanAttempt: {
        findMany: jest.fn().mockResolvedValue([{ id: 'attempt-1' }, { id: 'attempt-2' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    }
    const permissions = { expireStale: jest.fn().mockResolvedValue(3) }
    const redis = {
      acquireLock: jest.fn().mockResolvedValue('owner-token'),
      releaseLock: jest.fn().mockResolvedValue(true),
    }
    const service = new MaintenanceService(prisma as never, permissions as never, redis as never)

    await service.expireStalePermissions()
    await service.pruneScanAttempts()

    expect(permissions.expireStale).toHaveBeenCalledTimes(1)
    expect(redis.releaseLock).toHaveBeenCalledTimes(2)
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
})
