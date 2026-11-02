import { AI_THREAD_STREAM_EVENT, type AiStreamEvent } from '@polycheck/shared'
import { AiStreamService } from './ai-stream.service'

function makeServer() {
  const emit = jest.fn()
  const server = {
    to: jest.fn().mockReturnValue({ emit }),
    adapter: { rooms: new Map<string, Set<string>>() },
  }
  return { server, emit }
}

describe('AiStreamService', () => {
  it('emits stream events to the per-thread room', () => {
    const { server, emit } = makeServer()
    const service = new AiStreamService()
    const event: AiStreamEvent = { type: 'delta', threadId: 'thread-1', messageId: 'message-1', text: 'Hi' }

    service.attach(server as never)
    service.emitToThread('thread-1', event)

    expect(server.to).toHaveBeenCalledWith('ai:thread:thread-1')
    expect(emit).toHaveBeenCalledWith(AI_THREAD_STREAM_EVENT, event)
  })

  it('reports whether a thread room has subscribers', () => {
    const { server } = makeServer()
    const service = new AiStreamService()

    expect(service.isSubscribed('thread-1')).toBe(false)
    service.attach(server as never)
    expect(service.isSubscribed('thread-1')).toBe(false)

    server.adapter.rooms.set('ai:thread:thread-1', new Set(['socket-1']))
    expect(service.isSubscribed('thread-1')).toBe(true)
  })

  it('does not throw when no server is attached', () => {
    const service = new AiStreamService()

    expect(() =>
      service.emitToThread('thread-1', { type: 'delta', threadId: 'thread-1', messageId: 'message-1', text: 'Hi' }),
    ).not.toThrow()
  })
})
