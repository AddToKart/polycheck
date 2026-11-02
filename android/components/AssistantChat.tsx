import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import type { AiCapabilities, AiChatAttachment, AiChatMessage, AiStreamEvent } from '@polycheck/shared'
import { api } from '../services/api-client'
import { subscribeToAiThread } from '../services/realtime'
import { applyStreamEvent, reconcileStoppedThread, upsertMessage } from '../lib/assistant-state'
import { stoppedReplyHint, type AttachmentDownloadState } from '../lib/assistant-ui'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { AssistantAttachmentCard } from './AssistantAttachmentCard'
import { AssistantEmptyState } from './AssistantEmptyState'
import { AssistantMarkdown } from './AssistantMarkdown'
import { AssistantMessageActions } from './AssistantMessageActions'
import { AssistantToolActivity } from './AssistantToolActivity'
import { CampusHeader } from './CampusHeader'
import { CampusButton, CampusIconButton } from './CampusPrimitives'
import { useCampusToast } from './CampusToast'

export type AssistantChatMode = 'student' | 'faculty' | 'admin'

interface AssistantChatProps {
  mode: AssistantChatMode
  onBack?: () => void
}

const REPLY_TIMEOUT_MS = 75_000
const RECONCILE_DELAY_MS = 1_500
const HARD_MESSAGE_LIMIT = 2_000

const FACULTY_PROMPTS = [
  'List my sections',
  'Extract my section’s master list (PDF)',
  'Show attendance for my last session',
  'Export my last session attendance (CSV)',
]

const ADMIN_PROMPTS = [
  'Give me an institution overview',
  'Who are the disabled accounts?',
  'Show recent audit activity',
  'Extract a section master list (PDF)',
]

const STUDENT_PROMPTS = [
  'Why was I marked absent recently?',
  'What is my attendance standing?',
  'Draft a message to my professor.',
  'How do I enroll in a subject?',
]

const MODE_COPY: Record<AssistantChatMode, {
  eyebrow: string
  subtitle: string
  emptyTitle: string
  emptyBody: string
  placeholder: string
  can: string[]
  cant: string[]
}> = {
  student: {
    eyebrow: 'Student assistant',
    subtitle: 'Ask about your own attendance and classes.',
    emptyTitle: 'Ask about your attendance',
    emptyBody: 'The assistant reads only your own records and explains what was recorded. It cannot change attendance.',
    placeholder: 'Ask about your attendance or classes…',
    can: ['Explain your attendance marks', 'Check your standing', 'Draft a professor message'],
    cant: ['Change records or files', 'Geofencing details'],
  },
  faculty: {
    eyebrow: 'Faculty assistant',
    subtitle: 'Find sections, review attendance, and prepare exports.',
    emptyTitle: 'Ask about your classes',
    emptyBody: 'Find a section, review session attendance, or generate a master list. The assistant only reads records you can already access.',
    placeholder: 'Ask about a section, session, or attendance file…',
    can: ['Your own sections and rosters', 'Session attendance', 'Master lists', 'Attendance exports'],
    cant: ['Other teachers’ classes', 'Institution-wide data'],
  },
  admin: {
    eyebrow: 'Administration assistant',
    subtitle: 'Look up institution data and prepare exports.',
    emptyTitle: 'Ask about institution data',
    emptyBody: 'Look up in-scope sections, review session attendance, or generate a master list. Every extraction stays inside your administrative scope.',
    placeholder: 'Ask about a section, session, or institution record…',
    can: ['Institution overview', 'Account lookup', 'Audit activity', 'Section exports'],
    cant: ['Create or disable accounts', 'Change attendance or settings'],
  },
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Unable to reach the assistant. Try again.'
}

function TypingIndicator() {
  return (
    <Text accessibilityLiveRegion="polite" accessibilityLabel="Assistant is typing" className="font-sans text-sm text-muted dark:text-zinc-400">
      Assistant is typing…
    </Text>
  )
}

