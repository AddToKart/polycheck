'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Expand, Shrink } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import {
  KIOSK_JOIN_EVENT,
  KIOSK_JOINED_EVENT,
  KIOSK_LEAVE_EVENT,
  SESSION_FINALE_EVENT,
  FINALE_COUNT_STATUSES,
  type AttendanceRecord,
  type FinaleCountStatus,
  type Session,
  type SessionFinaleSummary,
  type Student,
  type User,
} from '@polycheck/shared'
import { api, isNetworkFailure } from '@/lib/api-client'
import { API_BASE } from '@/lib/api-config'
import QRCode from 'qrcode'
import { pupColors } from '@/lib/colors'
import { LoadingSpinner } from '@/lib/hooks'
import KioskQrRing from '@/components/kiosk/KioskQrRing'
import KioskTicker, { addTickerEntry, pruneTicker } from '@/components/kiosk/KioskTicker'
import KioskCapacityRing from '@/components/kiosk/KioskCapacityRing'
import KioskFinale from '@/components/kiosk/KioskFinale'
import { isCheckedInStatus, verifiedDelta } from '@/components/kiosk/kiosk-verified'

/** Seeded ticker chips die ~6 s after load so the projector feels live. */
const TICKER_SEED_LIFETIME_MS = 6_000

interface KioskFinaleState {
  endedAt: string
  counts: Record<FinaleCountStatus, number>
  capacity: number
  /** `finale` = authoritative broadcast; `ended` = locally computed fallback. */
  source: 'finale' | 'ended'
}

interface ActiveToken {
  token: string
  issuedAt: number
  expiresAt: number
}

/** The live QR token for the stage: the in-person token, or the online
 * checkpoint whose window is still open (latest expiry wins). */
