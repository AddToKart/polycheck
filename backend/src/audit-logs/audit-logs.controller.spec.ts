import { AuditLogsController } from './audit-logs.controller'
import type { PrismaService } from '../prisma/prisma.service'
import type { LedgerService } from '../attendance/ledger.service'

describe('AuditLogsController ledger verification (F9)', () => {
  const user = { id: 'admin-1', role: 'super_admin', scope: 'institution' }
  const verifyResult = { verified: true, recordsChecked: 7, sessionsChecked: 3, lastAnchorDate: '2026-11-01' }

  function makeController(options: { createError?: Error } = {}) {
    const ledger = { verifyLedger: jest.fn().mockResolvedValue(verifyResult) }
    const prisma = {
      auditRecord: undefined,
      auditLog: {
        create: options.createError
          ? jest.fn().mockRejectedValue(options.createError)
          : jest.fn().mockResolvedValue({}),
      },
    }
    const controller = new AuditLogsController(
      {} as never,
      ledger as unknown as LedgerService,
      prisma as unknown as PrismaService,
    )
    return { controller, ledger, prisma }
  }

  it('returns the verify result and writes a super-admin audit row with the outcome', async () => {
    const { controller, ledger, prisma } = makeController()

    const result = await controller.verifyLedger({ user } as never)

    expect(result).toEqual(verifyResult)
    expect(ledger.verifyLedger).toHaveBeenCalledWith(prisma)
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-1',
        actorRole: 'super_admin',
        action: 'ledger.verified',
        entityType: 'audit',
        metadata: { verified: true, recordsChecked: 7, sessionsChecked: 3 },
      }),
    })
  })

  it('also audits failed verification runs', async () => {
    const failed = {
      verified: false,
      recordsChecked: 2,
      sessionsChecked: 1,
      brokenAt: { sessionId: 'sess-1', recordId: 'rec-2', reason: 'hash_mismatch' },
    }
    const ledger = { verifyLedger: jest.fn().mockResolvedValue(failed) }
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } }
    const controller = new AuditLogsController(
      {} as never,
      ledger as unknown as LedgerService,
      prisma as unknown as PrismaService,
    )

    const result = await controller.verifyLedger({ user } as never)

    expect(result.verified).toBe(false)
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { verified: false, recordsChecked: 2, sessionsChecked: 1 },
      }),
    })
  })

  it('keeps the verify run fail-open when the audit row cannot be written', async () => {
    const { controller } = makeController({ createError: new Error('audit table offline') })

    await expect(controller.verifyLedger({ user } as never)).resolves.toEqual(verifyResult)
  })
})
