'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiThreadSummary } from '@polycheck/shared'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  describeAssistantError,
  formatRelativeTime,
  removeThread,
  sortThreads,
} from './assistant-utils'

interface ThreadsRailProps {
  currentThreadId: string | null
  /** Bumped by the chat when a reply lands so titles/order stay fresh. */
  refreshKey?: number
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
  onDeletedThread: (threadId: string) => void
  /** Only rendered for the below-`lg` sheet. */
  onRequestClose?: () => void
  className?: string
}

export function ThreadsRail({
  currentThreadId,
  refreshKey = 0,
  onSelectThread,
  onNewChat,
  onDeletedThread,
  onRequestClose,
  className,
}: ThreadsRailProps) {
  const [threads, setThreads] = useState<AiThreadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    setLoading(true)
    setError(null)
    try {
      const summary = await api.listAiThreads()
      if (requestSeq.current !== seq) return
      setThreads(sortThreads(summary))
    } catch (loadError) {
      if (requestSeq.current !== seq) return
      setError(describeAssistantError(loadError))
    } finally {
      if (requestSeq.current === seq) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const handleDelete = async (threadId: string) => {
    setDeletingId(threadId)
    try {
      await api.deleteAiThread(threadId)
      setThreads((current) => removeThread(current, threadId))
      setConfirmingId(null)
      onDeletedThread(threadId)
    } catch (deleteError) {
      setError(describeAssistantError(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-300 px-3 py-3 dark:border-zinc-800">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Conversations
        </h3>
        {onRequestClose ? (
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close conversation history"
            className="p-1 text-zinc-500 transition-colors hover:text-maroon dark:text-zinc-400 dark:hover:text-golden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onNewChat}
        className="mx-3 mt-3 flex shrink-0 items-center justify-center gap-1.5 border border-maroon px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-maroon transition-colors hover:bg-maroon hover:text-white dark:border-golden dark:text-golden dark:hover:bg-golden dark:hover:text-maroon-dark"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        New chat
      </button>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {error ? (
          <div className="mb-2 px-1" role="alert">
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-1 text-[10px] font-bold uppercase tracking-widest text-maroon underline-offset-2 hover:underline dark:text-golden"
            >
              Try again
            </button>
          </div>
        ) : null}

        {loading && threads.length === 0 ? (
          <div className="space-y-2 px-1" aria-busy="true" aria-label="Loading conversations">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="h-11 animate-pulse bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-900"
              />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <p className="px-1 py-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            No past conversations yet. Chats you start will appear here for seven days.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((thread) => {
              const active = thread.id === currentThreadId
              if (confirmingId === thread.id) {
                return (
                  <li
                    key={thread.id}
                    className="border-l-2 border-red-500/60 bg-red-500/5 px-2 py-2"
                  >
                    <p className="text-xs font-semibold text-foreground">Delete this chat?</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(thread.id)}
                        disabled={deletingId === thread.id}
                        className="inline-flex items-center gap-1 border border-red-600 bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                      >
                        {deletingId === thread.id ? (
                          <Loader2
                            className="h-3 w-3 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : null}
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-foreground dark:text-zinc-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                )
              }

              return (
                <li key={thread.id}>
                  <div
                    className={cn(
                      'group flex items-start gap-1 border-l-2 pr-1 transition-colors',
                      active
                        ? 'border-golden bg-golden/10'
                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/60',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectThread(thread.id)}
                      aria-current={active ? 'true' : undefined}
                      className="min-w-0 flex-1 px-2 py-2 text-left"
                    >
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {thread.title?.trim() || 'Untitled chat'}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {formatRelativeTime(thread.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(thread.id)}
                      aria-label={`Delete conversation ${thread.title?.trim() || 'Untitled chat'}`}
                      className="mt-2 shrink-0 p-1 text-zinc-400 opacity-100 transition-opacity hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
