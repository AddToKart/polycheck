import { Injectable, Logger } from '@nestjs/common'
import type { AiToolOutcome } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import type { Prisma } from '../prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AiAuditService {
  private readonly logger = new Logger(AiAuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  async recordToolInvocation(
    user: RequestUser,
    threadId: string | undefined,
    tool: string,
    outcome: AiToolOutcome,
    detail?: string,
  ) {
    await this.write({
      actorId: user.id,
      actorRole: user.role,
      action: `ai.tool.${tool.slice(0, 120)}`,
      entityType: 'ai_assistant',
      entityId: threadId ?? null,
      metadata: {
        outcome,
        tool,
        threadId: threadId ?? null,
        ...(detail ? { detail } : {}),
      },
    })
  }

  async recordChatRun(
    user: RequestUser,
    threadId: string,
    outcome: 'succeeded' | 'failed',
    metadata: { model: string; toolCount: number },
  ) {
    await this.write({
      actorId: user.id,
      actorRole: user.role,
      action: 'ai.chat',
      entityType: 'ai_assistant',
      entityId: threadId,
      metadata: { outcome, threadId, ...metadata },
    })
  }

  async recordThreadDelete(user: RequestUser, threadId: string, outcome: 'succeeded' | 'failed') {
    await this.write({
      actorId: user.id,
      actorRole: user.role,
      action: 'ai.thread.delete',
      entityType: 'ai_assistant',
      entityId: threadId,
      metadata: { outcome, threadId },
    })
  }

  private async write(data: {
    actorId: string
    actorRole: string
    action: string
    entityType: string
    entityId: string | null
    metadata: Prisma.InputJsonObject
  }) {
    try {
      await this.prisma.auditLog.create({ data })
    } catch (error) {
      this.logger.error(
        `Could not write ${data.action} audit for ${data.entityType}:${data.entityId ?? 'unknown'}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
    }
  }
}