export function activeTokenForStage(session: Session, now: number): ActiveToken | null {
  if (session.mode === 'online') {
    const start = session.startQrToken
      ? {
          token: session.startQrToken,
          issuedAt: session.startQrGeneratedAt
            ? new Date(session.startQrGeneratedAt).getTime()
            : new Date(session.startTokenExpiresAt ?? now).getTime() -
              (session.startQrValiditySeconds ?? 90) * 1000,
          expiresAt: session.startTokenExpiresAt ? new Date(session.startTokenExpiresAt).getTime() : 0,
        }
      : null
    const end = session.endQrToken
      ? {
          token: session.endQrToken,
          issuedAt: session.endQrGeneratedAt
            ? new Date(session.endQrGeneratedAt).getTime()
            : new Date(session.endTokenExpiresAt ?? now).getTime() -
              (session.endQrValiditySeconds ?? 90) * 1000,
          expiresAt: session.endTokenExpiresAt ? new Date(session.endTokenExpiresAt).getTime() : 0,
        }
      : null
    const live = [start, end]
      .filter((arm): arm is ActiveToken => arm !== null && arm.expiresAt > now)
      .sort((left, right) => right.expiresAt - left.expiresAt)
    return live[0] ?? null
  }
  if (!session.qrToken || !session.qrTokenExpiresAt) return null
  return {
    token: session.qrToken,
    issuedAt: session.qrGeneratedAt
      ? new Date(session.qrGeneratedAt).getTime()
      : new Date(session.qrTokenExpiresAt).getTime() - session.qrValidityMinutes * 60_000,
    expiresAt: new Date(session.qrTokenExpiresAt).getTime(),
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function countdownLabel(remainingMs: number): string {
  if (remainingMs <= 0) return 'GRACE'
  const totalSeconds = Math.floor(remainingMs / 1000)
  return `${pad2(Math.floor(totalSeconds / 60))}:${pad2(totalSeconds % 60)}`
}

function recordsToCounts(records: AttendanceRecord[]): Record<FinaleCountStatus, number> {
  const totals: Record<FinaleCountStatus, number> = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    incomplete: 0,
    disputed: 0,
    pending: 0,
  }
  for (const record of records) {
    if ((FINALE_COUNT_STATUSES as readonly string[]).includes(record.status)) {
      totals[record.status as FinaleCountStatus] += 1
    }
  }
  return totals
}

function recordsToVerified(records: AttendanceRecord[]): number {
  return records.filter((record) => isCheckedInStatus(record.status)).length
}

// ── Session-room socket with the kiosk presence handshake. Mirrors realtime
// .ts's subscribeToSession pattern (outside this task's ownership; its helper
// carries no kiosk/finale wiring). The gateway ack arrives as the dedicated
// KIOSK_JOINED_EVENT envelope carrying kioskCount. ───────────────────────────

interface KioskSocketHandlers {
  onCheckIn: (event: {
    recordId: string
    studentId: string
    studentName?: string
    status: string
    timestamp: string
  }) => void
  onSessionState: (state: string) => void
  onFinale: (summary: SessionFinaleSummary) => void
  onKioskCount: (count: number) => void
}

function realtimeRoomUrl(): string {
  if (API_BASE.startsWith('/')) return `${window.location.origin}/attendance`
  return `${new URL(API_BASE).origin}/attendance`
}

function createKioskSocket(sessionId: string, handlers: KioskSocketHandlers): () => void {
  if (typeof window === 'undefined') return () => undefined
  const socket: Socket = io(realtimeRoomUrl(), {
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1_000,
    timeout: 8_000,
    transports: ['websocket'],
  })

  socket.on('connect', () => {
    // The session room carries the live events; the kiosk room is presence.
    socket.emit('session:join', { sessionId })
    socket.emit(KIOSK_JOIN_EVENT, { sessionId })
  })
  socket.on(KIOSK_JOINED_EVENT, (payload: { sessionId?: string; kioskCount?: number }) => {
    if (payload?.sessionId === sessionId) handlers.onKioskCount(payload.kioskCount ?? 0)
  })
  socket.on(
    'attendance:updated',
    (event: {
      sessionId?: string
      recordId?: string
      studentId?: string
      studentName?: string
      status?: string
      timestamp?: string
    }) => {
      if (event?.sessionId !== sessionId || !event.recordId || !event.status) return
      handlers.onCheckIn({
        recordId: event.recordId,
        studentId: event.studentId ?? '',
        studentName: event.studentName,
        status: event.status,
        timestamp: event.timestamp ?? new Date().toISOString(),
      })
    },
  )
  socket.on('session:state', (payload: { sessionId?: string; state?: string }) => {
    if (payload?.sessionId !== sessionId) return
    handlers.onSessionState(payload.state ?? 'updated')
  })
  socket.on(SESSION_FINALE_EVENT, (summary: SessionFinaleSummary) => {
    if (summary?.sessionId !== sessionId) return
    handlers.onFinale(summary)
  })

  return () => {
    socket.emit('session:leave', { sessionId })
    socket.emit(KIOSK_LEAVE_EVENT, { sessionId })
    socket.removeAllListeners()
    socket.disconnect()
  }
}

// Suppresses the floating assistant bubble (z-40) mounted by the faculty
// layout so the projector stays chrome-free; no-op where `:has()` is
// unsupported. Inline because the faculty layout file is not this task's own.
const KIOSK_ASSISTANT_SUPPRESS_CSS = `
html:has([data-polycheck-kiosk-active]) [aria-label="Open faculty assistant"],
html:has([data-polycheck-kiosk-active]) [aria-label="Open super admin assistant"] { display: none !important; }
`

export default function SessionKioskPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [sectionLabel, setSectionLabel] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [finale, setFinale] = useState<KioskFinaleState | null>(null)
  const [verified, setVerified] = useState(0)
  const [tickerEntries, setTickerEntries] = useState<ReturnType<typeof addTickerEntry>>([])
  const [kioskCount, setKioskCount] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const stageRef = useRef<HTMLElement | null>(null)
  // Last observed status per record id. A cockpit override must move the
  // "verified" ring, so events are applied as deltas, not first-seen counts.
  const recordStatusRef = useRef<Map<string, string>>(new Map())
  const finaleEndedAtRef = useRef<string | null>(null)
  // Roster refs keep the socket registration effect off churny list data.
  const studentsRef = useRef<Student[]>([])
  const sectionIdRef = useRef('')

  // ── Counters / finale helpers ──────────────────────────────────────────

  const finalizeFromSummary = useCallback(
    (
      summary: { endedAt: string; counts: Record<FinaleCountStatus, number>; capacity: number },
      source: KioskFinaleState['source'],
    ) => {
      if (finaleEndedAtRef.current === summary.endedAt) return
      finaleEndedAtRef.current = summary.endedAt
      setFinale({ ...summary, source })
    },
    [],
  )

  const refetchRecords = useCallback(async (sessionId: string): Promise<AttendanceRecord[]> => {
      try {
        const nextRecords = await api.getAttendanceRecords(sessionId)
        setVerified(recordsToVerified(nextRecords))
        recordStatusRef.current = new Map(nextRecords.map((record) => [record.id, record.status]))
        return nextRecords
      } catch {
        // Documented degraded mode: the finale broadcast still lands, so a
        // failed reconcile keeps the last known counts instead of blanking
        // the projector. The next refetch (cutover/finale) repairs them.
        return []
      }
  }, [])

  const endedFallback = useCallback(async () => {
    const finalRecords = await refetchRecords(id)
    finalizeFromSummary(
      {
        endedAt: new Date().toISOString(),
        counts: recordsToCounts(finalRecords),
        capacity: studentsRef.current.length,
      },
      'ended',
    )
  }, [finalizeFromSummary, id, refetchRecords])

  // ── Initial load (parallel reads like the cockpit) ────────────────────

  const initialize = useCallback(async () => {
    const currentUser = api.getCurrentUser()
    if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'super_admin')) {
      setRedirecting(true)
      router.replace('/')
      return
    }
    if (!id) return
    setUser(currentUser)
    setLoading(true)
    setError(null)
    setRedirecting(false)
    try {
      const nextSession = await api.getSession(id)
      const section = await api.getSection(nextSession.sectionId)
      if (currentUser.role === 'teacher' && section.teacherId !== currentUser.id) {
        setRedirecting(true)
        router.replace('/faculty')
        return
      }
      const [nextStudents, nextRecords] = await Promise.all([
        api.getSectionStudents(section.id),
        api.getAttendanceRecords(id).catch((caught: unknown) => {
          if (isNetworkFailure(caught)) return [] as AttendanceRecord[]
          throw caught
        }),
      ])
      const roster = nextStudents as Student[]
      studentsRef.current = roster
      sectionIdRef.current = nextSession.sectionId
      setSession(nextSession)
      setSectionLabel(section.section ?? '')
      setStudents(roster)
      setVerified(recordsToVerified(nextRecords))
      recordStatusRef.current = new Map(nextRecords.map((record) => [record.id, record.status]))
      // Seed the ticker with the most recent check-ins so late joiners land
      // on a live-looking feed; they share one seen-time and expire together.
      const recentCheckIns = [...nextRecords]
        .filter((record) => record.status === 'present' || record.status === 'late')
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .slice(0, 5)
        .reverse()
        .map((record) => ({
          recordId: record.id,
          studentName: record.studentName,
          status: record.status,
          timestamp: record.timestamp,
        }))
      const seededNow = Date.now() - TICKER_SEED_LIFETIME_MS // expire soon after load
      let seeded: ReturnType<typeof addTickerEntry> = []
      for (const event of recentCheckIns) {
        seeded = addTickerEntry(seeded, event, seededNow)
      }
      setTickerEntries(seeded)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The kiosk could not load the session')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    void initialize()
  }, [initialize])

  // ── Live check-ins: ticker chip + counts reconciled against the roster ──

  const handleCheckInEvent = useCallback(
    (event: {
      recordId: string
      studentId: string
      studentName?: string
      status: string
      timestamp: string
    }) => {
      const previousStatus = recordStatusRef.current.get(event.recordId)
      recordStatusRef.current.set(event.recordId, event.status)
      if (previousStatus === undefined) {
        setTickerEntries((previous) => addTickerEntry(previous, event, Date.now()))
      }
      const delta = verifiedDelta(previousStatus, event.status)
      if (delta !== 0) {
        setVerified((previous) => Math.max(0, previous + delta))
      }
    },
    [],
  )

  useEffect(() => {
    if (!id || loading || redirecting || !user) return
    return createKioskSocket(id, {
      onCheckIn: handleCheckInEvent,
      onSessionState: (state) => {
        // Re-armed QR re-keys the stage; `ended` resolves the fallback finale
        // (the authoritative `session:finale` broadcast usually beats it —
        // duplicate deliveries dedupe on `endedAt`).
        if (state === 'ended') {
          void endedFallback()
        } else {
          void api
            .getSession(id)
            .then((nextSession) => setSession(nextSession))
            .catch(() => undefined)
        }
      },
      onFinale: (summary) => {
        finalizeFromSummary(summary, 'finale')
        void refetchRecords(id)
      },
      onKioskCount: (count) => setKioskCount(count),
    })
  }, [id, loading, redirecting, user, handleCheckInEvent, endedFallback, finalizeFromSummary, refetchRecords])

  // ── One-second clock: ring countdown + ticker expiry ──────────────────

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now())
      setTickerEntries((previous) => pruneTicker(previous, Date.now()))
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [])

  // ── Active token + QR rendering ───────────────────────────────────────

  const tokenTimer = useMemo(
    () => (session ? activeTokenForStage(session, nowTick) : null),
    [session, nowTick],
  )

  const liveToken = tokenTimer?.token ?? null

  useEffect(() => {
    let active = true
    setQrError(null)
    if (!liveToken) {
      setQrDataUrl(null)
      return
    }
    void QRCode.toDataURL(liveToken, {
      width: 1024,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: pupColors.black, light: pupColors.white },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setQrDataUrl(null)
        setQrError(caught instanceof Error ? caught.message : 'The QR image could not be rendered')
      })
    return () => {
      active = false
    }
  }, [liveToken])

  // ── Fullscreen + keyboard ─────────────────────────────────────────────

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    } else if (typeof stage.requestFullscreen === 'function') {
      void stage.requestFullscreen().catch(() => undefined)
    }
    // Fullscreen API unsupported → no-op by design.
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        toggleFullscreen()
      }
      // In fullscreen the browser consumes Esc to exit; outside it navigates
      // back to the cockpit.
      if (event.key === 'Escape' && !document.fullscreenElement) {
        router.push(`/faculty/sessions/${id}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, router, toggleFullscreen])

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-maroon" role="status">
        <p className="sr-only">Loading the attendance projector view</p>
        <LoadingSpinner size="lg" />
        <p className="font-heading text-lg text-golden">Loading projector…</p>
      </main>
    )
  }
  if (redirecting) {
    return (
      <main className="fixed inset-0 z-30 bg-maroon" role="status">
        <p className="sr-only">Redirecting</p>
      </main>
    )
  }
  if (error || !session || !user) {
    return (
      <main className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-maroon px-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-golden">Projector unavailable</p>
        <h1 className="font-heading text-2xl font-bold text-white">{error ?? 'Session not found'}</h1>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => void initialize()}
            className="border border-golden px-4 py-2 text-xs font-bold uppercase tracking-widest text-golden hover:bg-golden/10"
          >
            Retry
          </button>
          <Link
            href="/faculty/sessions"
            className="border border-zinc-400 px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-200 hover:bg-white/10"
          >
            Back to sessions
          </Link>
        </div>
      </main>
    )
  }

  const remainingMs = liveToken ? Math.max(0, (tokenTimer?.expiresAt ?? 0) - nowTick) : null
  const totalMs = liveToken ? Math.max(1, (tokenTimer?.expiresAt ?? 0) - (tokenTimer?.issuedAt ?? 0)) : null
  const countdown = remainingMs !== null ? countdownLabel(remainingMs) : null
  const liveCountdown = !finale && session.isActive && liveToken ? countdown : null

  const verifiedNow = finale
    ? (finale.counts.present ?? 0) + (finale.counts.late ?? 0) + (finale.counts.incomplete ?? 0)
    : verified
  const capacityNow = finale ? finale.capacity : students.length
  const statusChip = finale ? 'Ended' : session.isActive ? 'Live' : 'Not started'

  return (
    <main
      ref={stageRef}
      data-polycheck-kiosk-active="true"
      className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-maroon text-white"
      aria-label="Attendance projection mode"
    >
      <style dangerouslySetInnerHTML={{ __html: KIOSK_ASSISTANT_SUPPRESS_CSS }} />

      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0">
          <h1 className="font-heading truncate text-2xl font-bold text-white sm:text-3xl">
            {session.subjectName}
            {sectionLabel ? <span className="font-normal text-golden"> · {sectionLabel}</span> : null}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-200">
            {session.room ? `${session.room} · ` : ''}
            {new Date(session.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}{' '}
            · {session.startTime}–{session.endTime} · {statusChip}
            {finale && finale.source === 'ended' ? ' · server close' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="kiosk-viewer-count"
            className="border border-zinc-400/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-200 tabular-nums"
          >
            Projectors viewing: {kioskCount}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen (f)' : 'Enter fullscreen (f)'}
            className="inline-flex h-10 min-h-10 w-10 items-center justify-center border border-zinc-400/50 text-zinc-100 hover:bg-white/10"
          >
            {isFullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </button>
          <Link
            href={`/faculty/sessions/${id}`}
            aria-label="Back to the session cockpit (Esc)"
            className="inline-flex h-10 min-h-10 w-10 items-center justify-center border border-zinc-400/50 text-zinc-100 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 pb-10">
        {qrError ? (
          <p
            className="border border-red-400 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
            role="alert"
          >
            {qrError}
          </p>
        ) : null}
        <KioskQrRing
          qrDataUrl={qrDataUrl}
          remainingMs={remainingMs}
          totalMs={totalMs}
          countdownLabel={liveCountdown}
          sizePx={340}
          ariaLabel="Session QR validity ring"
        />
        <KioskCapacityRing verified={verifiedNow} capacity={capacityNow} />
      </div>

      <footer className="border-t border-golden/30 bg-maroon-dark/75 px-6 py-3">
        <KioskTicker entries={tickerEntries} />
      </footer>

      {finale ? (
        <KioskFinale
          summary={{
            sessionId: session.id,
            endedAt: finale.endedAt,
            counts: finale.counts,
            capacity: finale.capacity,
          }}
          subjectName={session.subjectName}
          sectionLabel={sectionLabel}
        />
      ) : null}
    </main>
  )
}
