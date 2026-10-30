'use client'

import { useCallback, useEffect, useState } from 'react'
import { CloudDownload, ShieldCheck } from 'lucide-react'
import { formatCampusDate } from '@polycheck/shared/utils'
import { api } from '@/lib/api-client'
import {
  SYNC_STATE_EVENT,
  getCachedSessions,
  getEnrolledSectionIds,
  getServerClockOffset,
} from '@/lib/offline/store'

type Readiness = 'checking' | 'ready' | 'needs-sync'

function tomorrowCampusDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return formatCampusDate(date)
}

/**
 * Pre-session sync readiness (M3): the student can scan offline only when the
 * class data, section enrollment and trusted clock were cached in a prior
 * online session.
 */
export function OfflineReadinessChip() {
  const [state, setState] = useState<Readiness>('checking')
  const [preparing, setPreparing] = useState(false)

  const evaluate = useCallback(async () => {
    const [sessions, sectionIds, clockOffset] = await Promise.all([
      getCachedSessions(),
      getEnrolledSectionIds(),
      getServerClockOffset(),
    ])
    const today = formatCampusDate()
    const tomorrow = tomorrowCampusDate()
    const hasRelevantSessions = sessions.some(
      (session) => session.date === today || session.date === tomorrow,
    )
    setState(
      hasRelevantSessions && sectionIds.length > 0 && clockOffset !== null
        ? 'ready'
        : 'needs-sync',
    )
  }, [])

  useEffect(() => {
    void evaluate()
    const onState = () => void evaluate()
    window.addEventListener(SYNC_STATE_EVENT, onState)
    return () => window.removeEventListener(SYNC_STATE_EVENT, onState)
  }, [evaluate])

  const prepare = async () => {
    setPreparing(true)
    try {
      await api.preSyncOfflineData()
    } catch {
      // The chip re-evaluates cached state below; the offline panel surfaces failures.
    } finally {
      setPreparing(false)
      await evaluate()
    }
  }

  if (state === 'checking') return null

  if (state === 'ready') {
    return (
      <p
        className="inline-flex items-center gap-2 border border-golden/40 bg-golden/10 px-3 py-1.5 text-xs font-bold text-maroon-dark dark:text-golden"
        data-testid="offline-readiness"
      >
        <ShieldCheck size={14} aria-hidden="true" />
        Ready for offline class
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void prepare()}
      disabled={preparing}
      data-testid="offline-readiness"
      className="inline-flex items-center gap-2 border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-maroon transition-colors hover:border-golden disabled:opacity-60 dark:border-golden/25 dark:bg-surface-dark dark:text-golden"
    >
      <CloudDownload size={14} className={preparing ? 'animate-pulse' : ''} aria-hidden="true" />
      {preparing ? 'Preparing offline data…' : 'Prepare for offline class'}
    </button>
  )
}
