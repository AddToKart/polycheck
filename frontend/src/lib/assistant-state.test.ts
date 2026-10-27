import { describe, expect, it } from 'vitest'
import type { AiChatMessage } from '@polycheck/shared'
import { appendDelta, applyStreamEvent, upsertMessage } from './assistant-state'

function makeMessage(overrides: Partial<AiChatMessage> = {}): AiChatMessage {
  return {
    id: 'message-1',
    threadId: 'thread-1',
    role: 'assistant',
    content: '',
    createdAt: '2026-10-26T02:30:00.000Z',
    ...overrides,
  }
}

const guard = { threadId: 'thread-1', messageId: 'message-1' }

describe('assistant stream state', () => {
  it('appends deltas to the matching assistant message only', () => {
    const placeholder = makeMessage()
    const next = appendDelta([placeholder], 'thread-1', 'message-1', 'Hello')
    const again = appendDelta(next, 'thread-1', 'message-1', ' there')

    expect(again[0].content).toBe('Hello there')
    expect(again).toHaveLength(1)
  })

  it('ignores deltas for another thread, another message, or a non-assistant message', () => {
    const messages = [makeMessage(), makeMessage({ id: 'message-2' })]

    expect(appendDelta(messages, 'thread-2', 'message-1', 'ignored')).toBe(messages)
    expect(appendDelta(messages, 'thread-1', 'missing', 'ignored')).toBe(messages)

    const userMessage = makeMessage({ id: 'user-1', role: 'user', content: 'Hi' })
    expect(appendDelta([userMessage], 'thread-1', 'user-1', 'ignored')).toEqual([userMessage])
  })

  it('replaces an existing message in place and appends new messages', () => {
    const original = makeMessage({ content: '' })
    const replacement = makeMessage({ content: 'Complete reply' })

    expect(upsertMessage([original], replacement)).toEqual([replacement])

    const appended = upsertMessage([original], makeMessage({ id: 'message-2', content: 'Next' }))
    expect(appended).toHaveLength(2)
    expect(appended[1].content).toBe('Next')
  })

  it('ignores events from another thread or message', () => {
    const messages = [makeMessage()]

    const wrongThread = applyStreamEvent(
      messages,
      { type: 'delta', threadId: 'thread-2', messageId: 'message-1', text: 'ignored' },
      guard,
    )
    expect(wrongThread).toEqual({ messages, handled: false, done: false })

    const wrongMessage = applyStreamEvent(
      messages,
      { type: 'delta', threadId: 'thread-1', messageId: 'message-2', text: 'ignored' },
      guard,
    )
    expect(wrongMessage).toEqual({ messages, handled: false, done: false })

    const noThread = applyStreamEvent(
      messages,
      { type: 'delta', threadId: 'thread-1', messageId: 'message-1', text: 'ignored' },
      { threadId: null, messageId: 'message-1' },
    )
    expect(noThread).toEqual({ messages, handled: false, done: false })
  })

  it('applies deltas while the reply is streaming', () => {
    const placeholder = makeMessage()

    const update = applyStreamEvent(
      [placeholder],
      { type: 'delta', threadId: 'thread-1', messageId: 'message-1', text: 'Streaming ' },
      guard,
    )

    expect(update).toEqual({
      messages: [{ ...placeholder, content: 'Streaming ' }],
      handled: true,
      done: false,
    })
  })

  it('replaces the placeholder with the completed message (attachments and tools included)', () => {
    const placeholder = makeMessage()
    const completed = makeMessage({
      content: 'Here is the master list.',
      attachments: [
        {
          id: 'attachment-1',
          kind: 'master_list',
          format: 'pdf',
          label: 'Master list',
          filename: 'master-list.pdf',
          downloadPath: '/docs/master-list/section-1?format=pdf',
        },
      ],
      toolInvocations: [{ tool: 'get_section_master_list', outcome: 'succeeded' }],
    })

    const update = applyStreamEvent(
      [placeholder],
      { type: 'done', threadId: 'thread-1', message: completed },
      guard,
    )

    expect(update.done).toBe(true)
    expect(update.handled).toBe(true)
    expect(update.messages).toEqual([completed])
  })

  it('surfaces stream errors without discarding the transcript', () => {
    const placeholder = makeMessage({ content: 'Partial' })

    const update = applyStreamEvent(
      [placeholder],
      {
        type: 'error',
        threadId: 'thread-1',
        messageId: 'message-1',
        message: 'The assistant could not complete that request.',
      },
      guard,
    )

    expect(update).toEqual({
      messages: [placeholder],
      handled: true,
      done: true,
      error: 'The assistant could not complete that request.',
    })
  })

  it('ignores an error event for a different assistant message', () => {
    const messages = [makeMessage()]

    const update = applyStreamEvent(
      messages,
      { type: 'error', threadId: 'thread-1', messageId: 'message-2', message: 'ignored' },
      guard,
    )

    expect(update).toEqual({ messages, handled: false, done: false })
  })
})
