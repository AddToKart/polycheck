import type { AiChatMessage } from '@polycheck/shared'
import { appendDelta, applyStreamEvent, reconcileStoppedThread, upsertMessage } from '../lib/assistant-state'

const message = (overrides: Partial<AiChatMessage> = {}): AiChatMessage => ({
  id: 'msg-1',
  threadId: 'thread-1',
  role: 'assistant',
  content: '',
  createdAt: '2026-10-26T00:00:00.000Z',
  ...overrides,
})

describe('upsertMessage', () => {
  it('appends a message that is not in the thread yet', () => {
    const existing = message({ id: 'msg-1', content: 'Hello' })
    const incoming = message({ id: 'msg-2', content: 'World' })
    expect(upsertMessage([existing], incoming)).toEqual([existing, incoming])
  })

  it('replaces an existing message in place', () => {
    const placeholder = message({ id: 'msg-1', content: '' })
    const completed = message({ id: 'msg-1', content: 'Completed reply' })
    const next = upsertMessage([placeholder, message({ id: 'msg-2' })], completed)
    expect(next[0]).toEqual(completed)
    expect(next).toHaveLength(2)
  })
})

describe('appendDelta', () => {
  it('appends streamed text to the matching assistant message', () => {
    const next = appendDelta([message({ content: 'Hello' })], 'thread-1', 'msg-1', ' there')
    expect(next[0].content).toBe('Hello there')
  })

  it('returns the same array for empty text', () => {
    const messages = [message()]
    expect(appendDelta(messages, 'thread-1', 'msg-1', '')).toBe(messages)
  })

  it('ignores unknown message ids', () => {
    const messages = [message()]
    expect(appendDelta(messages, 'thread-1', 'missing', 'x')).toBe(messages)
  })

  it('ignores events from another thread', () => {
    const messages = [message()]
    expect(appendDelta(messages, 'thread-2', 'msg-1', 'x')).toBe(messages)
  })

  it('never appends to a user message', () => {
    const messages = [message({ role: 'user', content: 'Mine' })]
    expect(appendDelta(messages, 'thread-1', 'msg-1', 'x')).toBe(messages)
  })
})

describe('applyStreamEvent', () => {
  const guard = { threadId: 'thread-1', messageId: 'msg-1' }

  it('ignores cross-thread events', () => {
    const messages = [message()]
    const update = applyStreamEvent(messages, {
      type: 'delta',
      threadId: 'thread-2',
      messageId: 'msg-1',
      text: 'x',
    }, guard)
    expect(update).toEqual({ messages, handled: false, done: false })
  })

  it('appends a delta for the pending message', () => {
    const update = applyStreamEvent([message({ content: 'Hi' })], {
      type: 'delta',
      threadId: 'thread-1',
      messageId: 'msg-1',
      text: ' there',
    }, guard)
    expect(update.handled).toBe(true)
    expect(update.done).toBe(false)
    expect(update.messages[0].content).toBe('Hi there')
  })

  it('ignores deltas for a different message', () => {
    const messages = [message()]
    const update = applyStreamEvent(messages, {
      type: 'delta',
      threadId: 'thread-1',
      messageId: 'msg-other',
      text: 'x',
    }, guard)
    expect(update).toEqual({ messages, handled: false, done: false })
  })

  it('replaces the placeholder with the full message on done', () => {
    const placeholder = message({ content: 'partial' })
    const completed = message({
      content: 'Full reply',
      attachments: [{
        id: 'att-1',
        kind: 'master_list',
        format: 'pdf',
        label: 'Master list',
        filename: 'master-list.pdf',
        downloadPath: '/docs/master-list/sec-1?format=pdf',
      }],
      toolInvocations: [{ tool: 'get_section_master_list', outcome: 'succeeded' }],
    })
    const update = applyStreamEvent([placeholder], {
      type: 'done',
      threadId: 'thread-1',
      message: completed,
    }, guard)
    expect(update.handled).toBe(true)
    expect(update.done).toBe(true)
    expect(update.error).toBeUndefined()
    expect(update.messages).toEqual([completed])
  })

  it('ignores done for a different message', () => {
    const messages = [message()]
    const update = applyStreamEvent(messages, {
      type: 'done',
      threadId: 'thread-1',
      message: message({ id: 'msg-other', content: 'other' }),
    }, guard)
    expect(update).toEqual({ messages, handled: false, done: false })
  })

  it('surfaces a retryable stream error and finishes the run', () => {
    const messages = [message({ content: 'partial' })]
    const update = applyStreamEvent(messages, {
      type: 'error',
      threadId: 'thread-1',
      messageId: 'msg-1',
      message: 'Provider timed out',
    }, guard)
    expect(update).toEqual({
      messages,
      handled: true,
      done: true,
      error: 'Provider timed out',
    })
  })

  it('ignores an error scoped to a different message', () => {
    const messages = [message()]
    const update = applyStreamEvent(messages, {
      type: 'error',
      threadId: 'thread-1',
      messageId: 'msg-other',
      message: 'Provider timed out',
    }, guard)
    expect(update).toEqual({ messages, handled: false, done: false })
  })

  it('accepts an error without a message id for the active thread', () => {
    const update = applyStreamEvent([message()], {
      type: 'error',
      threadId: 'thread-1',
      message: 'Assistant failed',
    }, guard)
    expect(update).toMatchObject({ handled: true, done: true, error: 'Assistant failed' })
  })

  it('does not require a pending message id for deltas', () => {
    const update = applyStreamEvent([message({ content: '' })], {
      type: 'delta',
      threadId: 'thread-1',
      messageId: 'msg-1',
      text: 'hello',
    }, { threadId: 'thread-1', messageId: null })
    expect(update.handled).toBe(true)
    expect(update.messages[0].content).toBe('hello')
  })
})

