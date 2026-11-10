'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { getServerClockOffset } from '@/lib/offline/store'

interface UseTrustedNowOptions {
  /** Refresh the offset from `/health` before the first read (login surfaces). */
  refreshOffset?: boolean
  tickMs?: number
}

/**
 * Ticks device time and exposes the cached `/health` clock offset so
 * countdowns read the trusted clock instead of the raw device clock. The
 * offset stays `null` until a capture is available; callers fall back to
 * device time only within that window. A failed refresh or read is ignored.
 */
export function useTrustedNow({
  refreshOffset = false,
  tickMs = 1_000,
}: UseTrustedNowOptions = {}) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [offsetMs, setOffsetMs] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const loadOffset = async () => {
      if (refreshOffset) {
        await api.refreshServerClockOffset().catch(() => undefined)
      }
      const offset = await getServerClockOffset().catch(() => null)
      if (alive && typeof offset === 'number') setOffsetMs(offset)
    }
    void loadOffset()
    const timer = window.setInterval(() => setNowMs(Date.now()), tickMs)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [refreshOffset, tickMs])

  return { nowMs, offsetMs }
}
