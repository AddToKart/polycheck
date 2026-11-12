'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ArrowLeft, QrCode, Timer, Play, StopCircle, Maximize, RefreshCw, Users, ChevronRight, Edit3, Camera, Trash2, Copy, Download, Check, School, Video, ShieldCheck, KeyRound, Radio, MonitorPlay } from 'lucide-react'
import { api, isNetworkFailure, ApiHttpError, requestUserLogout } from '@/lib/api-client'
import { randomMeetingPin } from '@polycheck/shared'
import type { User, Session, AttendanceRecord, AttendanceStatus, EditableAttendanceStatus, Student, ProofOfClass } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/lib/hooks'
import { useNotifications } from '@/lib/notifications'
import { useRunMutation } from '@/lib/run-mutation'
import CampusMap from '@/components/CampusMap'
import { subscribeToSession } from '@/lib/realtime'
import { pupColors } from '@/lib/colors'
import { SessionRequestCoordinator } from '@/lib/session-request-coordinator'
import { OutageSimulator } from '@/components/dev/OutageSimulator'
import QRCode from 'qrcode'

// F2 radar opens as a cockpit dialog; maplibre and its worker chain load only
// when the teacher actually opens it.
const GeofenceRadarModal = dynamic(
  () => import('@/components/radar/GeofenceRadarModal'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-10" role="status">
        <LoadingSpinner size="lg" />
        <span className="sr-only">Loading geofence radar…</span>
      </div>
    ),
  },
)

const STATUS_CYCLE: EditableAttendanceStatus[] = ['present', 'late', 'incomplete', 'absent']

const STATUS_STYLES: Record<string, string> = {
  present: 'bg-golden text-maroon-dark',
  late: 'bg-maroon text-white',
  absent: 'bg-maroon-dark text-golden border border-golden',
  excused: 'bg-maroon text-golden border border-golden',
  pending: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  disputed: 'bg-maroon-dark text-golden border border-golden',
  incomplete: 'bg-white text-maroon-dark border border-dashed border-maroon dark:bg-transparent dark:text-golden dark:border-golden',
}