export function AssistantChat({ mode, onBack }: AssistantChatProps) {
  const { isDark } = useTheme()
  const { showToast } = useCampusToast()
  const insets = useSafeAreaInsets()
  const copy = MODE_COPY[mode]

  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null)
  const [capabilityError, setCapabilityError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryText, setRetryText] = useState<string | null>(null)
  const [stoppedMessageId, setStoppedMessageId] = useState<string | null>(null)
  const [downloadStates, setDownloadStates] = useState<Record<string, AttachmentDownloadState>>({})

  const messagesRef = useRef<AiChatMessage[]>([])
  const threadIdRef = useRef<string | null>(null)
  const pendingMessageIdRef = useRef<string | null>(null)
  const conversationBusyRef = useRef(false)
  const receivedStreamEventRef = useRef(false)
  const lastSentRef = useRef<string | null>(null)
  const subscriptionRef = useRef<(() => void) | null>(null)
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const unmountingRef = useRef(false)
  const generationRef = useRef(0)
  const scrollRef = useRef<ScrollView>(null)

  const user = api.getCurrentUser()
  const enabled = capabilities?.enabled === true
  const maxMessageLength = Math.min(HARD_MESSAGE_LIMIT, capabilities?.maxMessageChars ?? HARD_MESSAGE_LIMIT)

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
    if (mountedRef.current) setConnected(false)
  }, [])

  const stopReplyTimer = useCallback(() => {
    if (replyTimerRef.current !== null) {
      clearTimeout(replyTimerRef.current)
      replyTimerRef.current = null
    }
  }, [])

  const stopReconcile = useCallback(() => {
    if (reconcileTimerRef.current !== null) {
      clearTimeout(reconcileTimerRef.current)
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
      reconcileTimerRef.current = setTimeout(() => {
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
              !mountedRef.current ||
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
            setRetryText(null)
            setStoppedMessageId(null)
          } catch {
            // The reply watchdog remains the final fallback.
          }
        })()
      }, RECONCILE_DELAY_MS)
    },
    [setMessagesSafe, stopReconcile, stopReplyTimer],
  )

  const handleStreamEvent = useCallback(
    (event: AiStreamEvent) => {
      if (!mountedRef.current) return
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
          next = next.filter((message) => message.id !== pendingId || message.content.trim().length > 0)
        }
        setError(update.error)
        setRetryText(lastSentRef.current)
        showToast('error', 'Assistant error', update.error)
      }
      if (update.done) {
        conversationBusyRef.current = false
        stopReconcile()
        stopReplyTimer()
        setStreaming(false)
        if (!update.error) {
          pendingMessageIdRef.current = null
          setError(null)
          setRetryText(null)
          setStoppedMessageId(null)
        }
      }
      setMessagesSafe(next)
    },
    [setMessagesSafe, showToast, stopReconcile, stopReplyTimer],
  )

  const subscribe = useCallback(
    (nextThreadId: string) => {
      unsubscribe()
      subscriptionRef.current = subscribeToAiThread(nextThreadId, handleStreamEvent, (joined) => {
        if (mountedRef.current) setConnected(joined)
      })
    },
    [handleStreamEvent, unsubscribe],
  )

  const adoptThread = useCallback((nextThreadId: string) => {
    threadIdRef.current = nextThreadId
    setThreadId(nextThreadId)
  }, [])

  const startReplyTimer = useCallback(() => {
    stopReplyTimer()
    replyTimerRef.current = setTimeout(() => {
      replyTimerRef.current = null
      const pendingId = pendingMessageIdRef.current
      pendingMessageIdRef.current = null
      conversationBusyRef.current = false
      stopReconcile()
      setStreaming(false)
      if (!mountedRef.current) return
      if (pendingId) {
        setMessagesSafe((current) =>
          current.filter((message) => message.id !== pendingId || message.content.trim().length > 0),
        )
      }
      setError('The assistant did not reply in time. Try again.')
      setRetryText(lastSentRef.current)
    }, REPLY_TIMEOUT_MS)
  }, [setMessagesSafe, stopReconcile, stopReplyTimer])

  // Capabilities are re-read on focus so a settings change is picked up when
  // the user returns; messages are kept for this app session.
  const loadCapabilities = useCallback(async () => {
    try {
      const next = await api.getAiCapabilities()
      if (!mountedRef.current) return
      setCapabilities(next)
      setCapabilityError(null)
    } catch {
      if (!mountedRef.current) return
      setCapabilities(null)
      setCapabilityError('Assistant unavailable offline. Connect to the internet and try again.')
    } finally {
      if (mountedRef.current) setInitializing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadCapabilities()
    }, [loadCapabilities]),
  )

  useEffect(() => {
    mountedRef.current = true
    unmountingRef.current = false
    return () => {
      unmountingRef.current = true
      mountedRef.current = false
      generationRef.current += 1
      subscriptionRef.current?.()
      subscriptionRef.current = null
      if (replyTimerRef.current !== null) clearTimeout(replyTimerRef.current)
      if (reconcileTimerRef.current !== null) clearTimeout(reconcileTimerRef.current)
    }
  }, [])

  const handleNewChat = useCallback(() => {
    generationRef.current += 1
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
    setRetryText(null)
    setStoppedMessageId(null)
    setDownloadStates({})
    setStreaming(false)
    setSending(false)
  }, [setMessagesSafe, stopReconcile, stopReplyTimer, unsubscribe])

  const retryCapabilities = useCallback(() => {
    setInitializing(true)
    setCapabilityError(null)
    void loadCapabilities()
  }, [loadCapabilities])

  const sendMessage = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim()
      if (!text || !user || !capabilities?.enabled || sending || streaming || conversationBusyRef.current) {
        return
      }
      if (text.length > maxMessageLength) {
        setError(`Messages are limited to ${maxMessageLength} characters.`)
        return
      }

      const generation = generationRef.current
      conversationBusyRef.current = true
      receivedStreamEventRef.current = false
      stopReconcile()
      setInput('')
      setError(null)
      setRetryText(null)
      setStoppedMessageId(null)
      setSending(true)
      lastSentRef.current = text

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
        if (!mountedRef.current || generation !== generationRef.current) return

        adoptThread(result.threadId)
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
        if (!mountedRef.current || generation !== generationRef.current) return
        conversationBusyRef.current = false
        stopReconcile()
        setMessagesSafe((current) => current.filter((message) => message.id !== optimisticId))
        setInput(text)
        setRetryText(text)
        setError(errorMessage(sendError))
        showToast('error', 'Message not sent', errorMessage(sendError))
      } finally {
        if (mountedRef.current && generation === generationRef.current) setSending(false)
      }
    },
    [
      adoptThread,
      capabilities?.enabled,
      input,
      maxMessageLength,
      scheduleReconcile,
      sending,
      setMessagesSafe,
      showToast,
      startReplyTimer,
      stopReconcile,
      streaming,
      subscribe,
      user,
    ],
  )

  /**
   * Client-side stop: drop the socket, mark the in-flight draft as stopped,
   * then reconcile once against the authoritative server thread. The server
   * keeps running its own request; a later done event is never delivered after
   * the unsubscribe.
   */
  const handleStop = useCallback(async () => {
    if (!mountedRef.current || !conversationBusyRef.current) return
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
    setRetryText(null)
    if (pendingId) setStoppedMessageId(pendingId)
    if (!activeThreadId) return

    try {
      const thread = await api.getAiThread(activeThreadId)
      if (
        !mountedRef.current ||
        threadIdRef.current !== activeThreadId ||
        conversationBusyRef.current
      ) {
        return
      }
      setMessagesSafe((current) => reconcileStoppedThread(current, thread.messages))
      const authoritative = pendingId
        ? thread.messages.find((message) => message.id === pendingId)
        : undefined
      if (authoritative?.content.trim()) setStoppedMessageId(null)
    } catch {
      // Keep the local partial reply marked stopped; retry re-sends the turn.
    }
  }, [setMessagesSafe, stopReconcile, stopReplyTimer, unsubscribe])

  // Leaving the screen (tab switch or back) drops the live stream. The server
  // keeps its authoritative run; handleStop reconciles the visible draft once.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!unmountingRef.current && conversationBusyRef.current && pendingMessageIdRef.current) {
          void handleStop()
        }
      }
    }, [handleStop]),
  )

  const handleRetryStopped = useCallback(() => {
    const text = lastSentRef.current
    if (!text) return
    void sendMessage(text)
  }, [sendMessage])

  const handleDownload = useCallback(
    async (attachment: AiChatAttachment) => {
      setDownloadStates((current) => ({ ...current, [attachment.id]: 'loading' }))
      try {
        await api.downloadAssistantFile(attachment.downloadPath, attachment.filename)
        if (!mountedRef.current) return
        setDownloadStates((current) => ({ ...current, [attachment.id]: 'done' }))
      } catch (downloadError) {
        if (!mountedRef.current) return
        setDownloadStates((current) => {
          const next = { ...current }
          delete next[attachment.id]
          return next
        })
        showToast('error', 'Unable to download file', errorMessage(downloadError))
      }
    },
    [showToast],
  )

  const prompts = mode === 'student' ? STUDENT_PROMPTS : mode === 'admin' ? ADMIN_PROMPTS : FACULTY_PROMPTS
  const canSend = Boolean(input.trim()) && enabled && !sending && !streaming
  const unavailable = Boolean(capabilityError) || capabilities === null
  const showStop = streaming

  const renderUnavailable = () => (
    <View className="flex-1 items-center justify-center px-6">
      <View className="w-full max-w-md items-center border border-line bg-white px-6 py-8 dark:border-line-dark dark:bg-surface-dark">
        <View className="mb-4 h-14 w-14 items-center justify-center border border-golden/40 bg-golden/10">
          <MaterialIcons name={capabilityError ? 'cloud-off' : 'auto-awesome'} size={25} color={isDark ? pupColors.golden : pupColors.maroon} />
        </View>
        <Text className="font-sans-bold text-lg text-ink dark:text-white">Assistant unavailable</Text>
        <Text className="mt-2 text-center font-sans text-sm leading-5 text-muted dark:text-zinc-400">
          {capabilityError ?? (capabilities?.reason?.trim() || 'The assistant is not configured yet.')}
        </Text>
        {capabilityError ? (
          <CampusButton label="Try again" icon="refresh" variant="secondary" onPress={retryCapabilities} className="mt-5" testID="assistant-retry" />
        ) : user?.role === 'super_admin' ? (
          <CampusButton
            label="Open Institution Settings"
            icon="settings"
            variant="secondary"
            onPress={() => router.push('/(faculty)/settings' as never)}
            className="mt-5"
            testID="assistant-open-settings"
          />
        ) : null}
      </View>
    </View>
  )

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-campus dark:bg-campus-dark" testID="assistant-screen">
      <CampusHeader
        eyebrow={copy.eyebrow}
        title="Assistant"
        subtitle={copy.subtitle}
        onBack={onBack}
        actions={(
          <CampusIconButton icon="add-comment" label="New chat" onPress={handleNewChat} inverse testID="assistant-new-chat" />
        )}
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {initializing ? (
          <View className="flex-1 items-center justify-center" accessibilityLiveRegion="polite" accessibilityLabel="Loading assistant">
            <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
            <Text className="mt-3 font-sans-bold text-[10px] uppercase tracking-[2px] text-muted dark:text-zinc-400">Loading assistant…</Text>
          </View>
        ) : unavailable || !enabled ? (
          renderUnavailable()
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              nativeID={threadId ?? 'assistant-new-thread'}
            >
              {messages.length === 0 ? (
                <AssistantEmptyState
                  title={copy.emptyTitle}
                  description={copy.emptyBody}
                  prompts={prompts}
                  can={copy.can}
                  cant={copy.cant}
                  onSelectPrompt={setInput}
                />
              ) : messages.map((message, index) => {
                const isUser = message.role === 'user'
                const stopped = stoppedMessageId === message.id
                const isLastMessage = index === messages.length - 1
                return (
                  <View
                    key={message.id}
                    testID={`assistant-message-${index}`}
                    accessibilityLabel={isUser ? 'Your message' : 'Assistant message'}
                    className={isUser ? 'max-w-[92%] self-end' : 'w-full max-w-[92%] self-start'}
                  >
                    <Text className={`mb-1 font-sans-bold text-[9px] uppercase tracking-[1.5px] text-muted dark:text-zinc-500 ${isUser ? 'text-right' : ''}`}>
                      {isUser ? 'You' : 'Assistant'}
                    </Text>
                    <View
                      className={isUser
                        ? 'border border-maroon bg-maroon px-3 py-2.5 dark:border-golden/40 dark:bg-surface-dark'
                        : 'border border-line border-l-4 border-l-golden bg-white px-3 py-2.5 dark:border-line-dark dark:bg-surface-dark'}
                    >
                      {isUser ? (
                        <Text className="font-sans text-sm leading-6 text-white dark:text-zinc-100">{message.content}</Text>
                      ) : message.content ? (
                        <AssistantMarkdown content={message.content} />
                      ) : stopped ? (
                        <Text className="font-sans text-sm italic leading-6 text-muted dark:text-zinc-400">
                          {stoppedReplyHint(false)}
                        </Text>
                      ) : streaming && isLastMessage ? (
                        <TypingIndicator />
                      ) : null}

                      {!isUser && stopped && message.content ? (
                        <Text className="mt-1.5 font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-400">
                          {stoppedReplyHint(true)}
                        </Text>
                      ) : null}

                      {!isUser && message.toolInvocations?.length ? (
                        <AssistantToolActivity
                          invocations={message.toolInvocations}
                          testID={`assistant-tool-activity-${index}`}
                        />
                      ) : null}

                      {!isUser && message.attachments?.length ? (
                        <View className="mt-2 gap-1.5">
                          {message.attachments.map((attachment) => (
                            <AssistantAttachmentCard
                              key={attachment.id}
                              attachment={attachment}
                              state={downloadStates[attachment.id] ?? 'idle'}
                              onPress={() => void handleDownload(attachment)}
                              testID={`assistant-attachment-${index}`}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>

                    {!isUser ? (
                      <AssistantMessageActions
                        content={message.content}
                        stopped={stopped}
                        onRetry={stopped ? handleRetryStopped : undefined}
                        testID={`assistant-copy-${index}`}
                      />
                    ) : null}
                  </View>
                )
              })}
            </ScrollView>

            {error ? (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                className="mx-3 mt-2 flex-row flex-wrap items-start gap-2 border border-golden/60 bg-golden/10 px-3 py-2 dark:border-golden/25"
              >
                <MaterialIcons name="error-outline" size={15} color={isDark ? pupColors.golden : pupColors.maroon} style={{ marginTop: 2 }} />
                <Text className="min-w-0 flex-1 font-sans text-xs leading-5 text-maroon-dark dark:text-golden">{error}</Text>
                {retryText ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Try sending the message again"
                    disabled={sending || streaming}
                    onPress={() => void sendMessage(retryText)}
                    className={`min-h-8 justify-center ${sending || streaming ? 'opacity-50' : ''}`}
                  >
                    <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-maroon underline dark:text-golden">Try again</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View
              className="border-t border-line bg-campus px-3 pt-3 dark:border-line-dark dark:bg-campus-dark"
              style={{ paddingBottom: insets.bottom + 76 }}
            >
              <View className="flex-row items-end border border-line bg-white dark:border-line-dark dark:bg-surface-dark">
                <TextInput
                  testID="assistant-input"
                  accessibilityLabel="Message the assistant"
                  className="max-h-32 min-h-12 flex-1 px-3 py-2.5 font-sans text-sm text-ink dark:text-white"
                  placeholder={copy.placeholder}
                  placeholderTextColor={isDark ? pupColors.muted : pupColors.mutedLight}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={maxMessageLength}
                  editable={!sending && !streaming}
                  textAlignVertical="top"
                />
                <Pressable
                  testID="assistant-send"
                  accessibilityRole="button"
                  accessibilityLabel={showStop ? 'Stop reply' : 'Send message'}
                  accessibilityHint={showStop ? 'Stops the streaming reply and keeps the partial answer' : undefined}
                  accessibilityState={{ disabled: showStop ? false : !canSend, busy: sending || streaming }}
                  disabled={showStop ? false : !canSend}
                  onPress={showStop ? () => void handleStop() : () => void sendMessage()}
                  className={`m-1 h-10 w-10 items-center justify-center ${showStop || canSend ? 'bg-maroon dark:bg-golden' : 'bg-zinc-200 dark:bg-white/10'}`}
                >
                  <MaterialIcons
                    name={showStop ? 'stop' : 'send'}
                    size={18}
                    color={showStop || canSend ? (isDark ? pupColors.maroonDark : '#FFFFFF') : isDark ? pupColors.muted : pupColors.mutedLight}
                  />
                </Pressable>
              </View>
              <View className="mt-1.5 flex-row items-center justify-between gap-2">
                <Text className="font-sans text-[10px] text-muted dark:text-zinc-500">
                  {streaming
                    ? (connected ? 'Replying…' : 'Reconnecting…')
                    : stoppedMessageId
                      ? 'Reply stopped · retry or send a new message'
                      : 'Read-only · never changes attendance'}
                </Text>
                <Text className="font-sans text-[10px] text-muted dark:text-zinc-500">
                  {input.length}/{maxMessageLength}
                </Text>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
