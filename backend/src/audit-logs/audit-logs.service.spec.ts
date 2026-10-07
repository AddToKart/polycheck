import { BadRequestException } from '@nestjs/common'
import type { RequestUser } from '../auth/authenticated-principal'
import { AuditLogsService } from './audit-logs.service'

const institutionAdmin: RequestUser = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
const departmentAdmin: RequestUser = { id: 'admin-2', role: 'super_admin', scope: 'department', department: 'CCIS' }

describe('AuditLogsService', () => {
  it('presents a paginated institution audit trail with actor names', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'log-1', actorId: 'teacher-1', actorRole: 'teacher', action: 'POST /sessions',
          entityType: 'sessions', entityId: 'sess-1', metadata: { outcome: 'succeeded', ip: '127.0.0.1' },
          createdAt: new Date('2026-09-07T01:00:00.000Z'),
        }]),
        count: jest.fn().mockResolvedValue(1),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'teacher-1', fullName: 'Ada Teacher' }]) },
    }
    const service = new AuditLogsService(prisma as never)

    const result = await service.list(institutionAdmin, { page: 1, pageSize: 25 })

    expect(result.totalPages).toBe(1)
    expect(result.items[0]).toMatchObject({ actorName: 'Ada Teacher', outcome: 'succeeded', ipAddress: '127.0.0.1' })
  })

  it('limits department administrators to actors in their department', async () => {
    const prisma = {
      auditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      user: { findMany: jest.fn().mockResolvedValueOnce([{ id: 'teacher-1' }]).mockResolvedValueOnce([]) },
    }
    const service = new AuditLogsService(prisma as never)

    await service.list(departmentAdmin, { page: 1, pageSize: 25 })

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ actorId: { in: ['teacher-1'] } }),
    }))
  })

  it('rejects reversed audit date ranges', async () => {
    const service = new AuditLogsService({} as never)

    await expect(service.list(institutionAdmin, {
      page: 1,
      pageSize: 25,
      startDate: '2026-09-08',
      endDate: '2026-09-07',
    })).rejects.toBeInstanceOf(BadRequestException)
  })
})
