'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, CloudOff, Cloud } from 'lucide-react'
import { api } from '@/lib/api-client'
import {
  SYNC_REQUEST_EVENT,
  SYNC_STATE_EVENT,
  getLastSyncAt,
  getOfflineQueueIssues,
  getPendingSyncCount,
  retryOfflineOperation,
  type OfflineQueueIssue,
} from '@/lib/offline/store'

function formatLastSync(value: string | null): string {
  if (!value) return 'Not synced yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not synced yet'
  return `Last sync ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function kindLabel(kind: OfflineQueueIssue['kind']): string {
  switch (kind) {
    case 'attendance_scan':
    case 'scan_attempt':
      return 'Check-in'
    case 'attendance_manual':
    case 'attendance_status':
      return 'Manual attendance'
    case 'session_activation':
      return 'QR activation'
    case 'session_end':
      return 'Session end'
  }
}

/**
 * Queue/status surface for the offline-first web app. Mounted on student and
 * faculty dashboards; also owns the opportunistic drain triggers: immediately on
 * mount (no cold-boot gap), on online/visibility, on post-action requests from
 * the store, and on a 30 s tick that backs off exponentially (capped at
 * `MAX_DRAIN_BACKOFF_MS`) while drains make no progress.
 */
/** Cadence between drain attempts while the queue is healthy. */
const DRAIN_INTERVAL_MS = 30_000
/** Hard cap for the exponential retry backoff (never retry slower than this). */
const MAX_DRAIN_BACKOFF_MS = 5 * 60_000
/** Largest exponent used, so `base * 2 ** n` can never overflow the cap math. */
const MAX_BACKOFF_STEP = 8

export function OfflineSyncPanel({ className = '' }: { className?: string }) {
  const [pending, setPending] = useState(0)
  const [issues, setIssues] = useState<OfflineQueueIssue[]>([])
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lowStorage, setLowStorage] = useState(false)
  const syncingRef = useRef(false)
  const pendingRef = useRef(0)
  const backoffRef = useRef(0)
  const nextAttemptAtRef = useRef(0)

  const refresh = useCallback(async () => {
    const count = await getPendingSyncCount()
    pendingRef.current = count
    setPending(count)
    setIssues(await getOfflineQueueIssues())
    setLastSyncAt(await getLastSyncAt())
  }, [])

  /**
   * One drain attempt. Resolves true only when the queue is empty or the attempt
   * made measurable progress, so a failing endpoint backs off instead of being
   * hammered every tick.
   */
  const drain = useCallback(async (): Promise<boolean> => {
    if (syncingRef.current) return true
    if (pendingRef.current === 0) return true
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false
    if (!api.getCurrentUser()) return false
    syncingRef.current = true
    setSyncing(true)
    const before = pendingRef.current
    let completed = false
    try {
      await api.syncOfflineQueue()
      completed = true
    } catch {
      // Remaining entries stay queued; the scheduler retries with backoff.
      completed = false
    } finally {
      syncingRef.current = false
      setSyncing(false)
      await refresh()
    }
    const after = pendingRef.current
    return completed && (after === 0 || after < before)
  }, [refresh])

  /** Drains, then arms the next attempt: base cadence on success, exponential backoff on failure. */
  const runScheduledDrain = useCallback(async () => {
    const progressed = await drain()
    backoffRef.current = progressed
      ? 0
      : Math.min(backoffRef.current + 1, MAX_BACKOFF_STEP)
    const delayMs = progressed
      ? DRAIN_INTERVAL_MS
      : Math.min(DRAIN_INTERVAL_MS * 2 ** backoffRef.current, MAX_DRAIN_BACKOFF_MS)
    nextAttemptAtRef.current = Date.now() + delayMs
  }, [drain])

  /** Explicit trigger (queue event, online, visibility, Sync button). */
  const drainNow = useCallback(async () => {
    backoffRef.current = 0
    nextAttemptAtRef.current = 0
    await runScheduledDrain()
  }, [runScheduledDrain])

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (Date.now() < nextAttemptAtRef.current) return
      void runScheduledDrain()
    }
    const onState = () => void refresh()
    const onRequest = () => {
      void drainNow()
    }
    const goOnline = () => {
      setOnline(true)
      onRequest()
    }
    const goOffline = () => setOnline(false)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onRequest()
    }
    window.addEventListener(SYNC_STATE_EVENT, onState)
    window.addEventListener(SYNC_REQUEST_EVENT, onRequest)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(tick, DRAIN_INTERVAL_MS)
    // Cold boot: load the queue counts, then drain immediately instead of
    // waiting a full interval for the first attempt.
    void refresh().then(() => {
      if (cancelled) return
      void drainNow()
    })
    return () => {
      cancelled = true
      window.removeEventListener(SYNC_STATE_EVENT, onState)
      window.removeEventListener(SYNC_REQUEST_EVENT, onRequest)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [drainNow, refresh, runScheduledDrain])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return
    const check = async () => {
      try {
        const estimate = await navigator.storage.estimate()
        const quota = estimate.quota ?? 0
        setLowStorage(quota > 0 && quota - (estimate.usage ?? 0) < 50 * 1024 * 1024)
      } catch {
        setLowStorage(false)
      }
    }
    void check()
  }, [pending])

  const failed = issues.filter((issue) => issue.failed)
  const visibleIssues = issues.slice(0, 3)

  return (
    <section
      aria-label="Offline sync status"
      className={`border border-zinc-200 bg-white p-4 dark:border-golden/15 dark:bg-surface-dark ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {online ? (
            <Cloud size={16} className="text-maroon dark:text-golden" aria-hidden="true" />
          ) : (
            <CloudOff size={16} className="text-golden" aria-hidden="true" />
          )}
          <p className="text-xs font-bold uppercase tracking-widest text-maroon dark:text-golden">
            Offline sync
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatLastSync(lastSyncAt)}</span>
          <button
            type="button"
            onClick={() => void drainNow()}
            disabled={syncing || !online || pending === 0}
            className="inline-flex items-center gap-1 border border-zinc-300 px-2 py-1 font-semibold text-maroon transition-colors disabled:opacity-40 dark:border-golden/25 dark:text-golden"
            aria-label="Sync pending attendance now"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} aria-hidden="true" />
            Sync
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300" data-testid="offline-pending-count">
        {pending === 0
          ? 'All attendance evidence is synced.'
          : `${pending} saved ${pending === 1 ? 'item' : 'items'} waiting to sync.`}
        {failed.length > 0 ? ` ${failed.length} need attention.` : ''}
      </p>

      {visibleIssues.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {visibleIssues.map((issue) => (
            <li
              key={issue.id}
              className={`flex flex-wrap items-center justify-between gap-2 border-l-4 px-3 py-2 text-xs ${
                issue.failed
                  ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                  : 'border-golden bg-golden/10 text-maroon-dark dark:text-golden'
              }`}
            >
              <span className="font-semibold">
                {kindLabel(issue.kind)} · {issue.error}
              </span>
              {issue.failed ? (
                <button
                  type="button"
                  onClick={() => {
                    void retryOfflineOperation(issue.id).then(() => drainNow())
                  }}
                  className="font-bold underline underline-offset-2"
                >
                  Retry
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {lowStorage ? (
        <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400" role="alert">
          Device storage is running low. Free space to keep offline attendance available.
        </p>
      ) : null}
    </section>
  )
}
