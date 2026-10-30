import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  RequestTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AiChatSendSchema,
  type AiChatAttachment,
  type AiChatMessage,
  type AiChatSendInput,
  type AiChatSendResult,
  type AiChatThread,
  type AiThreadSummary,
  type AiToolInvocationSummary,
} from '@polycheck/shared'
import { randomUUID } from 'node:crypto'
import type { RequestUser } from '../auth/authenticated-principal'
import { RedisService } from '../infrastructure/redis.service'
import type { UserRole } from '../prisma/client'
import { AiAuditService } from './ai-audit.service'
import type { AiProviderMessage } from './ai-provider.service'
import { AiProviderService } from './ai-provider.service'
import { systemPromptFor } from './ai-prompts'
import { AiStreamService } from './ai-stream.service'
import { AiToolError, AiToolRegistryService } from './ai-tool-registry.service'

const THREAD_TTL_SECONDS = 7 * 24 * 60 * 60
const MAX_THREAD_INDEX_ENTRIES = 20
const THREAD_TITLE_MAX_LENGTH = 60
const DEFAULT_THREAD_TITLE = 'New conversation'
const MAX_THREAD_MESSAGES = 30
const HISTORY_MESSAGE_LIMIT = 20
const MAX_TOOL_ITERATIONS = 4
const RUN_BUDGET_MS = 60_000
const RUN_LOCK_TTL_SECONDS = 180
const DAILY_MESSAGE_LIMIT = 100
const ERROR_TEXT = 'The assistant could not complete that request.'

