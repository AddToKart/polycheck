import { beforeEach, describe, expect, it } from 'vitest'
import type { AiChatMessage, AiThreadSummary } from '@polycheck/shared'
import {
  ASSISTANT_GEOMETRY_STORAGE_KEY,
  buildTranscriptRows,
  deriveThreadTitle,
  formatRelativeTime,
  isNearBottom,
  readGeometryPreference,
  reconcileStoppedThread,
  removeThread,
  sortThreads,
  writeGeometryPreference,
} from './assistant-utils'

function message(
  overrides: Partial<AiChatMessage> & Pick<AiChatMessage, 'id' | 'role' | 'content' | 'createdAt'>,
): AiChatMessage {
  return { threadId: 'thread-1', ...overrides }
}

describe('geometry preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to dock and ignores invalid values', () => {
    expect(readGeometryPreference(window.localStorage)).toBe('dock')
    window.localStorage.setItem(ASSISTANT_GEOMETRY_STORAGE_KEY, 'focus-ish')
    expect(readGeometryPreference(window.localStorage)).toBe('dock')
  })

  it('round-trips the theater preference', () => {
    writeGeometryPreference('theater', window.localStorage)
    expect(window.localStorage.getItem(ASSISTANT_GEOMETRY_STORAGE_KEY)).toBe('theater')
    expect(readGeometryPreference(window.localStorage)).toBe('theater')
  })

  it('falls back to dock when storage is unavailable', () => {
    expect(readGeometryPreference(null)).toBe('dock')
    expect(() => writeGeometryPreference('theater', null)).not.toThrow()
  })
})

describe('smart scroll helper', () => {
  it('sticks only when the viewport is close to the end', () => {
    expect(isNearBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true)
    expect(isNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 400 })).toBe(false)
  })

  it('honours a custom threshold', () => {
    expect(
      isNearBottom({ scrollTop: 560, scrollHeight: 1000, clientHeight: 400 }, 50),
    ).toBe(true)
    expect(
      isNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 400 }, 50),
    ).toBe(false)
  })
})

