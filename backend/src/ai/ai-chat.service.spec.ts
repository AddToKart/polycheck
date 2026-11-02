import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { AiChatAttachment, AiChatMessage, AiStreamEvent, AiThreadSummary } from '@polycheck/shared'
import { AiChatService } from './ai-chat.service'
import { STUDENT_SYSTEM_PROMPT } from './ai-prompts'

const teacher = { id: 'teacher-1', role: 'teacher' as const }
const otherTeacher = { id: 'teacher-2', role: 'teacher' as const }

const masterListAttachment: AiChatAttachment = {
  id: 'master-list-sec-1-pdf',
  kind: 'master_list',
  format: 'pdf',
  label: 'Master list — Software Engineering Section 1',
  filename: 'master-list-1-SE101.pdf',
  downloadPath: '/docs/master-list/sec-1?format=pdf',
}

function makeChat() {
  const store = new Map<string, unknown>()
  const locks = new Map<string, string>()
  let lockSequence = 0
  const redis = {
    getJson: jest.fn(async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null)),
    setJson: jest.fn(async (key: string, value: unknown) => {
      store.set(key, structuredClone(value))
      return true
    }),
    delete: jest.fn(async (key: string) => {
      store.delete(key)
      return true
    }),
    consumeRateLimit: jest.fn().mockResolvedValue(true),
    acquireLock: jest.fn(async (key: string) => {
      if (locks.has(key)) return null
      const token = `lock-owner-${++lockSequence}`
      locks.set(key, token)
      return token
    }),
    releaseLock: jest.fn(async (key: string, ownershipToken: string) => {
      if (locks.get(key) !== ownershipToken) return false
      locks.delete(key)
      return true
    }),
  }
  const provider = {
    describe: jest.fn().mockResolvedValue({ enabled: true, model: 'test-model', maxMessageChars: 2_000 }),
    isConfigured: jest.fn().mockResolvedValue(true),
    chat: jest.fn().mockResolvedValue({ content: 'Hello', toolCalls: [] }),
  }
  const registry = {
    toOpenAiTools: jest.fn().mockReturnValue([]),
    execute: jest.fn(),
  }
  const stream = { emitToThread: jest.fn() }
  const audit = {
    recordChatRun: jest.fn().mockResolvedValue(undefined),
    recordToolInvocation: jest.fn().mockResolvedValue(undefined),
    recordThreadDelete: jest.fn().mockResolvedValue(undefined),
  }
  const config = {
    get: jest.fn((key: string) => (key === 'AI_MAX_MESSAGES_PER_DAY' ? 100 : undefined)),
  }
  const service = new AiChatService(
    provider as never,
    registry as never,
    redis as never,
    stream as never,
    audit as never,
    config as never,
  )
  return { service, store, locks, redis, provider, registry, stream, audit, config }
}

