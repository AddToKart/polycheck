import type { AiChatMessage, AiThreadSummary } from '@polycheck/shared'

/** Pure assistant-panel helpers (geometry, transcript rows, thread state). */

export type AssistantRole = 'teacher' | 'super_admin' | 'student'
export type AssistantOverlayGeometry = 'dock' | 'theater'
export type AssistantChatGeometry = AssistantOverlayGeometry | 'focus'

export const ASSISTANT_GEOMETRY_STORAGE_KEY = 'polycheck-assistant-geometry'
export const THREAD_STORAGE_PREFIX = 'polycheck-assistant-thread:'
export const TURN_DIVIDER_MS = 5 * 60 * 1000
export const STICK_THRESHOLD_PX = 72

export function isAssistantRole(role: string | null | undefined): role is AssistantRole {
  return role === 'teacher' || role === 'super_admin' || role === 'student'
}

function safeStorage(target?: Storage | null): Storage | null {
  if (target !== undefined) return target
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readGeometryPreference(target?: Storage | null): AssistantOverlayGeometry {
  const store = safeStorage(target)
  if (!store) return 'dock'
  try {
    return store.getItem(ASSISTANT_GEOMETRY_STORAGE_KEY) === 'theater' ? 'theater' : 'dock'
  } catch {
    return 'dock'
  }
}

export function writeGeometryPreference(
  geometry: AssistantOverlayGeometry,
  target?: Storage | null,
): void {
  const store = safeStorage(target)
  if (!store) return
  try {
    store.setItem(ASSISTANT_GEOMETRY_STORAGE_KEY, geometry)
  } catch {
    // Preferences are best-effort when storage is blocked.
  }
}

export function threadStorageKey(userId: string): string {
  return `${THREAD_STORAGE_PREFIX}${userId}`
}

export function readThreadId(userId: string, target?: Storage | null): string | null {
  const store = safeStorage(target)
  if (!store) return null
  try {
    return store.getItem(threadStorageKey(userId))
  } catch {
    return null
  }
}

export function writeThreadId(userId: string, threadId: string, target?: Storage | null): void {
  const store = safeStorage(target)
  if (!store) return
  try {
    store.setItem(threadStorageKey(userId), threadId)
  } catch {
    // Chat still works for this page load when storage is blocked.
  }
}

export function clearThreadId(userId: string, target?: Storage | null): void {
  const store = safeStorage(target)
  if (!store) return
  try {
    store.removeItem(threadStorageKey(userId))
  } catch {
    // Nothing to do.
  }
}

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

/** True when the viewport is close enough to the end to keep following new content. */
export function isNearBottom(
  metrics: ScrollMetrics,
  threshold: number = STICK_THRESHOLD_PX,
): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= threshold
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function formatTurnDivider(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return time
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${day} · ${time}`
}

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const diff = Math.max(0, now - then)
  const minute = 60_000
  if (diff < minute) return 'Just now'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}m ago`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}h ago`
  const days = Math.floor(diff / (24 * 60 * minute))
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function deriveThreadTitle(messages: AiChatMessage[], maxLength = 60): string | null {
  const first = messages.find((message) => message.role === 'user' && message.content.trim())
  if (!first) return null
  const compact = first.content.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`
}

export function lastAssistantIndex(messages: AiChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') return index
  }
  return -1
}

export interface TranscriptMessageRow {
  kind: 'message'
  key: string
  message: AiChatMessage
  /** Consecutive same-role message inside the same 5-minute turn. */
  grouped: boolean
  /** Show the assistant avatar chip only at the start of a group. */
  showAvatar: boolean
  isLastAssistant: boolean
}

export interface TranscriptDividerRow {
  kind: 'divider'
  key: string
  label: string
}

export type TranscriptRow = TranscriptMessageRow | TranscriptDividerRow

export function buildTranscriptRows(
  messages: AiChatMessage[],
  now: Date = new Date(),
): TranscriptRow[] {
  const rows: TranscriptRow[] = []
  const lastAssistant = lastAssistantIndex(messages)
  let previous: AiChatMessage | null = null

  messages.forEach((message, index) => {
    const at = Date.parse(message.createdAt)
    const previousAt = previous ? Date.parse(previous.createdAt) : Number.NaN
    const newTurn =
      previous !== null &&
      Number.isFinite(at) &&
      Number.isFinite(previousAt) &&
      Math.abs(at - previousAt) > TURN_DIVIDER_MS

    if (newTurn) {
      rows.push({
        kind: 'divider',
        key: `divider-${message.id}`,
        label: formatTurnDivider(message.createdAt, now),
      })
    }

    rows.push({
      kind: 'message',
      key: message.id,
      message,
      grouped: previous !== null && previous.role === message.role && !newTurn,
      showAvatar: message.role === 'assistant' && (previous === null || previous.role !== message.role || newTurn),
      isLastAssistant: index === lastAssistant,
    })
    previous = message
  })

  return rows
}

export function sortThreads(threads: AiThreadSummary[]): AiThreadSummary[] {
  return [...threads].sort(
    (left, right) => (Date.parse(right.updatedAt) || 0) - (Date.parse(left.updatedAt) || 0),
  )
}

export function removeThread(
  threads: AiThreadSummary[],
  threadId: string,
): AiThreadSummary[] {
  return threads.filter((thread) => thread.id !== threadId)
}

/**
 * Reconcile a stopped reply against the authoritative server thread without
 * discarding locally streamed text the server has not persisted yet.
 */
export function reconcileStoppedThread(
  local: AiChatMessage[],
  server: AiChatMessage[],
): AiChatMessage[] {
  const serverIds = new Set(server.map((message) => message.id))
  const merged = server.map((message) => {
    const localMessage = local.find((candidate) => candidate.id === message.id)
    if (
      localMessage &&
      message.role === 'assistant' &&
      localMessage.content.length > message.content.length
    ) {
      return localMessage
    }
    return message
  })

  for (const message of local) {
    // Only carry local assistant text forward. The optimistic user bubble uses
    // a client id while the server stores the same turn under its own id, so
    // appending local user messages would duplicate the turn after a stop.
    if (
      message.role === 'assistant' &&
      !serverIds.has(message.id) &&
      message.content.trim()
    ) {
      merged.push(message)
    }
  }

  return merged
}

export function describeAssistantError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Unable to reach the assistant. Try again.'
}