describe('transcript rows', () => {
  it('groups consecutive same-role messages inside a turn', () => {
    const rows = buildTranscriptRows([
      message({
        id: 'm1',
        role: 'assistant',
        content: 'First',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      message({
        id: 'm2',
        role: 'assistant',
        content: 'Second',
        createdAt: '2026-01-01T10:01:00.000Z',
      }),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ kind: 'message', grouped: false, showAvatar: true })
    expect(rows[1]).toMatchObject({ kind: 'message', grouped: true, showAvatar: false })
  })

  it('inserts a time divider between turns older than five minutes', () => {
    const rows = buildTranscriptRows([
      message({
        id: 'm1',
        role: 'user',
        content: 'Hello',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      message({
        id: 'm2',
        role: 'assistant',
        content: 'Hi',
        createdAt: '2026-01-01T10:06:00.000Z',
      }),
      message({
        id: 'm3',
        role: 'assistant',
        content: 'Anything else?',
        createdAt: '2026-01-01T10:07:00.000Z',
      }),
    ])

    expect(rows.map((row) => row.kind)).toEqual(['message', 'divider', 'message', 'message'])
    expect(rows[2]).toMatchObject({ kind: 'message', grouped: false, showAvatar: true })
    expect(rows[3]).toMatchObject({ kind: 'message', grouped: true })
  })

  it('marks the last assistant message for regenerate', () => {
    const rows = buildTranscriptRows([
      message({ id: 'm1', role: 'user', content: 'Q', createdAt: '2026-01-01T10:00:00.000Z' }),
      message({ id: 'm2', role: 'assistant', content: 'A', createdAt: '2026-01-01T10:00:10.000Z' }),
      message({ id: 'm3', role: 'user', content: 'Q2', createdAt: '2026-01-01T10:00:20.000Z' }),
    ])

    const assistantRow = rows.find(
      (row) => row.kind === 'message' && row.message.id === 'm2',
    )
    expect(assistantRow).toMatchObject({ isLastAssistant: true })
  })
})

describe('thread summaries', () => {
  const threads: AiThreadSummary[] = [
    {
      id: 'older',
      title: 'Older chat',
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'newer',
      title: 'Newer chat',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T11:00:00.000Z',
    },
  ]

  it('orders newest-first by updatedAt without mutating the input', () => {
    const sorted = sortThreads(threads)
    expect(sorted.map((thread) => thread.id)).toEqual(['newer', 'older'])
    expect(threads.map((thread) => thread.id)).toEqual(['older', 'newer'])
  })

  it('removes a deleted thread from the list', () => {
    expect(removeThread(threads, 'newer').map((thread) => thread.id)).toEqual(['older'])
    expect(removeThread(threads, 'missing')).toHaveLength(2)
  })

  it('formats relative timestamps for the rail', () => {
    const now = Date.parse('2026-01-02T12:00:00.000Z')
    expect(formatRelativeTime('2026-01-02T11:59:30.000Z', now)).toBe('Just now')
    expect(formatRelativeTime('2026-01-02T11:30:00.000Z', now)).toBe('30m ago')
    expect(formatRelativeTime('2026-01-02T08:00:00.000Z', now)).toBe('4h ago')
    expect(formatRelativeTime('2026-01-01T11:00:00.000Z', now)).toBe('Yesterday')
  })
})

describe('thread titles and stopped reconciliation', () => {
  it('derives and truncates the header title from the first user message', () => {
    expect(
      deriveThreadTitle([
        message({
          id: 'm1',
          role: 'user',
          content: '  Why was I marked absent in my Physics class last Tuesday?  ',
          createdAt: '2026-01-01T10:00:00.000Z',
        }),
      ]),
    ).toBe('Why was I marked absent in my Physics class last Tuesday?')

    const long = deriveThreadTitle([
      message({
        id: 'm1',
        role: 'user',
        content: 'a'.repeat(80),
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
    ])
    expect(long).toHaveLength(60)
    expect(long?.endsWith('…')).toBe(true)
    expect(deriveThreadTitle([])).toBeNull()
  })

  it('keeps locally streamed text the server has not persisted', () => {
    const local = [
      message({ id: 'm1', role: 'user', content: 'Q', createdAt: '2026-01-01T10:00:00.000Z' }),
      message({
        id: 'm2',
        role: 'assistant',
        content: 'Partial reply that is longer',
        createdAt: '2026-01-01T10:00:01.000Z',
      }),
    ]
    const server = [
      message({ id: 'm1', role: 'user', content: 'Q', createdAt: '2026-01-01T10:00:00.000Z' }),
      message({
        id: 'm2',
        role: 'assistant',
        content: 'Partial',
        createdAt: '2026-01-01T10:00:01.000Z',
      }),
    ]

    expect(reconcileStoppedThread(local, server)[1].content).toBe(
      'Partial reply that is longer',
    )
  })

  it('drops empty local drafts absent from the server thread', () => {
    const local = [
      message({
        id: 'draft',
        role: 'assistant',
        content: '',
        createdAt: '2026-01-01T10:00:01.000Z',
      }),
    ]
    expect(reconcileStoppedThread(local, [])).toEqual([])
  })

  it('does not duplicate the optimistic user turn when server ids differ', () => {
    const local = [
      message({
        id: 'local-user-1',
        role: 'user',
        content: 'Q',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      message({
        id: 'm2',
        role: 'assistant',
        content: 'Partial',
        createdAt: '2026-01-01T10:00:01.000Z',
      }),
    ]
    const server = [
      message({
        id: 'server-user-1',
        role: 'user',
        content: 'Q',
        createdAt: '2026-01-01T10:00:00.000Z',
      }),
      message({
        id: 'm2',
        role: 'assistant',
        content: 'Partial',
        createdAt: '2026-01-01T10:00:01.000Z',
      }),
    ]

    expect(reconcileStoppedThread(local, server).map((item) => item.id)).toEqual([
      'server-user-1',
      'm2',
    ])
  })
})
