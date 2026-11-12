'use client'

import { useCallback, useRef, useState } from 'react'
import { useNotifications } from '@/lib/notifications'

/**
 * DD-4 locked decision: every page mutation goes through one helper so a
 * handler can never (a) double-fire on a double click, (b) reject unhandled,
 * or (c) fail invisibly. Failures surface as a notification (and optionally
 * through a page-local `onError` for inline copy).
 */
export function describeMutationError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export interface MutationSuccess {
  title: string
  message: string
}

export interface MutationOptions<T> {
  /** Notification title used when the mutation rejects. */
  errorTitle?: string
  /** Optional success notification emitted after the task resolves. */
  success?: MutationSuccess
  /** Page-local hook (inline error copy, closing a dialog, refetching). */
  onSuccess?: (result: T) => void
  /** Runs in addition to the error notification; use for inline copy. */
  onError?: (error: unknown) => void
  /** Disable the failure notification (inline UI is the only surfacing). */
  silent?: boolean
}

export interface MutationController {
  /**
   * Runs `task` unless the same `action` key is already in flight. Resolves
   * with the task result, or `null` when the call was skipped or rejected —
   * callers must not treat `null` as success.
   */
  run: <T>(
    action: string,
    task: () => Promise<T>,
    options?: MutationOptions<T>,
  ) => Promise<T | null>
  /** True while the given action key is in flight (for `disabled`). */
  isPending: (action: string) => boolean
  /** The most recently started action key, or null. */
  pendingAction: string | null
}

export function useRunMutation(): MutationController {
  const { addNotification } = useNotifications()
  const inFlight = useRef(new Set<string>())
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const run = useCallback(
    async <T>(
      action: string,
      task: () => Promise<T>,
      options: MutationOptions<T> = {},
    ): Promise<T | null> => {
      if (inFlight.current.has(action)) return null
      inFlight.current.add(action)
      setPending((current) => ({ ...current, [action]: true }))
      try {
        const result = await task()
        if (options.success) {
          addNotification('success', options.success.title, options.success.message)
        }
        options.onSuccess?.(result)
        return result
      } catch (error) {
        options.onError?.(error)
        if (!options.silent) {
          addNotification(
            'error',
            options.errorTitle ?? 'Action failed',
            describeMutationError(error),
          )
        }
        return null
      } finally {
        inFlight.current.delete(action)
        setPending((current) => {
          if (!current[action]) return current
          const next = { ...current }
          delete next[action]
          return next
        })
      }
    },
    [addNotification],
  )

  const isPending = useCallback((action: string) => Boolean(pending[action]), [pending])

  const pendingAction = Object.keys(pending)[0] ?? null

  return { run, isPending, pendingAction }
}
