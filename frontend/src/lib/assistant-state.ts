import type { AiChatMessage, AiStreamEvent } from '@polycheck/shared'

/**
 * Pure chat-thread state transitions for the assistant stream. Keeping these
 * outside the component makes the cross-thread/message guards testable without
 * a live Socket.IO connection.
 */

export function upsertMessage(messages: AiChatMessage[], message: AiChatMessage): AiChatMessage[] {
  const index = messages.findIndex((existing) => existing.id === message.id)
  if (index === -1) return [...messages, message]
  const next = [...messages]
  next[index] = message
  return next
}

export function appendDelta(
  messages: AiChatMessage[],
  threadId: string,
  messageId: string,
  text: string,
): AiChatMessage[] {
  if (!text) return messages
  const index = messages.findIndex((message) => message.id === messageId)
  if (index === -1) return messages
  const target = messages[index]
  if (target.threadId !== threadId || target.role !== 'assistant') return messages
  const next = [...messages]
  next[index] = { ...target, content: `${target.content}${text}` }
  return next
}

export interface AssistantStreamGuard {
  threadId: string | null
  messageId: string | null
}

export interface AssistantStreamUpdate {
  messages: AiChatMessage[]
  /** False for events from another thread/message; callers should ignore them. */
  handled: boolean
  done: boolean
  error?: string
}

export function applyStreamEvent(
  messages: AiChatMessage[],
  event: AiStreamEvent,
  guard: AssistantStreamGuard,
): AssistantStreamUpdate {
  if (!guard.threadId || event.threadId !== guard.threadId) {
    return { messages, handled: false, done: false }
  }

  if (event.type === 'error') {
    if (guard.messageId && event.messageId && event.messageId !== guard.messageId) {
      return { messages, handled: false, done: false }
    }
    return { messages, handled: true, done: true, error: event.message }
  }

  if (guard.messageId) {
    const eventMessageId = event.type === 'delta' ? event.messageId : event.message.id
    if (eventMessageId !== guard.messageId) {
      return { messages, handled: false, done: false }
    }
  }

  if (event.type === 'delta') {
    return {
      messages: appendDelta(messages, event.threadId, event.messageId, event.text),
      handled: true,
      done: false,
    }
  }

  return {
    messages: upsertMessage(messages, event.message),
    handled: true,
    done: true,
  }
}