type StoredAiThread = AiChatThread & { userId: string; role: UserRole }

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name)

  constructor(
    private readonly provider: AiProviderService,
    private readonly registry: AiToolRegistryService,
    private readonly redis: RedisService,
    private readonly stream: AiStreamService,
    private readonly audit: AiAuditService,
    private readonly config: ConfigService,
  ) {}

  async start(user: RequestUser, dto: AiChatSendInput): Promise<AiChatSendResult> {
    this.assertSupportedRole(user)
    const parsed = AiChatSendSchema.safeParse(dto)
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      })
    }

    const input = parsed.data
    const regenerate = input.regenerate === true
    if (regenerate && !input.threadId) {
      throw new BadRequestException('A thread is required to regenerate a reply')
    }

    const capabilities = await this.provider.describe(user)
    if (capabilities.policyBlocked) {
      throw new ForbiddenException(capabilities.reason ?? 'The AI assistant has been disabled by your administrator.')
    }
    if (!capabilities.enabled) {
      throw new ServiceUnavailableException(capabilities.reason ?? 'Assistant is not configured')
    }

    await this.rateLimit(user.id)

    const now = new Date().toISOString()
    const thread = input.threadId ? await this.loadOwnedThread(input.threadId, user) : this.createThread(user, now)
    const messageId = randomUUID()

    if (regenerate) {
      const lastUserIndex = this.lastUserMessageIndex(thread)
      if (lastUserIndex === -1) throw new BadRequestException('Nothing to regenerate')
      // Regeneration replaces the previous assistant turn rather than duplicating the user message.
      thread.messages = thread.messages.slice(0, lastUserIndex + 1)
    }

    // One in-flight reply per conversation. The lock is acquired before the
    // thread is mutated so a rejected send cannot leave a dangling placeholder
    // turn behind, and it is owned by this request's token so a delayed release
    // can never clear a lock another send has since acquired.
    const lockKey = this.runLockKey(thread.id)
    const lockToken = await this.redis.acquireLock(lockKey, RUN_LOCK_TTL_SECONDS)
    if (!lockToken) {
      throw new ConflictException('A reply is already being drafted for this conversation')
    }

    try {
      if (!regenerate) {
        thread.messages.push({
          id: randomUUID(),
          threadId: thread.id,
          role: 'user',
          content: input.message,
          createdAt: now,
        })
      }

      thread.messages.push({
        id: messageId,
        threadId: thread.id,
        role: 'assistant',
        content: '',
        createdAt: now,
      })
      thread.messages = thread.messages.slice(-MAX_THREAD_MESSAGES)
      thread.updatedAt = now
      await this.saveThread(thread)
    } catch (error) {
      await this.releaseRunLock(lockKey, lockToken)
      throw error
    }

    void this.run(user, thread, messageId, lockKey, lockToken).catch(async (error) => {
      this.logger.error(
        `AI chat run escaped its error boundary for thread ${thread.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
      // `run` releases the lock in its own finally; releasing again here only
      // covers a synchronous throw before that boundary and is a no-op unless
      // this request still owns the lock.
      await this.releaseRunLock(lockKey, lockToken)
    })

    return { threadId: thread.id, messageId }
  }

  async getThread(user: RequestUser, threadId: string): Promise<AiChatThread> {
    return this.assertThreadAccess(threadId, user)
  }

  async assertThreadAccess(threadId: string, user: RequestUser): Promise<AiChatThread> {
    return this.toPublicThread(await this.loadOwnedThread(threadId, user))
  }

  async listThreads(user: RequestUser): Promise<AiThreadSummary[]> {
    const summaries = await this.readIndex(user.id)
    return summaries.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }

  async deleteThread(user: RequestUser, threadId: string): Promise<boolean> {
    if (!threadId || threadId.length > 128) {
      await this.audit.recordThreadDelete(user, threadId, 'succeeded')
      return true
    }

    let thread: StoredAiThread
    try {
      thread = await this.loadOwnedThread(threadId, user)
    } catch (error) {
      if (error instanceof ForbiddenException) {
        await this.audit.recordThreadDelete(user, threadId, 'failed')
        // Match the missing-thread response so foreign ids cannot be probed.
        throw new NotFoundException('Thread not found')
      }
      if (!(error instanceof NotFoundException)) throw error
      // The thread may already have expired or been deleted; keep the endpoint idempotent.
      await this.removeFromIndex(user.id, threadId)
      await this.audit.recordThreadDelete(user, threadId, 'succeeded')
      return true
    }

    try {
      const deleted = await this.redis.delete(this.threadKey(thread.id))
      if (!deleted) throw new ServiceUnavailableException('Could not delete the conversation')
      await this.removeFromIndex(user.id, thread.id)
    } catch (error) {
      await this.audit.recordThreadDelete(user, threadId, 'failed')
      throw error
    }

    await this.audit.recordThreadDelete(user, threadId, 'succeeded')
    return true
  }

  async rateLimit(userId: string) {
    const limit = this.positiveInteger(this.config.get('AI_MAX_MESSAGES_PER_DAY'), DAILY_MESSAGE_LIMIT)
    const date = new Date().toISOString().slice(0, 10)
    const allowed = await this.redis.consumeRateLimit(`ai:chat:${userId}:${date}`, limit, 86_400)
    if (!allowed) throw new HttpException('Daily assistant limit reached', HttpStatus.TOO_MANY_REQUESTS)
  }

  private async run(
    user: RequestUser,
    thread: StoredAiThread,
    messageId: string,
    lockKey: string,
    lockToken: string,
  ): Promise<void> {
    const invocations: AiToolInvocationSummary[] = []
    const attachments = new Map<string, AiChatAttachment>()
    const controller = new AbortController()
    let model = 'unknown'
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
      timer = setTimeout(() => controller.abort(), RUN_BUDGET_MS)
      timer.unref?.()
      const capabilities = await this.provider.describe(user)
      if (capabilities.policyBlocked) {
        throw new ForbiddenException(capabilities.reason ?? 'The AI assistant has been disabled by your administrator.')
      }
      if (!capabilities.enabled) {
        throw new ServiceUnavailableException(capabilities.reason ?? 'Assistant is not configured')
      }
      model = capabilities.model ?? 'unknown'
      const messages: AiProviderMessage[] = [
        { role: 'system', content: systemPromptFor(user.role) },
        ...this.historyFor(thread, messageId),
      ]
      const tools = this.registry.toOpenAiTools(user.role)
      let content = ''

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        if (controller.signal.aborted) throw new RequestTimeoutException('The assistant timed out')
        const response = await this.provider.chat(
          messages,
          tools,
          (text) => this.stream.emitToThread(thread.id, { type: 'delta', threadId: thread.id, messageId, text }),
          controller.signal,
          thread.id,
        )
        content = response.content.trim()
        if (response.toolCalls.length === 0) break

        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: call.arguments },
          })),
        })
        for (const call of response.toolCalls) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: await this.executeTool(user, thread.id, call, invocations, attachments),
          })
        }
        if (iteration === MAX_TOOL_ITERATIONS - 1) content = content || ERROR_TEXT
      }

      const finalContent = content || (attachments.size > 0 ? 'The requested file is ready for download.' : ERROR_TEXT)
      const message = await this.persistAssistant(
        thread,
        messageId,
        finalContent,
        [...attachments.values()],
        invocations,
      )
      this.stream.emitToThread(thread.id, { type: 'done', threadId: thread.id, message })
      await this.audit.recordChatRun(user, thread.id, 'succeeded', { model, toolCount: invocations.length })
    } catch (error) {
      this.logger.error(
        `AI chat run failed for thread ${thread.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
      await this.persistFailure(thread, messageId, invocations)
      this.stream.emitToThread(thread.id, {
        type: 'error',
        threadId: thread.id,
        messageId,
        message: ERROR_TEXT,
      })
      await this.audit.recordChatRun(user, thread.id, 'failed', { model, toolCount: invocations.length })
    } finally {
      if (timer) clearTimeout(timer)
      // Covers success, provider failure, timeouts, and escaped errors alike.
      await this.releaseRunLock(lockKey, lockToken)
    }
  }

  /**
   * Best-effort release: the lock carries a TTL, so a failed release degrades to
   * a short 409 window rather than a permanently stuck conversation. The
   * ownership token makes a late release from a previous run harmless.
   */
  private async releaseRunLock(lockKey: string, lockToken: string) {
    try {
      await this.redis.releaseLock(lockKey, lockToken)
    } catch (error) {
      this.logger.warn(
        `Could not release the AI run lock ${lockKey}: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  private async executeTool(
    user: RequestUser,
    threadId: string,
    call: { id: string; name: string; arguments: string },
    invocations: AiToolInvocationSummary[],
    attachments: Map<string, AiChatAttachment>,
  ): Promise<string> {
    let args: unknown = {}
    if (call.arguments.trim()) {
      try {
        args = JSON.parse(call.arguments)
      } catch {
        args = {}
      }
    }

    try {
      const executed = await this.registry.execute(user.role, user, call.name, args, threadId)
      for (const attachment of executed.attachments) attachments.set(attachment.id, attachment)
      invocations.push({ tool: call.name, outcome: 'succeeded' })
      return JSON.stringify(executed.result ?? { ok: true })
    } catch (error) {
      if (error instanceof AiToolError) {
        invocations.push({ tool: call.name, outcome: error.outcome, detail: error.message })
        return JSON.stringify({ error: error.message })
      }
      invocations.push({ tool: call.name, outcome: 'failed', detail: 'Tool execution failed' })
      return JSON.stringify({ error: 'Tool execution failed' })
    }
  }

  private async persistAssistant(
    thread: StoredAiThread,
    messageId: string,
    content: string,
    attachments: AiChatAttachment[],
    invocations: AiToolInvocationSummary[],
  ): Promise<AiChatMessage> {
    const message = this.ensureAssistantMessage(thread, messageId)
    message.content = content
    if (attachments.length > 0) message.attachments = attachments
    else delete message.attachments
    if (invocations.length > 0) message.toolInvocations = invocations
    else delete message.toolInvocations
    thread.updatedAt = new Date().toISOString()
    thread.messages = thread.messages.slice(-MAX_THREAD_MESSAGES)
    await this.saveThread(thread)
    return this.publicMessage(message)
  }

  private async persistFailure(thread: StoredAiThread, messageId: string, invocations: AiToolInvocationSummary[]) {
    try {
      await this.persistAssistant(thread, messageId, ERROR_TEXT, [], invocations)
    } catch (error) {
      this.logger.error(
        `Could not persist the failed assistant message for thread ${thread.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
    }
  }

  private ensureAssistantMessage(thread: StoredAiThread, messageId: string): AiChatMessage {
    const existing = thread.messages.find((message) => message.id === messageId && message.role === 'assistant')
    if (existing) return existing
    const message: AiChatMessage = {
      id: messageId,
      threadId: thread.id,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    }
    thread.messages.push(message)
    return message
  }

  private historyFor(thread: StoredAiThread, assistantMessageId: string): AiProviderMessage[] {
    return thread.messages
      .filter((message) => message.id !== assistantMessageId)
      .filter((message) => message.content.trim().length > 0)
      .slice(-HISTORY_MESSAGE_LIMIT)
      .map((message) => ({ role: message.role, content: message.content }))
  }

  private createThread(user: RequestUser, now: string): StoredAiThread {
    return {
      id: randomUUID(),
      userId: user.id,
      role: user.role,
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  private async loadOwnedThread(threadId: string, user: RequestUser): Promise<StoredAiThread> {
    if (!threadId || threadId.length > 128) throw new NotFoundException('Thread not found')
    const thread = await this.redis.getJson<StoredAiThread>(this.threadKey(threadId))
    if (!thread) throw new NotFoundException('Thread not found')
    if (thread.userId !== user.id) throw new ForbiddenException('You cannot access this thread')
    return thread
  }

  private async saveThread(thread: StoredAiThread) {
    const saved = await this.redis.setJson(this.threadKey(thread.id), thread, THREAD_TTL_SECONDS)
    if (!saved) {
      this.logger.warn(`AI thread ${thread.id} was persisted with a local fallback rather than distributed Redis`)
    }
    await this.upsertIndex(thread)
  }

  private async upsertIndex(thread: StoredAiThread) {
    if (!thread.userId) {
      this.logger.warn(`AI thread ${thread.id} has no owner; skipping the thread index update`)
      return
    }

    try {
      const key = this.threadIndexKey(thread.userId)
      const existing = this.readIndexEntries(await this.redis.getJson<unknown>(key))
      const previous = existing.find((entry) => entry.id === thread.id)
      const summary: AiThreadSummary = {
        id: thread.id,
        title: this.deriveThreadTitle(thread, previous?.title ?? DEFAULT_THREAD_TITLE),
        createdAt: previous?.createdAt ?? thread.createdAt,
        updatedAt: thread.updatedAt,
      }
      const next = [summary, ...existing.filter((entry) => entry.id !== thread.id)]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, MAX_THREAD_INDEX_ENTRIES)
      const saved = await this.redis.setJson(key, next, THREAD_TTL_SECONDS)
      if (!saved) {
        this.logger.warn(`AI thread index for user ${thread.userId} was persisted with a local fallback`)
      }
    } catch (error) {
      this.logger.warn(
        `Could not update the AI thread index for ${thread.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
    }
  }

  private async removeFromIndex(userId: string, threadId: string) {
    try {
      const key = this.threadIndexKey(userId)
      const stored = await this.redis.getJson<unknown>(key)
      if (!Array.isArray(stored)) return
      const entries = this.readIndexEntries(stored)
      const next = entries.filter((entry) => entry.id !== threadId)
      if (next.length === entries.length) return
      const saved = await this.redis.setJson(key, next, THREAD_TTL_SECONDS)
      if (!saved) {
        this.logger.warn(`AI thread index removal for user ${userId} was persisted with a local fallback`)
      }
    } catch (error) {
      this.logger.warn(
        `Could not remove AI thread ${threadId} from the index: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      )
    }
  }

  private async readIndex(userId: string): Promise<AiThreadSummary[]> {
    return this.readIndexEntries(await this.redis.getJson<unknown>(this.threadIndexKey(userId)))
  }

  private readIndexEntries(value: unknown): AiThreadSummary[] {
    if (!Array.isArray(value)) return []
    const entries: AiThreadSummary[] = []
    const seen = new Set<string>()
    for (const candidate of value) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
      const { id, title, createdAt, updatedAt } = candidate as Partial<Record<keyof AiThreadSummary, unknown>>
      if (typeof id !== 'string' || !id || id.length > 128 || seen.has(id)) continue
      if (typeof title !== 'string') continue
      if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) continue
      if (typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))) continue
      seen.add(id)
      entries.push({ id, title, createdAt, updatedAt })
    }
    return entries
  }

  private deriveThreadTitle(thread: StoredAiThread, fallback: string): string {
    const firstUserMessage = thread.messages.find(
      (message) => message.role === 'user' && message.content.trim().length > 0,
    )
    return firstUserMessage ? firstUserMessage.content.trim().slice(0, THREAD_TITLE_MAX_LENGTH) : fallback
  }

  private lastUserMessageIndex(thread: StoredAiThread): number {
    for (let index = thread.messages.length - 1; index >= 0; index--) {
      if (thread.messages[index].role === 'user') return index
    }
    return -1
  }

  private toPublicThread(thread: StoredAiThread): AiChatThread {
    return {
      id: thread.id,
      messages: thread.messages.map((message) => this.publicMessage(message)),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    }
  }

  private publicMessage(message: AiChatMessage): AiChatMessage {
    return {
      id: message.id,
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      ...(message.attachments ? { attachments: message.attachments } : {}),
      ...(message.toolInvocations ? { toolInvocations: message.toolInvocations } : {}),
    }
  }

  private threadKey(threadId: string) {
    return `ai:thread:${threadId}`
  }

  private runLockKey(threadId: string) {
    return `ai:run:${threadId}`
  }

  private threadIndexKey(userId: string) {
    return `ai:user-threads:${userId}`
  }

  private assertSupportedRole(user: RequestUser) {
    if (user.role !== 'teacher' && user.role !== 'super_admin' && user.role !== 'student') {
      throw new ForbiddenException('Unsupported assistant role')
    }
  }

  private positiveInteger(value: unknown, fallback: number) {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
  }
}
