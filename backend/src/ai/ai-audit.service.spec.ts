import { AiAuditService } from './ai-audit.service'

const user = { id: 'teacher-1', role: 'teacher' as const }

describe('AiAuditService', () => {
  it('writes tool invocation and chat run audit rows', async () => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) } }
    const service = new AiAuditService(prisma as never)

    await service.recordToolInvocation(user, 'thread-1', 'find_sections', 'succeeded', 'detail')
    await service.recordChatRun(user, 'thread-1', 'succeeded', { model: 'test-model', toolCount: 1 })

    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(1, {
      data: {
        actorId: 'teacher-1',
        actorRole: 'teacher',
        action: 'ai.tool.find_sections',
        entityType: 'ai_assistant',
        entityId: 'thread-1',
        metadata: { outcome: 'succeeded', tool: 'find_sections', threadId: 'thread-1', detail: 'detail' },
      },
    })
    expect(prisma.auditLog.create).toHaveBeenNthCalledWith(2, {
      data: {
        actorId: 'teacher-1',
        actorRole: 'teacher',
        action: 'ai.chat',
        entityType: 'ai_assistant',
        entityId: 'thread-1',
        metadata: { outcome: 'succeeded', threadId: 'thread-1', model: 'test-model', toolCount: 1 },
      },
    })
  })

  it('writes thread deletion audit rows', async () => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) } }
    const service = new AiAuditService(prisma as never)

    await service.recordThreadDelete(user, 'thread-1', 'failed')

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'teacher-1',
        actorRole: 'teacher',
        action: 'ai.thread.delete',
        entityType: 'ai_assistant',
        entityId: 'thread-1',
        metadata: { outcome: 'failed', threadId: 'thread-1' },
      },
    })
  })

  it('never throws when the audit write fails', async () => {
    const prisma = { auditLog: { create: jest.fn().mockRejectedValue(new Error('database down')) } }
    const service = new AiAuditService(prisma as never)

    await expect(
      service.recordToolInvocation(user, 'thread-1', 'find_sections', 'failed', 'detail'),
    ).resolves.toBeUndefined()
    await expect(service.recordThreadDelete(user, 'thread-1', 'succeeded')).resolves.toBeUndefined()
  })
})
