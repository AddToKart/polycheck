import { Injectable } from '@nestjs/common'
import { AI_THREAD_STREAM_EVENT, type AiStreamEvent } from '@polycheck/shared'
import type { Server } from 'socket.io'

export function aiThreadRoom(threadId: string) {
  return `ai:thread:${threadId}`
}

@Injectable()
export class AiStreamService {
  private server: Server | null = null

  attach(server: Server) {
    this.server = server
  }

  emitToThread(threadId: string, event: AiStreamEvent) {
    this.server?.to(aiThreadRoom(threadId)).emit(AI_THREAD_STREAM_EVENT, event)
  }

  isSubscribed(threadId: string): boolean {
    if (!this.server) return false
    const server = this.server as unknown as {
      adapter?: { rooms?: Map<string, Set<string>> }
      sockets?: { adapter?: { rooms?: Map<string, Set<string>> } }
    }
    const room = aiThreadRoom(threadId)
    return Boolean(server.adapter?.rooms?.get(room)?.size ?? server.sockets?.adapter?.rooms?.get(room)?.size)
  }
}