describe('reconcileStoppedThread', () => {
  const userMessage = (id: string, content: string): AiChatMessage =>
    message({ id, role: 'user', content })

  it('returns the authoritative server thread order', () => {
    const server = [
      userMessage('server-user-1', 'List my sections'),
      message({ id: 'server-assistant-1', content: 'Here are your sections.' }),
    ]
    expect(reconcileStoppedThread([], server)).toEqual(server)
  })

  it('keeps locally streamed assistant text that is longer than the server copy', () => {
    const local = [
      userMessage('local-user-1', 'List my sections'),
      message({ id: 'server-assistant-1', content: 'Here are your sections. Intro' }),
    ]
    const serverMessage = message({
      id: 'server-assistant-1',
      content: 'Here are your sections.',
      attachments: [{
        id: 'att-1',
        kind: 'master_list',
        format: 'pdf',
        label: 'Master list',
        filename: 'master-list.pdf',
        downloadPath: '/docs/master-list/sec-1?format=pdf',
      }],
      toolInvocations: [{ tool: 'get_section_master_list', outcome: 'succeeded' }],
    })
    const server = [userMessage('server-user-1', 'List my sections'), serverMessage]
    const merged = reconcileStoppedThread(local, server)
    expect(merged).toHaveLength(2)
    expect(merged[0].id).toBe('server-user-1')
    expect(merged[1]).toMatchObject({
      id: 'server-assistant-1',
      content: 'Here are your sections. Intro',
      attachments: serverMessage.attachments,
      toolInvocations: serverMessage.toolInvocations,
    })
  })

  it('prefers a longer authoritative server reply over the local partial', () => {
    const local = [message({ id: 'server-assistant-1', content: 'Partial' })]
    const server = [message({ id: 'server-assistant-1', content: 'Partial reply completed' })]
    expect(reconcileStoppedThread(local, server)[0].content).toBe('Partial reply completed')
  })

  it('never duplicates the optimistic user turn after a stop', () => {
    const local = [
      userMessage('local-user-1', 'List my sections'),
      message({ id: 'server-assistant-1', content: 'Partial' }),
    ]
    const server = [
      userMessage('server-user-1', 'List my sections'),
      message({ id: 'server-assistant-1', content: '' }),
    ]
    const merged = reconcileStoppedThread(local, server)
    expect(merged.map((item) => item.role)).toEqual(['user', 'assistant'])
    expect(merged.filter((item) => item.role === 'user')).toHaveLength(1)
  })

  it('carries an assistant draft the server has not persisted yet', () => {
    const local = [message({ id: 'local-assistant-1', content: 'Streamed but unpersisted' })]
    const server = [userMessage('server-user-1', 'List my sections')]
    const merged = reconcileStoppedThread(local, server)
    expect(merged).toHaveLength(2)
    expect(merged[1]).toMatchObject({ id: 'local-assistant-1', content: 'Streamed but unpersisted' })
  })

  it('drops empty local assistant placeholders the server has not persisted', () => {
    const local = [message({ id: 'local-assistant-1', content: '   ' })]
    expect(reconcileStoppedThread(local, [])).toEqual([])
  })
})