async function waitFor(predicate: () => boolean, description: string, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Timed out waiting for ${description}`)
}

function waitForDone(stream: { emitToThread: jest.Mock }) {
  return new Promise<AiChatMessage>((resolve, reject) => {
    stream.emitToThread.mockImplementation((_threadId: string, event: AiStreamEvent) => {
      if (event.type === 'done') resolve(event.message)
      if (event.type === 'error') reject(new Error(event.message))
    })
  })
}

function waitForError(stream: { emitToThread: jest.Mock }) {
  return new Promise<Extract<AiStreamEvent, { type: 'error' }>>((resolve) => {
    stream.emitToThread.mockImplementation((_threadId: string, event: AiStreamEvent) => {
      if (event.type === 'error') resolve(event)
    })
  })
}

describe('AiChatService', () => {
  it('allows students and selects the student prompt and registry', async () => {
    const { service, provider, registry, stream, store } = makeChat()
    const student = { id: 'student-1', role: 'student' as const }
    const done = waitForDone(stream)

    const result = await service.start(student, { message: 'what is my attendance standing?' })
    await done

    expect(registry.toOpenAiTools).toHaveBeenCalledWith('student')
    const sent = provider.chat.mock.calls[0][0] as Array<{ role: string; content: string }>
    expect(sent[0]).toEqual({ role: 'system', content: STUDENT_SYSTEM_PROMPT })
    const stored = store.get(`ai:thread:${result.threadId}`) as { role: string; userId: string }
    expect(stored).toMatchObject({ role: 'student', userId: 'student-1' })
  })

  it('validates messages before consuming the daily quota', async () => {
    const { service, redis } = makeChat()

    await expect(service.start(teacher as never, { message: 'x'.repeat(2_001) })).rejects.toThrow('Validation failed')
    expect(redis.consumeRateLimit).not.toHaveBeenCalled()
  })

  it('enforces the per-user daily message cap', async () => {
    const { service, redis } = makeChat()
    redis.consumeRateLimit.mockResolvedValue(false)

    let error: unknown
    try {
      await service.start(teacher as never, { message: 'hello' })
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(429)
    expect(redis.consumeRateLimit).toHaveBeenCalledWith(
      expect.stringMatching(/^ai:chat:teacher-1:\d{4}-\d{2}-\d{2}$/),
      100,
      86_400,
    )
  })

  it('returns 503 when the provider is not configured', async () => {
    const { service, provider } = makeChat()
    provider.describe.mockResolvedValue({ enabled: false, reason: 'Assistant is not configured' })

    await expect(service.start(teacher as never, { message: 'hello' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })

  it('rejects a thread owned by another user', async () => {
    const { service, store } = makeChat()
    store.set('ai:thread:thread-1', {
      id: 'thread-1',
      userId: otherTeacher.id,
      role: 'teacher',
      messages: [],
      createdAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
    })

    await expect(service.getThread(teacher as never, 'thread-1')).rejects.toBeInstanceOf(ForbiddenException)
    await expect(service.start(teacher as never, { message: 'hi', threadId: 'thread-1' })).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('persists the thread shape with 7-day TTL and strips ownership from reads', async () => {
    const { service, store, redis, stream, audit } = makeChat()
    const done = waitForDone(stream)

    const result = await service.start(teacher as never, { message: 'hello' })
    const message = await done
    const stored = store.get(`ai:thread:${result.threadId}`) as {
      userId: string
      role: string
      messages: AiChatMessage[]
    }

    expect(message.content).toBe('Hello')
    expect(redis.setJson).toHaveBeenCalledWith(`ai:thread:${result.threadId}`, expect.anything(), 604_800)
    expect(stored.userId).toBe('teacher-1')
    expect(stored.role).toBe('teacher')
    expect(stored.messages).toHaveLength(2)
    expect(stored.messages[0]).toMatchObject({ threadId: result.threadId, role: 'user', content: 'hello' })
    expect(stored.messages[1]).toMatchObject({
      id: result.messageId,
      threadId: result.threadId,
      role: 'assistant',
      content: 'Hello',
    })

    const thread = await service.getThread(teacher as never, result.threadId)
    expect(thread).not.toHaveProperty('userId')
    expect(thread).not.toHaveProperty('role')
    expect(thread.messages).toHaveLength(2)
    expect(audit.recordChatRun).toHaveBeenCalledWith(teacher, result.threadId, 'succeeded', {
      model: 'test-model',
      toolCount: 0,
    })
  })

  it('executes a tool call, feeds the result back, and completes the assistant message', async () => {
    const { service, provider, registry, stream, audit } = makeChat()
    registry.execute.mockResolvedValue({ result: { count: 1 }, attachments: [masterListAttachment] })
    provider.chat
      .mockImplementationOnce(async (...args: unknown[]) => {
        const onDelta = args[2] as (text: string) => void
        onDelta('Looking it up')
        return {
          content: 'Looking it up',
          toolCalls: [{ id: 'call_1', name: 'find_sections', arguments: '{"query":"math"}' }],
        }
      })
      .mockResolvedValueOnce({ content: 'The file is ready.', toolCalls: [] })
    const done = waitForDone(stream)

    const result = await service.start(teacher as never, { message: 'find math' })
    const message = await done

    expect(registry.execute).toHaveBeenCalledWith(
      'teacher',
      teacher,
      'find_sections',
      { query: 'math' },
      result.threadId,
    )
    const secondCall = provider.chat.mock.calls[1]
    const messages = secondCall[0] as Array<{ role: string; content?: string | null; tool_call_id?: string }>
    expect(messages[0]).toMatchObject({ role: 'system' })
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'find_sections', arguments: '{"query":"math"}' },
            },
          ],
        }),
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'call_1',
          content: JSON.stringify({ count: 1 }),
        }),
      ]),
    )
    expect(message).toMatchObject({
      id: result.messageId,
      content: 'The file is ready.',
      attachments: [masterListAttachment],
      toolInvocations: [{ tool: 'find_sections', outcome: 'succeeded' }],
    })
    expect(stream.emitToThread).toHaveBeenCalledWith(result.threadId, {
      type: 'delta',
      threadId: result.threadId,
      messageId: result.messageId,
      text: 'Looking it up',
    })
    expect(audit.recordChatRun).toHaveBeenCalledWith(teacher, result.threadId, 'succeeded', {
      model: 'test-model',
      toolCount: 1,
    })
  })

  it('keeps only the latest 30 messages and sends at most 20 to the provider', async () => {
    const { service, provider, stream, store } = makeChat()
    const seedMessages: AiChatMessage[] = Array.from({ length: 30 }, (_, index) => ({
      id: `m-${index}`,
      threadId: 'thread-1',
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message ${index}`,
      createdAt: '2026-10-26T00:00:00.000Z',
      ...(index === 29
        ? { attachments: [masterListAttachment], toolInvocations: [{ tool: 'x', outcome: 'succeeded' }] }
        : {}),
    }))
    store.set('ai:thread:thread-1', {
      id: 'thread-1',
      userId: teacher.id,
      role: 'teacher',
      messages: seedMessages,
      createdAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
    })
    const done = waitForDone(stream)

    const result = await service.start(teacher as never, { message: 'latest', threadId: 'thread-1' })
    await done

    const persisted = store.get('ai:thread:thread-1') as { messages: AiChatMessage[] }
    expect(persisted.messages).toHaveLength(30)
    expect(persisted.messages.at(-2)).toMatchObject({ role: 'user', content: 'latest' })
    expect(persisted.messages.at(-1)).toMatchObject({ id: result.messageId, role: 'assistant' })

    const sent = provider.chat.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(sent).toHaveLength(21)
    expect(sent[0]).toEqual({ role: 'system', content: expect.any(String) })
    for (const message of sent) {
      expect(Object.keys(message).sort()).toEqual(['content', 'role'])
    }
  })

  it('persists a short error message and emits an error event on provider failure', async () => {
    const { service, provider, stream, store, audit } = makeChat()
    provider.chat.mockRejectedValue(new Error('provider down'))
    const errorEvent = waitForError(stream)

    const result = await service.start(teacher as never, { message: 'hello' })
    const event = await errorEvent

    expect(event).toEqual({
      type: 'error',
      threadId: result.threadId,
      messageId: result.messageId,
      message: 'The assistant could not complete that request.',
    })
    const thread = await service.getThread(teacher as never, result.threadId)
    expect(thread.messages[1]).toMatchObject({
      id: result.messageId,
      content: 'The assistant could not complete that request.',
    })
    expect(audit.recordChatRun).toHaveBeenCalledWith(teacher, result.threadId, 'failed', {
      model: 'test-model',
      toolCount: 0,
    })
    expect(store.get('ai:user-threads:teacher-1')).toEqual([
      expect.objectContaining({ id: result.threadId, title: 'hello' }),
    ])
  })

  it('indexes a new thread by its first user message and refreshes it on completion', async () => {
    const { service, provider, redis, stream, store } = makeChat()
    let releaseChat: (() => void) | undefined
    provider.chat.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseChat = () => resolve({ content: 'Reply', toolCalls: [] })
        }),
    )
    const done = waitForDone(stream)

    const result = await service.start(teacher as never, { message: 'A'.repeat(70) })

    const indexKey = 'ai:user-threads:teacher-1'
    const created = store.get(indexKey) as AiThreadSummary[]
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ id: result.threadId, title: 'A'.repeat(60) })

    releaseChat?.()
    await done

    const completed = store.get(indexKey) as AiThreadSummary[]
    const stored = store.get(`ai:thread:${result.threadId}`) as { updatedAt: string }
    expect(completed).toHaveLength(1)
    expect(completed[0]).toMatchObject({ id: result.threadId, title: 'A'.repeat(60) })
    expect(completed[0].updatedAt).toBe(stored.updatedAt)
    expect(redis.setJson.mock.calls.filter(([key]) => key === indexKey)).toHaveLength(2)
  })

  it('keeps the index newest-first and caps it at 20 conversations', async () => {
    const { service, store, stream } = makeChat()
    const seeded: AiThreadSummary[] = Array.from({ length: 20 }, (_, index) => ({
      id: `seed-${index}`,
      title: `Seed ${index}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }))
    store.set('ai:user-threads:teacher-1', seeded)
    const done = waitForDone(stream)

    const result = await service.start(teacher as never, { message: 'Newest conversation' })
    await done

    const index = store.get('ai:user-threads:teacher-1') as AiThreadSummary[]
    expect(index).toHaveLength(20)
    expect(index[0].id).toBe(result.threadId)
    expect(index.map((entry) => entry.id)).toContain('seed-19')
    expect(index.map((entry) => entry.id)).not.toContain('seed-0')
  })

  it('uses a default title when a thread has no user message', async () => {
    const { service, store } = makeChat()
    const now = '2026-10-26T00:00:00.000Z'

    await (service as any).saveThread({
      id: 'thread-empty',
      userId: teacher.id,
      role: 'teacher',
      messages: [],
      createdAt: now,
      updatedAt: now,
    })

    expect(store.get('ai:user-threads:teacher-1')).toEqual([
      { id: 'thread-empty', title: 'New conversation', createdAt: now, updatedAt: now },
    ])
  })

  it('lists only the signed-in user index, newest-first, and drops malformed entries', async () => {
    const { service, store } = makeChat()
    const older: AiThreadSummary = {
      id: 'older',
      title: 'Older',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }
    const newer: AiThreadSummary = {
      id: 'newer',
      title: 'Newer',
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    }
    store.set('ai:user-threads:teacher-1', [
      older,
      null,
      { id: 'missing-fields' },
      { id: 'bad-date', title: 'Bad', createdAt: 'nope', updatedAt: newer.updatedAt },
      { id: 'bad-title', title: 42, createdAt: older.createdAt, updatedAt: older.updatedAt },
      newer,
      { ...older, title: 'Duplicate' },
    ])
    store.set('ai:user-threads:teacher-2', [
      { id: 'foreign', title: 'Foreign', createdAt: older.createdAt, updatedAt: older.updatedAt },
    ])

    await expect(service.listThreads(teacher as never)).resolves.toEqual([newer, older])
    await expect(service.listThreads({ id: 'teacher-3', role: 'teacher' } as never)).resolves.toEqual([])
  })

  it('deletes an owned thread, removes its index summary, and audits the deletion', async () => {
    const { service, store, audit } = makeChat()
    const now = '2026-10-26T00:00:00.000Z'
    store.set('ai:thread:thread-1', {
      id: 'thread-1',
      userId: teacher.id,
      role: 'teacher',
      messages: [],
      createdAt: now,
      updatedAt: now,
    })
    store.set('ai:user-threads:teacher-1', [
      { id: 'thread-1', title: 'Hello', createdAt: now, updatedAt: now },
      { id: 'thread-2', title: 'Other', createdAt: now, updatedAt: now },
    ])

    await expect(service.deleteThread(teacher as never, 'thread-1')).resolves.toBe(true)

    expect(store.has('ai:thread:thread-1')).toBe(false)
    expect(store.get('ai:user-threads:teacher-1')).toEqual([
      { id: 'thread-2', title: 'Other', createdAt: now, updatedAt: now },
    ])
    expect(audit.recordThreadDelete).toHaveBeenCalledWith(teacher, 'thread-1', 'succeeded')
  })

  it('treats deleting an already-missing thread as idempotent', async () => {
    const { service, audit } = makeChat()

    await expect(service.deleteThread(teacher as never, 'gone')).resolves.toBe(true)
    await expect(service.deleteThread(teacher as never, 'gone')).resolves.toBe(true)
    expect(audit.recordThreadDelete).toHaveBeenCalledTimes(2)
  })

  it('does not delete or reveal another user thread', async () => {
    const { service, store, audit } = makeChat()
    const now = '2026-10-26T00:00:00.000Z'
    store.set('ai:thread:thread-1', {
      id: 'thread-1',
      userId: otherTeacher.id,
      role: 'teacher',
      messages: [],
      createdAt: now,
      updatedAt: now,
    })
    store.set('ai:user-threads:teacher-2', [{ id: 'thread-1', title: 'Foreign', createdAt: now, updatedAt: now }])

    await expect(service.deleteThread(teacher as never, 'thread-1')).rejects.toBeInstanceOf(NotFoundException)

    expect(store.has('ai:thread:thread-1')).toBe(true)
    expect(store.get('ai:user-threads:teacher-2')).toHaveLength(1)
    expect(store.has('ai:user-threads:teacher-1')).toBe(false)
    expect(audit.recordThreadDelete).toHaveBeenCalledWith(teacher, 'thread-1', 'failed')
  })

  it('regenerates the last user turn without persisting a duplicate user message', async () => {
    const { service, provider, stream, store, audit } = makeChat()
    const firstDone = waitForDone(stream)
    const created = await service.start(teacher as never, { message: 'original question' })
    await firstDone

    provider.chat.mockResolvedValue({ content: 'Fresh reply', toolCalls: [] })
    const regeneratedDone = waitForDone(stream)
    const result = await service.start(teacher as never, {
      message: 'different wording',
      threadId: created.threadId,
      regenerate: true,
    })
    const reply = await regeneratedDone

    expect(result.threadId).toBe(created.threadId)
    expect(reply.content).toBe('Fresh reply')
    const stored = store.get(`ai:thread:${created.threadId}`) as { messages: AiChatMessage[] }
    expect(stored.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(stored.messages[0]).toMatchObject({ role: 'user', content: 'original question' })
    expect(stored.messages[1]).toMatchObject({
      id: result.messageId,
      role: 'assistant',
      content: 'Fresh reply',
    })

    const history = provider.chat.mock.calls.at(-1)?.[0] as Array<{ role: string; content: string }>
    expect(history.filter((message) => message.role === 'user')).toHaveLength(1)
    expect(history.at(-1)).toEqual({ role: 'user', content: 'original question' })

    const index = store.get('ai:user-threads:teacher-1') as AiThreadSummary[]
    expect(index).toHaveLength(1)
    expect(index[0]).toMatchObject({ id: created.threadId, title: 'original question' })
    expect(audit.recordChatRun).toHaveBeenCalledWith(teacher, created.threadId, 'succeeded', {
      model: 'test-model',
      toolCount: 0,
    })
  })

  it('requires a thread and a user turn to regenerate', async () => {
    const { service, store, locks } = makeChat()

    await expect(service.start(teacher as never, { message: 'retry', regenerate: true })).rejects.toBeInstanceOf(
      BadRequestException,
    )

    const now = '2026-10-26T00:00:00.000Z'
    store.set('ai:thread:empty-thread', {
      id: 'empty-thread',
      userId: teacher.id,
      role: 'teacher',
      messages: [],
      createdAt: now,
      updatedAt: now,
    })
    await expect(
      service.start(teacher as never, { message: 'retry', threadId: 'empty-thread', regenerate: true }),
    ).rejects.toThrow('Nothing to regenerate')

    expect(store.get('ai:thread:empty-thread')).toMatchObject({ messages: [] })
    expect(locks.size).toBe(0)
  })

  describe('per-thread send lock', () => {
    it('rejects a second send while a reply is being drafted for the same conversation', async () => {
      const { service, provider, stream, store, redis, locks } = makeChat()
      let releaseChat: (() => void) | undefined
      provider.chat.mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseChat = () => resolve({ content: 'Reply', toolCalls: [] })
          }),
      )
      const done = waitForDone(stream)

      const first = await service.start(teacher as never, { message: 'first' })
      await waitFor(() => locks.has(`ai:run:${first.threadId}`), 'the first run lock')

      let error: unknown
      try {
        await service.start(teacher as never, { message: 'second', threadId: first.threadId })
      } catch (caught) {
        error = caught
      }

      expect(error).toBeInstanceOf(ConflictException)
      expect((error as ConflictException).getStatus()).toBe(409)
      expect((error as ConflictException).message).toBe('A reply is already being drafted for this conversation')
      // The rejected send must not leave a dangling user/assistant turn behind.
      const duringConflict = store.get(`ai:thread:${first.threadId}`) as { messages: AiChatMessage[] }
      expect(duringConflict.messages).toHaveLength(2)

      releaseChat?.()
      await done
      await waitFor(() => !locks.has(`ai:run:${first.threadId}`), 'the first run lock release')
      expect(redis.releaseLock).toHaveBeenCalledWith(`ai:run:${first.threadId}`, expect.any(String))
    })

    it('releases the lock after a failed run so the same conversation can be retried', async () => {
      const { service, provider, stream, redis, locks } = makeChat()
      provider.chat.mockRejectedValueOnce(new Error('provider down'))
      const failed = waitForError(stream)

      const first = await service.start(teacher as never, { message: 'hello' })
      await failed
      await waitFor(() => !locks.has(`ai:run:${first.threadId}`), 'the failed run lock release')
      expect(redis.releaseLock).toHaveBeenCalledWith(`ai:run:${first.threadId}`, expect.any(String))

      const done = waitForDone(stream)
      const retry = await service.start(teacher as never, { message: 'try again', threadId: first.threadId })
      await done

      expect(retry.threadId).toBe(first.threadId)
      await waitFor(() => !locks.has(`ai:run:${first.threadId}`), 'the retry lock release')
    })

    it('does not block sends on other conversations', async () => {
      const { service, provider, locks } = makeChat()
      let releaseFirst: (() => void) | undefined
      provider.chat
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseFirst = () => resolve({ content: 'First reply', toolCalls: [] })
            }),
        )
        .mockResolvedValue({ content: 'Second reply', toolCalls: [] })

      const first = await service.start(teacher as never, { message: 'first' })
      const second = await service.start(teacher as never, { message: 'second' })

      expect(second.threadId).not.toBe(first.threadId)
      await waitFor(() => !locks.has(`ai:run:${second.threadId}`), 'the second run lock release')
      expect(locks.get(`ai:run:${first.threadId}`)).toBeDefined()

      releaseFirst?.()
      await waitFor(() => !locks.has(`ai:run:${first.threadId}`), 'the first run lock release')
    })

    it('applies the same lock to regenerate requests', async () => {
      const { service, provider, stream, store, locks } = makeChat()
      const firstDone = waitForDone(stream)
      const created = await service.start(teacher as never, { message: 'original question' })
      await firstDone
      await waitFor(() => !locks.has(`ai:run:${created.threadId}`), 'the initial run lock release')

      let releaseRegenerate: (() => void) | undefined
      provider.chat.mockImplementation(
        () =>
          new Promise((resolve) => {
            releaseRegenerate = () => resolve({ content: 'Fresh reply', toolCalls: [] })
          }),
      )
      const regeneratedDone = waitForDone(stream)
      const regenerated = await service.start(teacher as never, {
        message: 'original question',
        threadId: created.threadId,
        regenerate: true,
      })

      await expect(
        service.start(teacher as never, {
          message: 'original question',
          threadId: created.threadId,
          regenerate: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException)

      releaseRegenerate?.()
      await regeneratedDone
      await waitFor(() => !locks.has(`ai:run:${created.threadId}`), 'the regenerate lock release')

      expect(regenerated.threadId).toBe(created.threadId)
      const stored = store.get(`ai:thread:${created.threadId}`) as { messages: AiChatMessage[] }
      expect(stored.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    })
  })
})