const DEFAULT_CHECKPOINT_VALIDITY_SECONDS = '90'
const DEFAULT_CHECKPOINT_GRACE_MINUTES = '10'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.'

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { addNotification } = useNotifications()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([])
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all')
  const [proofsOfClass, setProofsOfClass] = useState<ProofOfClass[]>([])
  const [loading, setLoading] = useState(true)
  const [initializationError, setInitializationError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [showValidityPrompt, setShowValidityPrompt] = useState(false)
  const [checkpointTab, setCheckpointTab] = useState<'start' | 'end'>('start')
  const [showCheckpointPrompt, setShowCheckpointPrompt] = useState(false)
  const [checkpointValiditySeconds, setCheckpointValiditySeconds] = useState(DEFAULT_CHECKPOINT_VALIDITY_SECONDS)
  const [checkpointGraceMinutes, setCheckpointGraceMinutes] = useState(DEFAULT_CHECKPOINT_GRACE_MINUTES)
  const [checkpointPinRequired, setCheckpointPinRequired] = useState(false)
  const [checkpointPin, setCheckpointPin] = useState('')
  const [checkpointPinError, setCheckpointPinError] = useState('')
  const [regeneratingCheckpoint, setRegeneratingCheckpoint] = useState(false)
  const [startPinPlain, setStartPinPlain] = useState<string | null>(null)
  const [endPinPlain, setEndPinPlain] = useState<string | null>(null)
  const [validityMinutes, setValidityMinutes] = useState('15')
  const [graceMinutes, setGraceMinutes] = useState('15')
  const [countdown, setCountdown] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now())
  const [refreshLabel, setRefreshLabel] = useState('Updated just now')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const { run, isPending } = useRunMutation()
  // F2 radar / F1 kiosk entry points.
  const [radarOpen, setRadarOpen] = useState(false)
  // V4 anti-ghost-professor: captured teacher fix + pending override dialog.
  const teacherFixRef = useRef<{ latitude: number; longitude: number } | null>(null)
  const teacherConflictEpochRef = useRef(0)
  const [teacherLocationConflict, setTeacherLocationConflict] = useState<{
    distanceMeters: number
    allowedDistanceMeters: number
  } | null>(null)
  const requestInFlightRef = useRef(false)
  const queuedRefreshRef = useRef(false)
  const requestCoordinatorRef = useRef(new SessionRequestCoordinator())
  // Indirection so the refresh callback can re-run itself without recursion
  // (React Compiler cannot preserve memoization for self-referential callbacks).
  const refreshDataRef = useRef<() => Promise<boolean>>(async () => false)

  const runQueuedRefresh = useCallback(() => {
    if (!queuedRefreshRef.current) return
    queuedRefreshRef.current = false
    void refreshDataRef.current()
  }, [])

  const refreshData = useCallback(async ({ reconcile = false }: { reconcile?: boolean } = {}) => {
    if (!id) return false
    if (!reconcile && requestInFlightRef.current) {
      // An update (e.g. a realtime event) arrived while another request was in
      // flight; queue one trailing refresh so it is not permanently dropped.
      queuedRefreshRef.current = true
      return false
    }
    if (reconcile) requestCoordinatorRef.current.resetForReconciliation()
    else requestInFlightRef.current = true
    const readEpoch = requestCoordinatorRef.current.beginRead()
    setRefreshing(true)
    try {
      const [s, nextRecords, nextProofs] = await Promise.all([
        api.getSession(id),
        api.getAttendanceRecords(id),
        api.getProofsOfClass(id).catch((error) => {
          if (isNetworkFailure(error)) return [] as ProofOfClass[]
          throw error
        }),
      ])
      if (!requestCoordinatorRef.current.canCommitRead(readEpoch)) return false
      setSession(s)
      setRecords(nextRecords)
      setProofsOfClass(nextProofs)
      setValidityMinutes(String(Math.min(s.qrValidityMinutes || 15, 15)))
      setGraceMinutes(String(Math.min(s.gracePeriodMinutes || 15, 60)))
      setRefreshError(null)
      setRefreshLabel('Updated just now')
      setLastUpdatedAt(Date.now())
      return true
    } catch (error) {
      if (requestCoordinatorRef.current.canCommitRead(readEpoch)) setRefreshError(getErrorMessage(error))
      return false
    } finally {
      if (!reconcile) requestInFlightRef.current = false
      setRefreshing(false)
      if (!reconcile) runQueuedRefresh()
    }
  }, [id, runQueuedRefresh])

  useEffect(() => {
    refreshDataRef.current = refreshData
  }, [refreshData])

  const initialize = useCallback(async () => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      setRedirecting(true)
      router.replace('/')
      return
    }
    if (!id || requestInFlightRef.current) return

    setUser(cu)
    setLoading(true)
    setInitializationError(null)
    setRedirecting(false)
    requestInFlightRef.current = true
    const readEpoch = requestCoordinatorRef.current.beginRead()
    try {
      const [nextSession, nextRecords, nextProofs] = await Promise.all([
        api.getSession(id),
        api.getAttendanceRecords(id),
        api.getProofsOfClass(id).catch((error) => {
          if (isNetworkFailure(error)) return [] as ProofOfClass[]
          throw error
        }),
      ])
      const section = await api.getSection(nextSession.sectionId)
      if (cu.role === 'teacher' && section.teacherId !== cu.id) {
        setRedirecting(true)
        router.replace('/faculty')
        return
      }
      const students = await api.getSectionStudents(section.id)

      if (!requestCoordinatorRef.current.canCommitRead(readEpoch)) return
      setSession(nextSession)
      setRecords(nextRecords)
      setProofsOfClass(nextProofs)
      setValidityMinutes(String(Math.min(nextSession.qrValidityMinutes || 15, 15)))
      setGraceMinutes(String(Math.min(nextSession.gracePeriodMinutes || 15, 60)))
      setEnrolledStudents(students as Student[])
      setRefreshLabel('Updated just now')
      setLastUpdatedAt(Date.now())
    } catch (error) {
      if (requestCoordinatorRef.current.canCommitRead(readEpoch)) setInitializationError(getErrorMessage(error))
    } finally {
      requestInFlightRef.current = false
      setLoading(false)
      runQueuedRefresh()
    }
  }, [id, router, runQueuedRefresh])

  useEffect(() => {
    void initialize()
  }, [initialize])

  const onlineMode = session?.mode === 'online'
  const qrToken = onlineMode
    ? checkpointTab === 'start'
      ? session?.startQrToken ?? null
      : session?.endQrToken ?? null
    : session?.qrToken ?? null
  useEffect(() => {
    let active = true
    setQrError(null)
    if (!qrToken) {
      setQrDataUrl(null)
      return () => { active = false }
    }

    void QRCode.toDataURL(qrToken, {
      width: 1024,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: pupColors.black, light: pupColors.white },
    }).then((dataUrl) => {
      if (active) setQrDataUrl(dataUrl)
    }).catch((error) => {
      if (!active) return
      setQrDataUrl(null)
      setQrError(getErrorMessage(error))
    })

    return () => { active = false }
  }, [qrToken])

  useEffect(() => {
    if (!id) return
    return subscribeToSession(id, () => { void refreshData() }, setRealtimeConnected)
  }, [id, refreshData])

  useEffect(() => {
    if (!session?.isActive || realtimeConnected) return
    const poll = setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      void refreshData()
    }, 10000)
    return () => clearInterval(poll)
  }, [session?.isActive, realtimeConnected, refreshData])

  useEffect(() => {
    const updateLabel = () => {
      const seconds = Math.floor((Date.now() - lastUpdatedAt) / 1000)
      if (seconds < 5) setRefreshLabel('Updated just now')
      else if (seconds < 60) setRefreshLabel(`Updated ${seconds}s ago`)
      else setRefreshLabel(`Updated ${Math.floor(seconds / 60)}m ago`)
    }
    updateLabel()
    const timer = setInterval(updateLabel, 5000)
    return () => clearInterval(timer)
  }, [lastUpdatedAt])

  const sessionIsActive = session?.isActive ?? false
  const qrTokenExpiresAt = onlineMode
    ? checkpointTab === 'start'
      ? session?.startTokenExpiresAt ?? null
      : session?.endTokenExpiresAt ?? null
    : session?.qrTokenExpiresAt ?? null
  const gracePeriodMinutes =
    (onlineMode
      ? checkpointTab === 'start'
        ? session?.startGraceMinutes
        : session?.endGraceMinutes
      : session?.gracePeriodMinutes) ?? 0
  useEffect(() => {
    if (!sessionIsActive || !qrTokenExpiresAt) {
      setCountdown('')
      return
    }
    const expiresAt = new Date(qrTokenExpiresAt).getTime()
    const tick = () => {
      const diff = expiresAt - Date.now()
      if (diff <= 0) {
        const graceDiff = expiresAt + gracePeriodMinutes * 60 * 1000 - Date.now()
        setCountdown(graceDiff <= 0 ? 'Grace ended' : `Grace: ${String(Math.floor(graceDiff / 60000)).padStart(2, '0')}:${String(Math.floor((graceDiff % 60000) / 1000)).padStart(2, '0')}`)
        return
      }
      setCountdown(`${String(Math.floor(diff / 60000)).padStart(2, '0')}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')}`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [sessionIsActive, qrTokenExpiresAt, gracePeriodMinutes])

  if (loading) return (
    <div className="flex h-screen flex-col gap-4 bg-zinc-100 dark:bg-pup-black items-center justify-center" role="status" aria-live="polite">
      <LoadingSpinner size="lg" />
      <p className="text-sm font-semibold text-maroon-dark dark:text-golden">Loading session cockpit…</p>
    </div>
  )
  if (redirecting) return (
    <div className="flex h-screen bg-zinc-100 dark:bg-pup-black items-center justify-center" role="status" aria-live="polite">
      <LoadingSpinner size="lg" />
    </div>
  )
  if (initializationError) return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 dark:bg-pup-black">
      <section className="w-full max-w-md border border-zinc-200 bg-white p-8 text-center dark:border-golden/15 dark:bg-surface-dark" role="alert">
        <p className="text-xs font-bold uppercase tracking-widest text-maroon dark:text-golden">Session unavailable</p>
        <h1 className="mt-2 font-heading text-2xl font-bold text-maroon-dark dark:text-white">The session cockpit couldn’t load</h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{initializationError}</p>
        <Button className="mt-6" onClick={() => void initialize()}>Retry</Button>
      </section>
    </main>
  )
  if (!user || !session) return null
  const isTeacher = user.role === 'teacher'

  const presentCount = records.filter((r) => r.status === 'present').length
  const lateCount = records.filter((r) => r.status === 'late').length
  const absentCount = records.filter((r) => r.status === 'absent').length
  const excusedCount = records.filter((r) => r.status === 'excused').length
  const pendingCount = records.filter((r) => r.status === 'pending').length
  const disputedCount = records.filter((r) => r.status === 'disputed').length
  const incompleteCount = records.filter((r) => r.status === 'incomplete').length
  const studentMap = new Map(records.map((r) => [r.studentId, r]))

  const handleCopyToken = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const token = qrToken
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopiedToken(true)
      addNotification('success', 'Token Copied', 'QR token copied to clipboard for manual check-in')
      setTimeout(() => setCopiedToken(false), 2500)
    } catch {
      addNotification('error', 'Copy Failed', 'Could not access system clipboard')
    }
  }

  const handleDownloadQr = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `polycheck-qr-${session?.subjectName.replace(/\s+/g, '_') || 'session'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addNotification('success', 'QR Image Saved', 'Session QR code saved as PNG image')
  }

  const openCheckpointPrompt = (checkpoint: 'start' | 'end', options?: { regenerate?: boolean }) => {
    if (!session) return
    const remembered = checkpoint === 'start' ? startPinPlain : endPinPlain
    setCheckpointTab(checkpoint)
    setCheckpointValiditySeconds(
      String(
        (checkpoint === 'start' ? session.startQrValiditySeconds : session.endQrValiditySeconds) ??
          Number(DEFAULT_CHECKPOINT_VALIDITY_SECONDS),
      ),
    )
    setCheckpointGraceMinutes(
      String(
        checkpoint === 'start'
          ? session.startGraceMinutes ?? Number(DEFAULT_CHECKPOINT_GRACE_MINUTES)
          : 0,
      ),
    )
    setCheckpointPinRequired(false)
    setCheckpointPin(options?.regenerate && remembered ? remembered : '')
    setCheckpointPinError('')
    setRegeneratingCheckpoint(Boolean(options?.regenerate))
    setShowCheckpointPrompt(true)
  }

  const handleGenerateCheckpointQr = async () => {
    if (!session || generatingQr) return
    const validitySeconds = parseInt(checkpointValiditySeconds, 10)
    const grace = parseInt(checkpointGraceMinutes, 10)
    if (!Number.isInteger(validitySeconds) || validitySeconds < 60 || validitySeconds > 300) {
      setCheckpointPinError('Validity must be between 60 and 300 seconds.')
      return
    }
    if (checkpointTab === 'start' && (!Number.isInteger(grace) || grace < 0 || grace > 60)) {
      setCheckpointPinError('Grace must be between 0 and 60 minutes.')
      return
    }
    const pin = checkpointPin.trim()
    if (checkpointPinRequired && !/^\d{2,4}$/.test(pin)) {
      setCheckpointPinError('The meeting PIN must be 2–4 digits.')
      return
    }
    setCheckpointPinError('')
    setGeneratingQr(true)
    try {
      const updated = await api.generateCheckpointQrCode({
        sessionId: session.id,
        checkpoint: checkpointTab,
        validitySeconds,
        graceMinutes: checkpointTab === 'start' ? grace : undefined,
        pin: checkpointPinRequired ? pin : undefined,
        regenerate: regeneratingCheckpoint || undefined,
      })
      setSession(updated)
      if (checkpointTab === 'start') setStartPinPlain(checkpointPinRequired ? pin : null)
      else setEndPinPlain(checkpointPinRequired ? pin : null)
      setShowCheckpointPrompt(false)
      addNotification(
        'success',
        regeneratingCheckpoint ? 'Checkpoint QR regenerated' : 'Checkpoint QR generated',
        `${checkpointTab === 'start' ? 'Start-of-class' : 'End-of-class'} QR is live for ${validitySeconds}s${
          checkpointPinRequired ? ' · announce the PIN aloud' : ''
        }.`,
      )
      void refreshData()
    } catch (error) {
      setCheckpointPinError(getErrorMessage(error))
    } finally {
      setGeneratingQr(false)
    }
  }

  // One-shot classroom fix for the V4 in-person activation gate. Failure is
  // non-blocking: an absent fix keeps today's behavior (offline-first).
  const captureTeacherFix = () =>
    new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null)
        return
      }
      const timer = window.setTimeout(() => resolve(null), 8000)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.clearTimeout(timer)
          resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        },
        () => {
          window.clearTimeout(timer)
          resolve(null)
        },
        { timeout: 7500, maximumAge: 30_000, enableHighAccuracy: true },
      )
    })

  const handleGenerateQr = async (overrideTeacherLocation = false) => {
    const mins = parseInt(validityMinutes, 10)
    const grace = parseInt(graceMinutes, 10)
    if (isNaN(mins) || mins < 1 || mins > 15 || isNaN(grace) || grace < 0 || grace > 60) return
    setGeneratingQr(true)
    const mutationEpoch = requestCoordinatorRef.current.beginMutation()
    let mutationSettled = false
    try {
      let fix = teacherFixRef.current
      if (!fix) {
        fix = await captureTeacherFix()
        teacherFixRef.current = fix
        if (!fix) {
          addNotification(
            'info',
            'No Location Fix',
            'Activating without a location fix is allowed for offline use.',
          )
        }
      }
      const activated = await api.generateQrCode(
        session.id,
        mins,
        grace,
        fix
          ? {
              latitude: fix.latitude,
              longitude: fix.longitude,
              ...(overrideTeacherLocation ? { override: true } : {}),
            }
          : undefined,
      )
      mutationSettled = true
      if (requestCoordinatorRef.current.commitMutation(mutationEpoch)) setSession(activated)
      setShowValidityPrompt(false)
      setTeacherLocationConflict(null)
      void refreshData()
      addNotification('success', 'QR Code Generated', `Session activated with ${mins}min validity and ${grace}min grace`)
    } catch (error) {
      if (
        overrideTeacherLocation === false &&
        error instanceof ApiHttpError &&
        error.code === 'teacher_location_outside_geofence'
      ) {
        // Surface the override decision instead of failing outright; the
        // pending mutation epoch is aborted on cancel/confirm.
        teacherConflictEpochRef.current = mutationEpoch
        setTeacherLocationConflict({
          distanceMeters: Math.round(error.distanceMeters ?? 0),
          allowedDistanceMeters: Math.round(error.allowedDistanceMeters ?? 150),
        })
        return
      }
      if (!mutationSettled) requestCoordinatorRef.current.abortMutation(mutationEpoch)
      addNotification('error', 'QR Generation Failed', getErrorMessage(error))
      setShowValidityPrompt(false)
      await refreshData({ reconcile: true })
    } finally {
      setGeneratingQr(false)
    }
  }

  const handleEndSession = async () => {
    const message = onlineMode
      ? 'End the session and resolve the checkpoint matrix (present / late / incomplete; students with neither scan become absent)?'
      : 'Mark all pending students as absent and end the session?'
    if (!confirm(message)) return
    setEndingSession(true)
    const mutationEpoch = requestCoordinatorRef.current.beginMutation()
    let mutationSettled = false
    try {
      const ended = await api.endSession(session.id)
      mutationSettled = true
      if (requestCoordinatorRef.current.commitMutation(mutationEpoch)) setSession(ended)
      void refreshData()
      addNotification('info', 'Session Ended', 'All pending students marked as absent')
    } catch (error) {
      if (!mutationSettled) requestCoordinatorRef.current.abortMutation(mutationEpoch)
      addNotification('error', 'Could Not End Session', getErrorMessage(error))
      await refreshData({ reconcile: true })
    } finally {
      setEndingSession(false)
    }
  }

  const handleManualOverride = async (studentId: string, currentStatus: AttendanceStatus) => {
    const idx = STATUS_CYCLE.findIndex((status) => status === currentStatus)
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    const existing = records.find((r) => r.studentId === studentId && r.sessionId === session.id)
    const student = enrolledStudents.find((s) => s.id === studentId)
    const now = new Date()
    await run(
      `override:${studentId}`,
      async () => {
        if (existing) {
          await api.updateAttendanceStatus(existing.id, nextStatus)
        } else {
          await api.addAttendanceRecord({
            id: crypto.randomUUID(),
            sessionId: session.id,
            sectionId: session.sectionId,
            studentId,
            studentName: student?.fullName ?? 'Unknown',
            timestamp: now.toISOString(),
            status: nextStatus,
            coordinates: { latitude: null, longitude: null },
            deviceId: 'manual',
            isSynced: true,
            syncedAt: now.toISOString(),
            manuallySet: true,
          })
        }
      },
      {
        errorTitle: 'Could not update the attendance status',
        onSuccess: () => {
          addNotification('info', 'Status Updated', `Student marked as ${nextStatus}`)
          void refreshData()
        },
      },
    )
  }

  const handleLogout = () => {
    void requestUserLogout().then((outcome) => {
      if (outcome.loggedOut) router.push('/')
    })
  }

  return (
    <div className="flex h-screen bg-zinc-100 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} backHref="/faculty/sessions" backLabel="Back to Sessions" />
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white dark:bg-pup-black border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/faculty/sessions" aria-label="Back to sessions" className="inline-flex min-h-11 min-w-11 items-center justify-center p-1 hover:opacity-70 md:min-h-0 md:min-w-0">
              <ArrowLeft className="w-5 h-5 text-maroon dark:text-golden" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="break-words text-xl font-heading font-bold text-maroon-dark dark:text-golden">{session.subjectName}</h1>
                <Badge
                  className={
                    onlineMode
                      ? 'bg-maroon text-golden border border-golden dark:bg-golden dark:text-maroon-dark'
                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                  }
                >
                  {onlineMode ? (
                    <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Online · No GPS</span>
                  ) : (
                    <span className="flex items-center gap-1"><School className="w-3 h-3" /> In-Person</span>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {session.startTime}-{session.endTime}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRadarOpen(true)}
              aria-label="Open live geofence radar"
              title="Live geofence radar"
              className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 hover:opacity-70 md:min-h-0 md:min-w-0"
            >
              <Radio className="w-4 h-4 text-maroon dark:text-golden" />
            </button>
            <Link
              href={`/faculty/sessions/${id}/kiosk`}
              aria-label="Open projector view (kiosk mode)"
              title="Projector view (kiosk)"
              className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 hover:opacity-70 md:min-h-0 md:min-w-0"
            >
              <MonitorPlay className="w-4 h-4 text-maroon dark:text-golden" />
            </Link>
            <button
              type="button"
              onClick={() => void refreshData()}
              className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 hover:opacity-70 disabled:cursor-wait disabled:opacity-50 md:min-h-0 md:min-w-0"
              aria-label="Refresh session data"
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 text-maroon dark:text-golden ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-4xl mx-auto">
          {refreshError ? (
            <div className="flex flex-col gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <div>
                <p className="font-bold">Session data could not be refreshed.</p>
                <p className="mt-1 text-xs">{refreshError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refreshData()} disabled={refreshing}>Retry refresh</Button>
            </div>
          ) : null}

          {/* QR Code Card — in-person single check-in */}
          {isTeacher && !onlineMode && <Card className="dark:border-golden/15 dark:bg-surface-dark">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-maroon dark:text-golden" />
                <h2 className="text-base font-bold dark:text-white">QR Code</h2>
              </div>
              <div className="flex flex-col items-center py-4">
                {qrError ? <p className="mb-4 text-sm text-red-600 dark:text-red-300" role="alert">QR image could not be rendered: {qrError}</p> : null}
                {qrDataUrl ? (
                  <>
                    <button
                      type="button"
                      className="cursor-pointer"
                      onClick={() => setShowQrModal(true)}
                      aria-label="Open session QR code in full screen"
                    >
                      <Image src={qrDataUrl} width={180} height={180} unoptimized alt="Scannable session QR code" />
                    </button>
                    {countdown && (
                      <p className={`text-sm mt-2 font-mono ${countdown === 'Grace ended' ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {countdown.includes('Grace') ? countdown : `Expires in: ${countdown}`}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border-zinc-300 dark:border-zinc-700"
                        onClick={() => setShowQrModal(true)}
                      >
                        <Maximize className="w-3.5 h-3.5" /> Full Screen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-maroon dark:text-golden border-maroon/30 dark:border-golden/30 hover:bg-maroon/10 dark:hover:bg-golden/10"
                        onClick={handleCopyToken}
                      >
                        {copiedToken ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedToken ? 'Copied Token!' : 'Copy Token'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border-zinc-300 dark:border-zinc-700"
                        onClick={handleDownloadQr}
                      >
                        <Download className="w-3.5 h-3.5 text-maroon dark:text-golden" /> Save Image
                      </Button>
                    </div>
                  </>
                ) : session.isActive ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Generating QR...</p>
                ) : (
                  <>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Generate a QR code to start the session</p>
                    <Button className="bg-maroon hover:bg-maroon-dark dark:bg-golden dark:hover:bg-golden-dark dark:text-maroon-dark flex items-center gap-2" onClick={() => setShowValidityPrompt(true)}>
                      <Play className="w-4 h-4" /> Generate QR Code
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>}

          {/* QR Code Card — online dual checkpoints */}
          {isTeacher && onlineMode && (() => {
            const startArmed = Boolean(session.startQrToken)
            const endArmed = Boolean(session.endQrToken)
            const activeArmed = checkpointTab === 'start' ? startArmed : endArmed
            const announcedPin = checkpointTab === 'start' ? startPinPlain : endPinPlain
            const activeExpiry = checkpointTab === 'start' ? session.startTokenExpiresAt : session.endTokenExpiresAt
            // The countdown ticks once per second and reports when the whole
            // window (validity + grace) is over; rendering stays pure.
            const windowOpen = Boolean(activeExpiry) && countdown !== 'Grace ended'
            return (
              <Card className="dark:border-golden/15 dark:bg-surface-dark">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <QrCode className="w-5 h-5 text-maroon dark:text-golden" />
                    <h2 className="text-base font-bold dark:text-white">Checkpoint QR Codes</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4" role="tablist" aria-label="Attendance checkpoints">
                    {([
                      { key: 'start' as const, label: 'Step 1 · Start QR', armed: startArmed },
                      { key: 'end' as const, label: 'Step 2 · End QR', armed: endArmed },
                    ]).map((step) => (
                      <button
                        key={step.key}
                        type="button"
                        role="tab"
                        aria-selected={checkpointTab === step.key}
                        onClick={() => setCheckpointTab(step.key)}
                        className={`border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                          checkpointTab === step.key
                            ? 'border-maroon bg-maroon text-white dark:border-golden dark:bg-golden dark:text-maroon-dark'
                            : 'border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {step.label}
                        {step.armed ? <span className="ml-1 text-[10px] opacity-80">●</span> : null}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col items-center py-2">
                    {qrError ? <p className="mb-4 text-sm text-red-600 dark:text-red-300" role="alert">QR image could not be rendered: {qrError}</p> : null}
                    {activeArmed && qrDataUrl ? (
                      <>
                        <button
                          type="button"
                          className="cursor-pointer"
                          onClick={() => setShowQrModal(true)}
                          aria-label="Open checkpoint QR code in full screen"
                        >
                          <Image src={qrDataUrl} width={180} height={180} unoptimized alt="Scannable checkpoint QR code" />
                        </button>
                        {countdown && (
                          <p className={`text-sm mt-2 font-mono ${countdown === 'Grace ended' ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {countdown.includes('Grace') ? countdown : `Expires in: ${countdown}`}
                          </p>
                        )}
                        {announcedPin ? (
                          <div className="mt-3 flex items-center gap-2 border border-golden bg-maroon px-3 py-1.5">
                            <KeyRound className="w-3.5 h-3.5 text-golden" />
                            <span className="text-xs font-bold uppercase tracking-widest text-golden">
                              PIN {announcedPin} · announce aloud
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border-zinc-300 dark:border-zinc-700"
                            onClick={() => setShowQrModal(true)}
                          >
                            <Maximize className="w-3.5 h-3.5" /> Full Screen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-maroon dark:text-golden border-maroon/30 dark:border-golden/30 hover:bg-maroon/10 dark:hover:bg-golden/10"
                            onClick={handleCopyToken}
                          >
                            {copiedToken ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedToken ? 'Copied Token!' : 'Copy Token'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border-zinc-300 dark:border-zinc-700"
                            onClick={handleDownloadQr}
                          >
                            <Download className="w-3.5 h-3.5 text-maroon dark:text-golden" /> Save PNG
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border-zinc-300 dark:border-zinc-700"
                            onClick={() => openCheckpointPrompt(checkpointTab, { regenerate: true })}
                            disabled={!windowOpen}
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1 text-center max-w-md">
                          {checkpointTab === 'start'
                            ? 'Generate the start-of-class QR. Students scan it once at the beginning of the lecture.'
                            : 'Generate the end-of-class QR in the final 5–10 minutes. Zero grace: late check-outs are rejected.'}
                        </p>
                        <Button
                          className="mt-3 bg-maroon hover:bg-maroon-dark dark:bg-golden dark:hover:bg-golden-dark dark:text-maroon-dark flex items-center gap-2"
                          onClick={() => openCheckpointPrompt(checkpointTab)}
                          disabled={checkpointTab === 'end' && !session.isActive}
                        >
                          <Play className="w-4 h-4" /> {checkpointTab === 'start' ? 'Generate Start QR' : 'Generate End QR'}
                        </Button>
                        {checkpointTab === 'end' && !session.isActive ? (
                          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                            Arm Step 1 before generating the end-of-class QR.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="mt-4 flex items-start gap-2 border border-dashed border-maroon/40 p-3 dark:border-golden/30">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-maroon dark:text-golden" />
                    <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                      Online checkpoints collect no location (RA 10173). Students may scan from a second device or
                      upload a screenshot — the meeting PIN blocks forwarded screenshots.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* Session Info */}
          <Card className="dark:border-golden/15 dark:bg-surface-dark">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-5 h-5 text-maroon dark:text-golden" />
                <h2 className="text-base font-bold dark:text-white">Session Info</h2>
              </div>
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 mb-1">Status</p>
                  <Badge className={session.isActive ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}>
                    {session.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {session.isActive && !onlineMode && session.qrValidityMinutes ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 mb-1">QR Validity</p>
                    <p className="text-sm font-semibold dark:text-white">{session.qrValidityMinutes} min</p>
                  </div>
                ) : null}
                {onlineMode ? (
                  <>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 mb-1">Start checkpoint</p>
                      <p className="text-sm font-semibold dark:text-white">
                        {session.startQrValiditySeconds ?? 90}s + {session.startGraceMinutes ?? 0}m grace
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 mb-1">End checkpoint</p>
                      <p className="text-sm font-semibold dark:text-white">{session.endQrValiditySeconds ?? 90}s · no grace</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 mb-1">Meeting PIN</p>
                      <p className="text-sm font-semibold dark:text-white">{session.pinRequired ? 'Required on armed checkpoints' : 'Not used'}</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 mb-1">Grace Period</p>
                    <p className="text-sm font-semibold dark:text-white">{session.gracePeriodMinutes} min</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.5px] text-zinc-500 dark:text-zinc-400 mb-1">Room</p>
                  <p className="text-sm font-semibold dark:text-white">{session.room || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campus Map Card */}
          <Card className="dark:border-golden/15 dark:bg-surface-dark">
            <CardContent className="p-6">
              <CampusMap
                session={session}
                records={records}
                isActive={session.isActive}
                refreshLabel={refreshLabel}
              />
            </CardContent>
          </Card>

          {/* Proof of Class */}
          <Card className="dark:border-golden/15 dark:bg-surface-dark">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-maroon dark:text-golden" />
                <h2 className="text-base font-bold dark:text-white">Proof of Class</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">({proofsOfClass.length})</span>
              </div>
              {proofsOfClass.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">No proof photos uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {proofsOfClass.map((poc) => (
                    <div key={poc.id} className="border border-zinc-200 dark:border-golden/15 p-3 bg-zinc-50 dark:bg-pup-black">
                      <div className="w-full aspect-video bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mb-2">
                        <Camera className="w-8 h-8 text-zinc-400" />
                      </div>
                      <p className="text-xs font-medium dark:text-white truncate">{poc.uploadedByStudentName}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{new Date(poc.uploadedAt).toLocaleString()}</p>
                      {poc.description && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 italic">&quot;{poc.description}&quot;</p>}
                      {isTeacher && (
                        <button
                          className="mt-2 text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                          onClick={async () => { await api.deleteProofOfClass(poc.id); setProofsOfClass(await api.getProofsOfClass(id)) }}
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Roster */}
          <Card className="dark:border-golden/15 dark:bg-surface-dark">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-maroon dark:text-golden" />
                <h2 className="text-base font-bold dark:text-white">Student Roster</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">({enrolledStudents.length})</span>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-3">{refreshLabel}</p>

              {/* Summary */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:flex md:justify-around">
                {[
                  { label: 'Present', value: presentCount, color: 'text-golden' },
                  { label: 'Late', value: lateCount, color: 'text-maroon dark:text-red-300' },
                  { label: 'Incomplete', value: incompleteCount, color: 'text-maroon-dark dark:text-golden' },
                  { label: 'Absent', value: absentCount, color: 'text-maroon-dark dark:text-red-400' },
                  { label: 'Excused', value: excusedCount, color: 'text-maroon dark:text-golden' },
                  { label: 'Pending', value: pendingCount, color: 'text-zinc-500 dark:text-zinc-400' },
                  { label: 'Disputed', value: disputedCount, color: 'text-maroon dark:text-golden' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {(['all', 'present', 'late', 'incomplete', 'absent', 'excused', 'pending', 'disputed'] as const).map((f) => (
                  <button
                    key={f}
                    className={`px-3 py-1 text-xs border ${filter === f ? 'bg-maroon dark:bg-golden border-maroon dark:border-golden text-white dark:text-maroon-dark' : 'bg-zinc-100 dark:bg-surface-dark border-zinc-300 dark:border-golden/15 text-zinc-500 dark:text-zinc-400'}`}
                    onClick={() => setFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Student List */}
              {enrolledStudents.length === 0 ? (
                <p className="text-center py-8 text-zinc-500 dark:text-zinc-400">No enrolled students.</p>
              ) : (
                <div className="space-y-1">
                  {enrolledStudents.map((student) => {
                    const record = studentMap.get(student.id)
                    const status = (record?.status ?? 'pending') as AttendanceStatus
                    if (filter !== 'all' && status !== filter) return null
                    return (
                      <button
                        key={student.id}
                        className={`w-full min-h-11 flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 text-left ${isTeacher ? 'hover:bg-zinc-50 dark:hover:bg-zinc-900' : 'cursor-default'}`}
                        onClick={() => { if (isTeacher) handleManualOverride(student.id, status) }}
                        disabled={!isTeacher || isPending(`override:${student.id}`)}
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium dark:text-white">{student.fullName}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{student.studentId}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {onlineMode ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
                              <span
                                className={`px-1.5 py-0.5 border ${
                                  record?.checkInStatus
                                    ? record.checkInStatus === 'late'
                                      ? 'border-maroon bg-maroon text-white'
                                      : 'border-golden bg-golden/20 text-maroon dark:text-golden'
                                    : 'border-zinc-300 text-zinc-400 dark:border-zinc-700'
                                }`}
                                title={record?.checkInTime ? `Check-in: ${new Date(record.checkInTime).toLocaleTimeString()}` : 'No check-in'}
                              >
                                In{record?.checkInStatus === 'late' ? ' · late' : record?.checkInStatus ? ' ✓' : ' —'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 border ${
                                  record?.checkOutStatus
                                    ? 'border-golden bg-golden text-maroon-dark'
                                    : 'border-zinc-300 text-zinc-400 dark:border-zinc-700'
                                }`}
                                title={record?.checkOutTime ? `Check-out: ${new Date(record.checkOutTime).toLocaleTimeString()}` : 'No check-out'}
                              >
                                Out{record?.checkOutStatus ? ' ✓' : ' —'}
                              </span>
                            </span>
                          ) : null}
                          {record?.manuallySet && <Edit3 className="w-3.5 h-3.5 text-maroon dark:text-golden" />}
                          <span className={`px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                          {isTeacher && <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* End Session */}
          {isTeacher && session.isActive && (
            <Button className="w-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 py-6" onClick={handleEndSession} disabled={endingSession}>
              <StopCircle className="w-5 h-5" /> {endingSession ? 'Ending Session…' : 'End Session'}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={isTeacher && showValidityPrompt} onOpenChange={setShowValidityPrompt}>
        <DialogContent className="w-[92vw] max-h-[92vh] overflow-y-auto max-w-sm dark:bg-surface-dark dark:border-golden/15 p-8">
          <DialogHeader className="items-center text-center">
            <Timer className="w-10 h-10 text-maroon dark:text-golden mx-auto mb-3" />
            <DialogTitle className="dark:text-white">QR Settings</DialogTitle>
            <DialogDescription className="text-xs text-center">
              Set the duration for this session. After validity expires, scans are marked Late. After the grace period ends, scans are blocked.
            </DialogDescription>
          </DialogHeader>
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="qr-validity" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">QR Validity</label>
                <div className="flex items-center gap-2">
                  <Input
                    id="qr-validity"
                    type="number"
                    className="w-full text-center font-bold"
                    value={validityMinutes}
                    onChange={(e) => setValidityMinutes(e.target.value)}
                    min={1}
                    max={15}
                  />
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">minutes</span>
                </div>
              </div>
              <div>
                <label htmlFor="grace-period" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Grace Period</label>
                <div className="flex items-center gap-2">
                  <Input
                    id="grace-period"
                    type="number"
                    className="w-full text-center font-bold"
                    value={graceMinutes}
                    onChange={(e) => setGraceMinutes(e.target.value)}
                    min={0}
                    max={60}
                  />
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">minutes</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowValidityPrompt(false)}>Cancel</Button>
              <Button className="flex-1 bg-maroon hover:bg-maroon-dark dark:bg-golden dark:hover:bg-golden-dark dark:text-maroon-dark" onClick={() => void handleGenerateQr(false)} disabled={generatingQr}>
                {generatingQr ? 'Generating…' : 'Generate'}
              </Button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTeacher && teacherLocationConflict !== null}
        onOpenChange={(open) => {
          if (!open) {
            const epoch = teacherConflictEpochRef.current
            if (epoch) requestCoordinatorRef.current.abortMutation(epoch)
            teacherConflictEpochRef.current = 0
            setTeacherLocationConflict(null)
          }
        }}
      >
        <DialogContent className="w-[92vw] max-h-[92vh] overflow-y-auto max-w-sm dark:bg-surface-dark dark:border-golden/15 p-8" role="alertdialog">
          <DialogHeader className="items-center text-center">
            <ShieldCheck className="w-10 h-10 text-maroon dark:text-golden mx-auto mb-3" />
            <DialogTitle className="dark:text-white">Outside the classroom geofence</DialogTitle>
            <DialogDescription className="text-center text-sm">
              Your device is {teacherLocationConflict?.distanceMeters ?? 0} m from the classroom geofence (allowed:
              {' '}
              {teacherLocationConflict?.allowedDistanceMeters ?? 150} m). You can still activate in person — the
              confirmation is recorded in the institutional audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const epoch = teacherConflictEpochRef.current
                if (epoch) requestCoordinatorRef.current.abortMutation(epoch)
                teacherConflictEpochRef.current = 0
                setTeacherLocationConflict(null)
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-maroon hover:bg-maroon-dark dark:bg-golden dark:hover:bg-golden-dark dark:text-maroon-dark"
              disabled={generatingQr}
              onClick={() => {
                const epoch = teacherConflictEpochRef.current
                if (epoch) requestCoordinatorRef.current.abortMutation(epoch)
                teacherConflictEpochRef.current = 0
                setTeacherLocationConflict(null)
                void handleGenerateQr(true)
              }}
            >
              {generatingQr ? 'Activating…' : 'Activate anyway'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTeacher && showQrModal && Boolean(qrDataUrl)} onOpenChange={setShowQrModal}>
        <DialogContent className="w-[92vw] max-h-[92vh] overflow-y-auto max-w-lg border-2 border-zinc-300 dark:border-zinc-800 p-8 flex flex-col items-center gap-6 shadow-2xl">
          {qrDataUrl && (
            <>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {onlineMode
                  ? `${checkpointTab === 'start' ? 'Start-of-class check-in' : 'End-of-class check-out'} QR`
                  : 'Class Session QR Code'}
              </p>
              <DialogTitle className="text-xl text-maroon dark:text-golden">{session.subjectName}</DialogTitle>
              <DialogDescription className="sr-only">
                Full-screen QR code for students to scan for this attendance session.
              </DialogDescription>
            </div>

            <div className="p-4 bg-white border border-zinc-200 shadow-inner">
              <Image src={qrDataUrl} width={340} height={340} unoptimized alt="Scannable session QR code" />
            </div>

            {onlineMode && (checkpointTab === 'start' ? startPinPlain : endPinPlain) ? (
              <div className="flex items-center gap-2 border border-golden bg-maroon px-4 py-2">
                <KeyRound className="w-4 h-4 text-golden" />
                <span className="text-sm font-bold uppercase tracking-widest text-golden">
                  PIN {checkpointTab === 'start' ? startPinPlain : endPinPlain} · announce aloud
                </span>
              </div>
            ) : null}

            {countdown && (
              <p className={`text-sm font-mono font-bold tracking-widest uppercase ${countdown === 'Grace ended' ? 'text-red-500' : 'text-zinc-400'}`}>
                {countdown.includes('Grace') ? countdown : `Expires in: ${countdown}`}
              </p>
            )}

            <div className="flex items-center gap-3 w-full">
              <Button
                variant="outline"
                onClick={handleCopyToken}
                className="flex-1 rounded-none border-zinc-300 dark:border-zinc-700 text-xs font-bold uppercase tracking-widest text-maroon dark:text-golden"
              >
                {copiedToken ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedToken ? 'Copied Token!' : 'Copy Token'}
              </Button>
              <Button
                onClick={handleDownloadQr}
                className="flex-1 rounded-none bg-maroon hover:bg-maroon-dark text-white text-xs font-bold uppercase tracking-widest"
              >
                <Download className="w-4 h-4 mr-2 text-golden" /> Save Image
              </Button>
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isTeacher && showCheckpointPrompt} onOpenChange={setShowCheckpointPrompt}>
        <DialogContent className="w-[92vw] max-h-[92vh] overflow-y-auto max-w-sm dark:bg-surface-dark dark:border-golden/15 p-8">
          <DialogHeader className="items-center text-center">
            <KeyRound className="w-10 h-10 text-maroon dark:text-golden mx-auto mb-3" />
            <DialogTitle className="dark:text-white">
              {regeneratingCheckpoint ? 'Regenerate' : 'Generate'} {checkpointTab === 'start' ? 'Start' : 'End'} QR
            </DialogTitle>
            <DialogDescription className="text-xs text-center">
              {checkpointTab === 'start'
                ? 'Students check in once at the start of the online lecture. The QR stays valid for 60–300 seconds.'
                : 'Students check out at the end of the lecture. Zero grace: late check-outs are rejected.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="checkpoint-validity" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Validity (seconds)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="checkpoint-validity"
                  type="number"
                  className="w-full text-center font-bold"
                  value={checkpointValiditySeconds}
                  onChange={(e) => setCheckpointValiditySeconds(e.target.value)}
                  min={60}
                  max={300}
                />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">sec</span>
              </div>
            </div>
            {checkpointTab === 'start' ? (
              <div>
                <label htmlFor="checkpoint-grace" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  Grace period (minutes)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="checkpoint-grace"
                    type="number"
                    className="w-full text-center font-bold"
                    value={checkpointGraceMinutes}
                    onChange={(e) => setCheckpointGraceMinutes(e.target.value)}
                    min={0}
                    max={60}
                  />
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">min</span>
                </div>
              </div>
            ) : null}
            <div className="border border-zinc-200 p-3 dark:border-zinc-700">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={checkpointPinRequired}
                  onChange={(e) => {
                    setCheckpointPinRequired(e.target.checked)
                    if (!e.target.checked) setCheckpointPin('')
                  }}
                  className="h-4 w-4 accent-maroon"
                />
                Require meeting PIN
              </label>
              {checkpointPinRequired ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={checkpointPin}
                      onChange={(e) => setCheckpointPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="2–4 digits"
                      className="w-full text-center font-bold tracking-[0.3em]"
                      aria-label="Meeting PIN"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCheckpointPin(randomMeetingPin(3, (length) => crypto.getRandomValues(new Uint8Array(length))))}
                      className="shrink-0"
                    >
                      Auto
                    </Button>
                  </div>
                  <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                    Announce this PIN verbally in the meeting. Screenshots cannot carry audio.
                  </p>
                </div>
              ) : null}
            </div>
            {checkpointPinError ? (
              <p className="text-xs font-semibold text-red-600 dark:text-red-300" role="alert">
                {checkpointPinError}
              </p>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowCheckpointPrompt(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-maroon hover:bg-maroon-dark dark:bg-golden dark:hover:bg-golden-dark dark:text-maroon-dark"
              onClick={() => void handleGenerateCheckpointQr()}
              disabled={generatingQr}
            >
              {generatingQr ? 'Generating…' : regeneratingCheckpoint ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mounted only while open so maplibre's chunk loads on demand. */}
      {radarOpen ? (
        <GeofenceRadarModal
          open={radarOpen}
          onOpenChange={setRadarOpen}
          session={session}
          records={records}
          students={enrolledStudents}
        />
      ) : null}

      {/* F7 demo surface — flag-gated; env defaults off in production builds. */}
      {process.env.NEXT_PUBLIC_ENABLE_OUTAGE_SIMULATOR === 'true' ? <OutageSimulator /> : null}
    </div>
  )
}
