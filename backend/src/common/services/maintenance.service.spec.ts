import { MaintenanceService } from './maintenance.service'

describe('MaintenanceService', () => {
  it('expires permissions and prunes scan attempts older than 90 days', async () => {
    const prisma = { scanAttempt: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) } }
    const permissions = { expireStale: jest.fn().mockResolvedValue(3) }
    const service = new MaintenanceService(prisma as never, permissions as never)

    await service.expireStalePermissions()
    await service.pruneScanAttempts()

    expect(permissions.expireStale).toHaveBeenCalledTimes(1)
    const cutoff = prisma.scanAttempt.deleteMany.mock.calls[0][0].where.createdAt.lt as Date
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(89 * 24 * 60 * 60 * 1000)
  })

  it('contains maintenance failures so cron execution remains healthy', async () => {
    const prisma = { scanAttempt: { deleteMany: jest.fn().mockRejectedValue(new Error('database unavailable')) } }
    const permissions = { expireStale: jest.fn().mockRejectedValue(new Error('database unavailable')) }
    const service = new MaintenanceService(prisma as never, permissions as never)

    await expect(service.expireStalePermissions()).resolves.toBeUndefined()
    await expect(service.pruneScanAttempts()).resolves.toBeUndefined()
  })
})
