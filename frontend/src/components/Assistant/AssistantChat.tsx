'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import type {
  AiCapabilities,
  AiChatMessage,
  AiStreamEvent,
  User,
} from '@polycheck/shared'
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Sparkles, Square } from 'lucide-react'
import { api } from '@/lib/api-client'
import { applyStreamEvent, upsertMessage } from '@/lib/assistant-state'
import { subscribeToAiThread } from '@/lib/realtime'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AttachmentCards } from './AttachmentCards'
import { AssistantShell } from './AssistantShell'
import { EmptyState } from './EmptyState'
import { Markdown } from './Markdown'
import { MessageActions } from './MessageActions'
import { ThreadsRail } from './ThreadsRail'
import { ToolActivityDisclosure } from './ToolActivityDisclosure'
import {
  buildTranscriptRows,
  clearThreadId,
  deriveThreadTitle,
  describeAssistantError,
  isAssistantRole,
  lastAssistantIndex,
  readThreadId,
  reconcileStoppedThread,
  writeThreadId,
  type AssistantChatGeometry,
  type AssistantOverlayGeometry,
  type AssistantRole,
  type TranscriptMessageRow,
} from './assistant-utils'
import { useIsDesktop, useStickToBottom } from './use-assistant-ui'
import { ASSISTANT_ROLE_COPY, starterPromptsFor } from './suggestions'

const REPLY_TIMEOUT_MS = 75_000

type RetryAction = { kind: 'send'; text: string } | { kind: 'regenerate' }

function TypingDots() {
  return (
    <span
      role="status"
      aria-label="Assistant is typing"
      className="inline-flex items-center gap-1 py-1"
    >
      <span className="h-1.5 w-1.5 animate-bounce bg-maroon/60 [animation-delay:-0.3s] motion-reduce:animate-none dark:bg-golden/60" />
      <span className="h-1.5 w-1.5 animate-bounce bg-maroon/60 [animation-delay:-0.15s] motion-reduce:animate-none dark:bg-golden/60" />
      <span className="h-1.5 w-1.5 animate-bounce bg-maroon/60 motion-reduce:animate-none dark:bg-golden/60" />
    </span>
  )
}

function messageTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function ChatMessageRow({
  row,
  streaming,
  stopped,
  canRegenerate,
  busy,
  onRegenerate,
  onRetry,
  onDownloadError,
}: {
  row: TranscriptMessageRow
  streaming: boolean
  stopped: boolean
  canRegenerate: boolean
  busy: boolean
  onRegenerate: () => void
  onRetry: () => void
  onDownloadError: (message: string) => void
}) {
  const { message } = row
  const isUser = message.role === 'user'
  const time = messageTime(message.createdAt)
  const empty = !message.content.trim()

  return (
    <article
      className={cn(
        'group flex gap-2',
        isUser ? 'flex-row-reverse pl-6' : 'pr-2 sm:pr-4',
        row.grouped ? 'mt-1' : 'mt-3',
      )}
      aria-label={isUser ? 'Your message' : 'Assistant message'}
    >
      {!isUser ? (
        row.showAvatar ? (
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-golden/60 bg-golden/15 text-maroon dark:text-golden"
            aria-hidden="true"
          >
            <Sparkles className="h-3 w-3" />
          </span>
        ) : (
          <span className="w-6 shrink-0" aria-hidden="true" />
        )
      ) : null}

      <div className={cn('min-w-0 max-w-[92%] sm:max-w-[85%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'px-3 py-2',
            isUser
              ? 'bg-maroon text-white dark:border dark:border-golden/40 dark:bg-surface-dark dark:text-foreground'
              : 'border border-zinc-300 bg-white dark:border-zinc-800 dark:bg-surface-dark',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
          ) : message.content ? (
            <Markdown content={message.content} />
          ) : stopped ? (
            <p className="text-sm italic leading-relaxed text-zinc-500 dark:text-zinc-400">
              Stopped before a reply arrived.
            </p>
          ) : streaming && row.isLastAssistant ? (
            <TypingDots />
          ) : null}

          {!isUser && stopped && message.content ? (
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Stopped — retry?
            </p>
          ) : null}

          {!isUser && message.toolInvocations?.length ? (
            <ToolActivityDisclosure invocations={message.toolInvocations} />
          ) : null}

          {!isUser && message.attachments?.length ? (
            <AttachmentCards attachments={message.attachments} onError={onDownloadError} />
          ) : null}
        </div>

        <div
          className={cn(
            'mt-0.5 flex w-full flex-wrap items-center gap-1.5',
            isUser ? 'justify-end' : 'justify-start',
          )}
        >
          <time
            dateTime={message.createdAt}
            className="text-[10px] font-medium tabular-nums text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:text-zinc-400"
          >
            {time}
          </time>
          {!empty || stopped ? (
            <MessageActions
              content={message.content}
              align={isUser ? 'end' : 'start'}
              onRegenerate={canRegenerate ? onRegenerate : undefined}
              regenerateDisabled={busy}
              onRetry={stopped ? onRetry : undefined}
              className={
                stopped
                  ? undefined
                  : 'transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
              }
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}

interface AssistantChatProps {
  className?: string
  /** Where the panel lives: dock/theater overlays or the full focus page. */
  geometry?: AssistantChatGeometry
  onClose?: () => void
  onGeometryChange?: (geometry: AssistantOverlayGeometry) => void
  autoFocus?: boolean
  /** Empty-state chips; tapping one fills the composer without sending. */
  suggestions?: string[]
}

export function AssistantChat({
  className,
  geometry = 'focus',
  onClose,
  onGeometryChange,
  autoFocus = false,
  suggestions,
}: AssistantChatProps) {
  const composerId = useId()
  const [user, setUser] = useState<User | null>(null)
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null)
  const [capabilityError, setCapabilityError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null)
  const [stoppedMessageId, setStoppedMessageId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [threadsRefreshKey, setThreadsRefreshKey] = useState(0)

  const messagesRef = useRef<AiChatMessage[]>([])
  const threadIdRef = useRef<string | null>(null)
  const pendingMessageIdRef = useRef<string | null>(null)
  const conversationBusyRef = useRef(false)
  const receivedStreamEventRef = useRef(false)
  const lastSentRef = useRef<string | null>(null)
  const subscriptionRef = useRef<(() => void) | null>(null)
  const replyTimerRef = useRef<number | null>(null)
  const reconcileTimerRef = useRef<number | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const threadRequestSeqRef = useRef(0)

  const isDesktop = useIsDesktop()
  const lastMessage = messages[messages.length - 1]
  const contentKey = `${messages.length}:${lastMessage?.content.length ?? 0}:${streaming ? '1' : '0'}`
  const { scrollRef, scrolledUp, unread, onScroll, jumpToLatest, resetToBottom } =
    useStickToBottom(contentKey, messages.length)

  const role: AssistantRole | null = user && isAssistantRole(user.role) ? user.role : null
  const roleCopy = role ? ASSISTANT_ROLE_COPY[role] : null

  const setMessagesSafe = useCallback(
    (next: AiChatMessage[] | ((current: AiChatMessage[]) => AiChatMessage[])) => {
      const resolved = typeof next === 'function' ? next(messagesRef.current) : next
      messagesRef.current = resolved
      setMessages(resolved)
    },
    [],
  )

  const unsubscribe = useCallback(() => {
    subscriptionRef.current?.()
    subscriptionRef.current = null
    setConnected(false)
  }, [])

  const stopReplyTimer = useCallback(() => {
    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current)
      replyTimerRef.current = null
    }
  }, [])

  const stopReconcile = useCallback(() => {
    if (reconcileTimerRef.current !== null) {
      window.clearTimeout(reconcileTimerRef.current)
      reconcileTimerRef.current = null
    }
  }, [])

  /**
   * The server starts a run before the POST response returns. A very fast reply
   * can therefore finish before the socket joins the thread room. Re-read the
   * thread once if no stream event has arrived; a live stream always wins.
   */
  const scheduleReconcile = useCallback(
    (expectedThreadId: string) => {
      stopReconcile()
      reconcileTimerRef.current = window.setTimeout(() => {
        reconcileTimerRef.current = null
        if (
          !conversationBusyRef.current ||
          receivedStreamEventRef.current ||
          threadIdRef.current !== expectedThreadId
        ) {
          return
        }
        void (async () => {
          try {
            const thread = await api.getAiThread(expectedThreadId)
            if (
              !conversationBusyRef.current ||
              receivedStreamEventRef.current ||
              threadIdRef.current !== expectedThreadId
            ) {
              return
            }
            const pendingId = pendingMessageIdRef.current
            const completed = pendingId
              ? thread.messages.find((message) => message.id === pendingId)
              : undefined
            if (!completed?.content.trim()) return
            setMessagesSafe((current) => upsertMessage(current, completed))
            pendingMessageIdRef.current = null
            conversationBusyRef.current = false
            stopReplyTimer()
            setStreaming(false)
            setError(null)
            setRetryAction(null)
            setThreadsRefreshKey((value) => value + 1)
          } catch {
            // The reply watchdog remains the final fallback.
          }
        })()
      }, 1_500)
    },
    [setMessagesSafe, stopReconcile, stopReplyTimer],
  )

  const handleStreamEvent = useCallback(
    (event: AiStreamEvent) => {
      const update = applyStreamEvent(messagesRef.current, event, {
        threadId: threadIdRef.current,
        messageId: pendingMessageIdRef.current,
      })
      if (!update.handled) return

      receivedStreamEventRef.current = true
      let next = update.messages
      if (update.error) {
        const pendingId = pendingMessageIdRef.current
        pendingMessageIdRef.current = null
        if (pendingId) {
          next = next.filter(
            (message) => message.id !== pendingId || message.content.trim().length > 0,
          )
        }
        setError(update.error)
        setRetryAction({ kind: 'regenerate' })
      }
      if (update.done) {
        conversationBusyRef.current = false
        stopReconcile()
        stopReplyTimer()
        setStreaming(false)
        setThreadsRefreshKey((value) => value + 1)
        if (!update.error) {
          pendingMessageIdRef.current = null
          setStoppedMessageId(null)
          setError(null)
          setRetryAction(null)
        }
      }
      setMessagesSafe(next)
    },
    [setMessagesSafe, stopReconcile, stopReplyTimer],
  )

  const subscribe = useCallback(
    (nextThreadId: string) => {
      unsubscribe()
      subscriptionRef.current = subscribeToAiThread(nextThreadId, handleStreamEvent, setConnected)
    },
    [handleStreamEvent, unsubscribe],
  )

  const adoptThread = useCallback((nextThreadId: string, userId: string) => {
    threadIdRef.current = nextThreadId
    setThreadId(nextThreadId)
    writeThreadId(userId, nextThreadId)
  }, [])

  const startReplyTimer = useCallback(() => {
    stopReplyTimer()
    replyTimerRef.current = window.setTimeout(() => {
      replyTimerRef.current = null
      const pendingId = pendingMessageIdRef.current
      pendingMessageIdRef.current = null
      conversationBusyRef.current = false
      stopReconcile()
      setStreaming(false)
      if (pendingId) {
        setMessagesSafe((current) =>
          current.filter(
            (message) => message.id !== pendingId || message.content.trim().length > 0,
          ),
        )
      }
      setError('The assistant did not reply in time. Try again.')
      setRetryAction(
        threadIdRef.current
          ? { kind: 'regenerate' }
          : lastSentRef.current
            ? { kind: 'send', text: lastSentRef.current }
            : null,
      )
    }, REPLY_TIMEOUT_MS)
  }, [setMessagesSafe, stopReconcile, stopReplyTimer])

  /** Load a persisted thread, restore the socket room, and resume any in-flight reply. */
  const applyThread = useCallback(
    (thread: { id: string; messages: AiChatMessage[] }, userId: string) => {
      setMessagesSafe(thread.messages)
      adoptThread(thread.id, userId)
      subscribe(thread.id)
      setStoppedMessageId(null)
      setError(null)
      setRetryAction(null)

      const trailing = thread.messages.at(-1)
      if (trailing?.role === 'assistant' && !trailing.content.trim()) {
        // A reload during a reply leaves the placeholder in the persisted
        // thread. Keep the composer locked until the stream resolves.
        pendingMessageIdRef.current = trailing.id
        conversationBusyRef.current = true
        setStreaming(true)
        startReplyTimer()
        scheduleReconcile(thread.id)
      } else {
        pendingMessageIdRef.current = null
        conversationBusyRef.current = false
        setStreaming(false)
      }
    },
    [adoptThread, scheduleReconcile, setMessagesSafe, startReplyTimer, subscribe],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setInitializing(true)
      setCapabilityError(null)
      try {
        let current = api.getCurrentUser()
        if (!current) current = await api.restoreSession().catch(() => null)
        if (cancelled) return
        if (!current || !isAssistantRole(current.role)) {
          setUser(null)
          return
        }
        setUser(current)

        let nextCapabilities: AiCapabilities | null = null
        try {
          nextCapabilities = await api.getAiCapabilities()
        } catch (loadError) {
          if (!cancelled) setCapabilityError(describeAssistantError(loadError))
        }
        if (cancelled) return
        setCapabilities(nextCapabilities)

        if (!nextCapabilities?.enabled) return
        const storedThreadId = readThreadId(current.id)
        if (!storedThreadId) return
        try {
          const thread = await api.getAiThread(storedThreadId)
          if (cancelled) return
          applyThread(thread, current.id)
        } catch {
          if (!cancelled) {
            clearThreadId(current.id)
            threadIdRef.current = null
            setThreadId(null)
            setMessagesSafe([])
          }
        }
      } finally {
        if (!cancelled) setInitializing(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      unsubscribe()
      stopReconcile()
      stopReplyTimer()
    }
  }, [
    applyThread,
    retryToken,
    setMessagesSafe,
    stopReconcile,
    stopReplyTimer,
    unsubscribe,
  ])

  useEffect(() => {
    if (!autoFocus || initializing || !capabilities?.enabled) return
    const timer = window.setTimeout(() => composerRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [autoFocus, capabilities?.enabled, initializing])

  useEffect(() => {
    const node = composerRef.current
    if (!node) return
    node.style.height = 'auto'
    const next = Math.min(node.scrollHeight, 168)
    node.style.height = `${next > 0 ? next : 44}px`
    node.style.overflowY = node.scrollHeight > 168 ? 'auto' : 'hidden'
  }, [input])

  useEffect(() => {
    if (geometry === 'dock') setHistoryOpen(false)
  }, [geometry])

  useEffect(() => {
    if (geometry === 'focus' && isDesktop) setHistoryOpen(true)
  }, [geometry, isDesktop])

  useEffect(() => {
    if (!threadId) return
    resetToBottom()
  }, [resetToBottom, threadId])

  const sendMessage = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim()
      if (
        !text ||
        !user ||
        !capabilities?.enabled ||
        sending ||
        streaming ||
        conversationBusyRef.current
      ) {
        return
      }
      if (capabilities.maxMessageChars && text.length > capabilities.maxMessageChars) {
        setError(`Messages are limited to ${capabilities.maxMessageChars} characters.`)
        return
      }

      conversationBusyRef.current = true
      receivedStreamEventRef.current = false
      stopReconcile()
      setInput('')
      setError(null)
      setRetryAction(null)
      setStoppedMessageId(null)
      setSending(true)
      lastSentRef.current = text
      const seq = threadRequestSeqRef.current

      const optimisticId = `local-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const optimistic: AiChatMessage = {
        id: optimisticId,
        threadId: threadIdRef.current ?? '',
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      }
      setMessagesSafe((current) => [...current, optimistic])

      try {
        const result = await api.sendAiChatMessage({
          message: text,
          ...(threadIdRef.current ? { threadId: threadIdRef.current } : {}),
        })
        if (threadRequestSeqRef.current !== seq) return
        adoptThread(result.threadId, user.id)
        pendingMessageIdRef.current = result.messageId
        setMessagesSafe((current) => [
          ...current.map((message) =>
            message.id === optimisticId ? { ...message, threadId: result.threadId } : message,
          ),
          {
            id: result.messageId,
            threadId: result.threadId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
          },
        ])
        setStreaming(true)
        startReplyTimer()
        scheduleReconcile(result.threadId)
        subscribe(result.threadId)
      } catch (sendError) {
        if (threadRequestSeqRef.current !== seq) return
        conversationBusyRef.current = false
        stopReconcile()
        setMessagesSafe((current) => current.filter((message) => message.id !== optimisticId))
        setInput(text)
        setRetryAction({ kind: 'send', text })
        setError(describeAssistantError(sendError))
      } finally {
        if (threadRequestSeqRef.current === seq) setSending(false)
      }
    },
    [
      adoptThread,
      capabilities,
      input,
      scheduleReconcile,
      sending,
      setMessagesSafe,
      startReplyTimer,
      stopReconcile,
      streaming,
      subscribe,
      user,
    ],
  )

  const regenerate = useCallback(async () => {
    const activeThreadId = threadIdRef.current
    if (!user || !activeThreadId || sending || conversationBusyRef.current) return
    const lastUser = [...messagesRef.current]
      .reverse()
      .find((message) => message.role === 'user' && message.content.trim())
    if (!lastUser) return

    conversationBusyRef.current = true
    receivedStreamEventRef.current = false
    stopReconcile()
    setError(null)
    setRetryAction(null)
    setStoppedMessageId(null)
    setSending(true)
    lastSentRef.current = lastUser.content
    const seq = threadRequestSeqRef.current

    try {
      const result = await api.sendAiChatMessage({
        message: lastUser.content,
        threadId: activeThreadId,
        regenerate: true,
      })
      if (threadRequestSeqRef.current !== seq) return
      adoptThread(result.threadId, user.id)
      const draft: AiChatMessage = {
        id: result.messageId,
        threadId: result.threadId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
      setMessagesSafe((current) => {
        const index = lastAssistantIndex(current)
        return index === -1 ? [...current, draft] : [...current.slice(0, index), draft]
      })
      pendingMessageIdRef.current = result.messageId
      setStreaming(true)
      startReplyTimer()
      scheduleReconcile(result.threadId)
      subscribe(result.threadId)
    } catch (regenerateError) {
      if (threadRequestSeqRef.current !== seq) return
      conversationBusyRef.current = false
      stopReconcile()
      setError(describeAssistantError(regenerateError))
      setRetryAction({ kind: 'regenerate' })
    } finally {
      if (threadRequestSeqRef.current === seq) setSending(false)
    }
  }, [
    adoptThread,
    scheduleReconcile,
    sending,
    setMessagesSafe,
    startReplyTimer,
    stopReconcile,
    subscribe,
    user,
  ])

  const handleStop = useCallback(async () => {
    const activeThreadId = threadIdRef.current
    const pendingId = pendingMessageIdRef.current

    unsubscribe()
    stopReplyTimer()
    stopReconcile()
    conversationBusyRef.current = false
    receivedStreamEventRef.current = false
    pendingMessageIdRef.current = null
    setStreaming(false)
    setError(null)
    setRetryAction(null)
    if (pendingId) setStoppedMessageId(pendingId)
    if (!activeThreadId) return

    try {
      const thread = await api.getAiThread(activeThreadId)
      if (threadIdRef.current !== activeThreadId) return
      setMessagesSafe((current) => reconcileStoppedThread(current, thread.messages))
      const authoritative = pendingId
        ? thread.messages.find((message) => message.id === pendingId)
        : undefined
      if (authoritative?.content.trim()) setStoppedMessageId(null)
      setThreadsRefreshKey((value) => value + 1)
    } catch {
      // The local partial reply remains visible and marked stopped.
    }
  }, [setMessagesSafe, stopReconcile, stopReplyTimer, unsubscribe])

  const handleNewChat = useCallback(() => {
    threadRequestSeqRef.current += 1
    unsubscribe()
    stopReconcile()
    stopReplyTimer()
    conversationBusyRef.current = false
    receivedStreamEventRef.current = false
    pendingMessageIdRef.current = null
    threadIdRef.current = null
    lastSentRef.current = null
    setThreadId(null)
    setMessagesSafe([])
    setInput('')
    setError(null)
    setRetryAction(null)
    setStoppedMessageId(null)
    setStreaming(false)
    setSending(false)
    setThreadsRefreshKey((value) => value + 1)
    if (!isDesktop) setHistoryOpen(false)
    if (user) clearThreadId(user.id)
  }, [isDesktop, setMessagesSafe, stopReconcile, stopReplyTimer, unsubscribe, user])

  const openThread = useCallback(
    async (nextThreadId: string) => {
      if (!user) return
      if (nextThreadId === threadIdRef.current) {
        if (!isDesktop) setHistoryOpen(false)
        return
      }

      const seq = threadRequestSeqRef.current + 1
      threadRequestSeqRef.current = seq
      unsubscribe()
      stopReplyTimer()
      stopReconcile()
      conversationBusyRef.current = false
      receivedStreamEventRef.current = false
      pendingMessageIdRef.current = null
      setStreaming(false)
      setSending(false)
      setError(null)
      setRetryAction(null)

      try {
        const thread = await api.getAiThread(nextThreadId)
        if (threadRequestSeqRef.current !== seq) return
        applyThread(thread, user.id)
        if (!isDesktop) setHistoryOpen(false)
      } catch (openError) {
        if (threadRequestSeqRef.current !== seq) return
        if (!isDesktop) setHistoryOpen(false)
        setError(describeAssistantError(openError))
      }
    },
    [applyThread, isDesktop, stopReconcile, stopReplyTimer, unsubscribe, user],
  )

  const handleThreadDeleted = useCallback(
    (deletedThreadId: string) => {
      if (deletedThreadId === threadIdRef.current) handleNewChat()
    },
    [handleNewChat],
  )

  const handleRetry = useCallback(() => {
    if (retryAction?.kind === 'regenerate') {
      void regenerate()
    } else if (retryAction?.kind === 'send') {
      void sendMessage(retryAction.text)
    }
  }, [regenerate, retryAction, sendMessage])

  const enabled = capabilities?.enabled === true
  const unavailable = Boolean(capabilityError) || !capabilities
  const disabledMessage = capabilities?.policyBlocked
    ? capabilities.reason?.trim() || 'The assistant has been disabled by your administrator.'
    : capabilities?.reason?.trim() || 'The assistant is not configured yet.'
  const starterPrompts = suggestions?.length
    ? suggestions
    : role
      ? starterPromptsFor(role)
      : []

  if (!user && !initializing) return null

  const rows = buildTranscriptRows(messages)
  const attachmentCount = messages.reduce(
    (count, message) => count + (message.attachments?.length ?? 0),
    0,
  )
  const busy = sending || streaming

  let body: React.ReactNode

  if (initializing) {
    body = (
      <div className="flex flex-1 items-center justify-center px-6" aria-busy="true" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-center">
          <Sparkles className="h-5 w-5 text-maroon dark:text-golden" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Loading assistant…
          </p>
        </div>
      </div>
    )
  } else if (unavailable) {
    body = (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <AlertTriangle className="h-5 w-5 text-maroon dark:text-golden" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-heading text-lg font-bold text-foreground">Assistant unavailable</h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {capabilityError ?? 'The assistant could not be reached right now.'}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRetryToken((value) => value + 1)}
          className="mt-4 text-[10px] font-bold uppercase tracking-widest"
        >
          Try again
        </Button>
      </div>
    )
  } else if (!enabled) {
    body = (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center border border-golden/40 bg-golden/10">
          <Sparkles className="h-5 w-5 text-maroon dark:text-golden" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-heading text-lg font-bold text-foreground">Assistant unavailable</h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {disabledMessage}
        </p>
        {user?.role === 'super_admin' ? (
          <Link
            href="/faculty/settings"
            className="mt-4 text-[10px] font-bold uppercase tracking-widest text-maroon hover:underline dark:text-golden"
          >
            Open Institution Settings
          </Link>
        ) : null}
      </div>
    )
  } else {
    body = (
      <>
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={onScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            className="h-full overflow-y-auto px-3 py-4 sm:px-4"
          >
            {messages.length === 0 && role ? (
              <EmptyState
                role={role}
                suggestions={starterPrompts}
                onSelectPrompt={(prompt) => {
                  setInput(prompt)
                  composerRef.current?.focus()
                }}
              />
            ) : (
              rows.map((row) =>
                row.kind === 'divider' ? (
                  <div
                    key={row.key}
                    role="separator"
                    aria-label={`Conversation continued at ${row.label}`}
                    className="my-3 flex items-center gap-2"
                  >
                    <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      {row.label}
                    </span>
                    <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
                  </div>
                ) : (
                  <ChatMessageRow
                    key={row.key}
                    row={row}
                    streaming={streaming}
                    stopped={stoppedMessageId === row.message.id}
                    canRegenerate={
                      row.isLastAssistant && !busy && stoppedMessageId !== row.message.id
                    }
                    busy={busy}
                    onRegenerate={() => void regenerate()}
                    onRetry={() => void regenerate()}
                    onDownloadError={(message) => {
                      setError(message)
                      setRetryAction(null)
                    }}
                  />
                ),
              )
            )}

            {error ? (
              <div
                role="alert"
                className="mt-3 flex flex-wrap items-start gap-2 border border-golden/60 bg-golden/10 px-3 py-2 text-xs text-maroon-dark dark:border-golden/25 dark:text-golden"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
                {retryAction ? (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={busy}
                    className="font-bold uppercase tracking-widest underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {scrolledUp && messages.length > 0 ? (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 border border-maroon bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-maroon shadow-md transition-colors hover:bg-maroon hover:text-white dark:border-golden dark:bg-surface-dark dark:text-golden dark:hover:bg-golden dark:hover:text-maroon-dark"
            >
              Jump to latest
              <ArrowDown className="h-3 w-3" aria-hidden="true" />
              {unread > 0 ? (
                <span className="ml-0.5 border border-current px-1 text-[9px] leading-4">{unread}</span>
              ) : null}
            </button>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-zinc-300 dark:border-zinc-800">
          <form
            className="p-3"
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage()
            }}
          >
            <label htmlFor={composerId} className="sr-only">
              Message the assistant
            </label>
            <div className="flex items-end gap-2 border border-zinc-300 bg-white transition-colors focus-within:border-maroon dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-golden">
              <textarea
                id={composerId}
                ref={composerRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    // While a reply is streaming, Enter adds a new line so the
                    // next prompt can be prepared without cancelling it.
                    if (streaming || sending) return
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                rows={1}
                maxLength={capabilities?.maxMessageChars}
                disabled={sending}
                aria-describedby={`${composerId}-hint`}
                placeholder={
                  role === 'student'
                    ? 'Ask about your attendance or classes…'
                    : role === 'super_admin'
                      ? 'Ask about accounts, sections, audit activity, or exports…'
                      : 'Ask about a section, session, or attendance file…'
                }
                className="max-h-[168px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none disabled:opacity-60"
              />
              {streaming ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={() => void handleStop()}
                  aria-label="Stop generating"
                  title="Stop generating"
                  className="m-1 h-8 w-8 shrink-0 bg-maroon text-white hover:bg-maroon-dark dark:bg-golden dark:text-maroon-dark dark:hover:bg-golden-dark"
                >
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={!input.trim() || sending}
                  className="m-1 h-8 w-8 shrink-0 bg-maroon text-white hover:bg-maroon-dark disabled:opacity-50 dark:bg-golden dark:text-maroon-dark dark:hover:bg-golden-dark"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              )}
            </div>
            <div
              id={`${composerId}-hint`}
              className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400"
            >
              <span>Enter to send · Shift+Enter for a new line</span>
              <span className="flex items-center gap-2">
                {attachmentCount > 0 ? (
                  <span className="border border-zinc-300 px-1 py-0.5 dark:border-zinc-700">
                    {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
                  </span>
                ) : null}
                {capabilities?.maxMessageChars ? (
                  <span>
                    {input.length}/{capabilities.maxMessageChars}
                  </span>
                ) : (
                  <span>{input.length}</span>
                )}
              </span>
            </div>
          </form>
        </div>
      </>
    )
  }

  return (
    <AssistantShell
      geometry={geometry}
      eyebrow={roleCopy?.eyebrow ?? 'Assistant'}
      threadTitle={deriveThreadTitle(messages)}
      model={capabilities?.model}
      connected={connected}
      streaming={streaming}
      onClose={onClose}
      onToggleGeometry={
        onGeometryChange
          ? () => onGeometryChange(geometry === 'dock' ? 'theater' : 'dock')
          : undefined
      }
      onNewChat={handleNewChat}
      historyOpen={historyOpen}
      onToggleHistory={
        geometry === 'dock' ? undefined : () => setHistoryOpen((value) => !value)
      }
      rail={
        geometry !== 'dock' ? (
          <ThreadsRail
            currentThreadId={threadId}
            refreshKey={threadsRefreshKey}
            onSelectThread={(nextThreadId) => void openThread(nextThreadId)}
            onNewChat={handleNewChat}
            onDeletedThread={handleThreadDeleted}
            onRequestClose={isDesktop ? undefined : () => setHistoryOpen(false)}
          />
        ) : undefined
      }
      className={className}
    >
      {body}
    </AssistantShell>
  )
}
