'use client'

import { useCallback, useEffect, useState } from 'react'
import { CloudOff, Zap } from 'lucide-react'
import {
  armOutage,
  disarmOutage,
  formatOutageReceipt,
  isOutageArmed,
  subscribeToOutage,
} from '@polycheck/shared'
import {
  SYNC_STATE_EVENT,
  getPendingSyncCount,
  queueSequence,
  type OfflineQueueSequence,
} from '@/lib/offline/store'
import { api } from '@/lib/api-client'
import { useNotifications } from '@/lib/notifications'

const EMPTY_SEQUENCE: OfflineQueueSequence = { count: 0, lastId: null }

/**
 * F7 (WF-LD9) — "Drop-the-Mic" outage simulator, web demo surface.
 *
 * A floating maroon pill that arms the shared fetch killswitch: every request
 * rejects like a real network outage, so writes flow into the existing
 * encrypted IndexedDB queue and surface here with numbered receipts. RESUME
 * disarms, triggers the existing trusted-clock + queue drain flow, and shows
 * a reconcile toast rendered from the before/after pending counts.
 *
 * Mounted only where `NEXT_PUBLIC_ENABLE_OUTAGE_SIMULATOR === 'true'`
 * (cockpit + faculty dashboard); z-order sits above the assistant launcher
 * (z-40) and below the maintenance overlay (z-[100]).
 */
export function OutageSimulator() {
  const [armed, setArmed] = useState(isOutageArmed())
  const [sequence, setSequence] = useState<OfflineQueueSequence>(EMPTY_SEQUENCE)
  const [restoring, setRestoring] = useState(false)
  /** Pending-op count captured before the drain, for the Syncing n/m line. */
  const [beforeSyncCount, setBeforeSyncCount] = useState(0)
  const { addNotification } = useNotifications()

  useEffect(() => {
    setArmed(isOutageArmed())
    return subscribeToOutage(setArmed)
  }, [])

  const refreshSequence = useCallback(async () => {
    try {
      setSequence(await queueSequence())
    } catch {
      // Encrypted store unavailable — the chip simply shows an empty queue.
    }
  }, [])

  // The store emits SYNC_STATE_EVENT on every enqueue/delete; while armed the
  // receipt chip follows the queue live. During restore the same listener
  // drives the "Syncing n/m…" progress line.
  useEffect(() => {
    if (!armed) {
      setSequence(EMPTY_SEQUENCE)
      setBeforeSyncCount(0)
      return
    }
    void refreshSequence()
    window.addEventListener(SYNC_STATE_EVENT, refreshSequence)
    return () => window.removeEventListener(SYNC_STATE_EVENT, refreshSequence)
  }, [armed, refreshSequence])

  const handleArm = useCallback(() => {
    const proceed = window.confirm(
      'Simulate a campus network outage? Every request will fail locally until you press Restore & Replay.',
    )
    if (!proceed) return
    armOutage()
    addNotification(
      'info',
      'Outage Simulator Armed',
      'Requests now fail locally. Saved evidence lands in the encrypted queue with receipts.',
    )
  }, [addNotification])

  const handleResume = useCallback(async () => {
    if (restoring) return
    setRestoring(true)
    // Disarm first: the drain must fall back to live API calls immediately.
    disarmOutage()
    try {
      const before = await getPendingSyncCount()
      setBeforeSyncCount(before)
      // Existing post-outage flow: /health clock offset, queue drain, cache
      // refresh, storage persist. Deliberately not duplicated here.
      await api.preSyncOfflineData()
      const after = await getPendingSyncCount()
      const reconciled = Math.max(0, before - after)
      addNotification(
        'success',
        'Offline Queue Reconciled',
        `${reconciled} offline check-in${reconciled === 1 ? '' : 's'} reconciled`,
      )
    } catch (error) {
      addNotification(
        'error',
        'Restore Failed',
        error instanceof Error ? error.message : 'Some evidence remains queued. Try again.',
      )
    } finally {
      setRestoring(false)
      void refreshSequence()
    }
  }, [addNotification, refreshSequence, restoring])

  const syncing = Math.max(0, Math.min(beforeSyncCount - sequence.count, beforeSyncCount))
  const progress = beforeSyncCount > 0 ? `${syncing}/${beforeSyncCount}` : null

  return (
    <div
      role="region"
      aria-label="Network outage simulator"
      className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[45]"
    >
      {armed ? (
        <section
          data-testid="outage-panel"
          className="w-72 max-w-[calc(100vw-2.5rem)] border border-golden-dark bg-maroon-dark p-3 text-white shadow-lg"
        >
          <div
            data-testid="outage-banner"
            className="flex items-center gap-2 border border-amber-400/70 bg-amber-500/15 px-2 py-1.5"
            role="status"
          >
            <CloudOff className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
              Offline mode — local encrypted queue
              <span className="sr-only"> (simulated outage)</span>
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p
              data-testid="outage-receipt"
              className="font-mono text-[11px] font-semibold tracking-tight text-golden tabular-nums"
            >
              {formatOutageReceipt(sequence.count, sequence.lastId)}
            </p>
            <p className="text-[10px] text-zinc-300">
              {sequence.count === 0
                ? 'Queue empty'
                : `${sequence.count} evidence item${sequence.count === 1 ? '' : 's'} queued`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleResume()}
            disabled={restoring}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 border border-green-700 bg-green-600 px-4 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-golden disabled:cursor-wait disabled:opacity-60"
          >
            {restoring ? (
              <span className="flex items-center gap-2 tabular-nums">
                Syncing{progress ? ` ${progress}` : ''}…
              </span>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 text-golden" aria-hidden="true" />
                Restore &amp; Replay
              </>
            )}
          </button>
        </section>
      ) : (
        <button
          data-testid="outage-pill"
          type="button"
          onClick={handleArm}
          className="flex h-11 items-center gap-2 border border-maroon-dark bg-maroon px-4 text-[10px] font-bold uppercase tracking-widest text-golden shadow-lg transition-colors hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-golden focus-visible:ring-offset-2 dark:border-golden/40"
        >
          <Zap className="h-4 w-4 text-golden" aria-hidden="true" />
          <span>Simulate Outage</span>
          <span className="ml-1 rounded-sm border border-golden/50 px-1.5 py-0.5 text-[9px] leading-none">
            LIVE
          </span>
        </button>
      )}
      {armed ? (
        <p className="mt-1 text-right text-[9px] font-bold uppercase tracking-widest text-amber-300" aria-hidden="true">
          Simulator · OFFLINE
        </p>
      ) : null}
    </div>
  )
}
