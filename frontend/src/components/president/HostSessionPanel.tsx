'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Crown, Play, Square, Users } from 'lucide-react'
import type { HostSessionState, HostStartInput } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { getOrCreateWebInstallationId } from '@/lib/device-id'
import { describeMutationError } from '@/lib/run-mutation'
import { brandColors } from '@/lib/colors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const POLL_MS = 5_000
const VALIDITY_MINUTES = [1, 3, 5, 10, 15]
const GRACE_MINUTES = [0, 5, 10, 15, 30, 60]

const STATUS_TEXT: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
  disputed: 'For review',
  incomplete: 'Incomplete',
  pending: 'Not yet',
}

const SELECT_CLASS =
  'h-11 w-full border border-zinc-300 bg-white px-2 text-base sm:text-sm dark:border-zinc-700 dark:bg-zinc-900'

/** The phone or laptop's position, or null when it is refused or unavailable. */
function readLocation(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    })
  })
}

const clock = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/**
 * A section president's controls for a session they created: start it, show the
 * QR code, watch who checks in (view only), and end it.
 */
export function HostSessionPanel({ sessionId, onChanged }: { sessionId: string; onChanged?: () => void }) {
  const [state, setState] = useState<HostSessionState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [validity, setValidity] = useState(5)
  const [grace, setGrace] = useState(15)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const next = await api.getHostSession(sessionId)
      if (!alive.current) return
      setState(next)
      setError(null)
    } catch (failure) {
      if (alive.current) setError(describeMutationError(failure, 'Unable to load your session controls.'))
    }
  }, [sessionId])

  useEffect(() => {
    alive.current = true
    void refresh()
    return () => {
      alive.current = false
    }
  }, [refresh])

  // Keep the list current while people check in.
  const live = Boolean(state?.isActive)
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [live, refresh])

  const token = state?.qrToken
  useEffect(() => {
    let current = true
    if (!token) return
    void QRCode.toDataURL(token, {
      width: 1024,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: brandColors.black, light: brandColors.white },
    }).then((url) => {
      if (current) setQrImage(url)
    })
    return () => {
      current = false
    }
  }, [token])

  const start = async () => {
    setBusy(true)
    setError(null)
    setNotice('Getting your location…')
    try {
      const position = await readLocation()
      const input: HostStartInput = {
        validityMinutes: validity,
        gracePeriodMinutes: grace,
        deviceId: getOrCreateWebInstallationId(),
        clientTime: new Date().toISOString(),
        ...(position
          ? {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: position.coords.accuracy,
              locationCapturedAt: new Date(position.timestamp).toISOString(),
            }
          : {}),
      }
      const result = await api.startHostSession(sessionId, input)
      setState(result)
      setNotice(result.presenceMessage)
      onChanged?.()
    } catch (failure) {
      setNotice(null)
      setError(describeMutationError(failure, 'The session could not be started.'))
    } finally {
      setBusy(false)
    }
  }

  const end = async () => {
    if (!window.confirm('End this session? Students who have not checked in will be marked absent.')) return
    setBusy(true)
    setError(null)
    try {
      setState(await api.endHostSession(sessionId))
      setNotice('Session ended.')
      onChanged?.()
    } catch (failure) {
      setError(describeMutationError(failure, 'The session could not be ended.'))
    } finally {
      setBusy(false)
    }
  }

  const checkedIn = state?.roster.filter((entry) => entry.status === 'present' || entry.status === 'late').length ?? 0

  return (
    <Card className="rounded-none border-zinc-300 dark:border-zinc-800 shadow-none mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <Crown className="w-4 h-4 text-maroon dark:text-golden" /> Run this session
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm font-medium text-foreground">
            {notice}
          </p>
        ) : null}
        {!state && !error ? <p className="text-sm text-zinc-500">Loading…</p> : null}
        {state?.message ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{state.message}</p> : null}

        {state?.canStart ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-zinc-500">
                QR counts as present for
                <select
                  className={SELECT_CLASS}
                  value={validity}
                  onChange={(event) => setValidity(Number(event.target.value))}
                >
                  {VALIDITY_MINUTES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-zinc-500">
                Then counts as late for
                <select className={SELECT_CLASS} value={grace} onChange={(event) => setGrace(Number(event.target.value))}>
                  {GRACE_MINUTES.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Allow location when asked. If you are inside the class area, you are marked present.
            </p>
            <Button className="min-h-11 bg-maroon hover:bg-maroon-dark text-white" disabled={busy} onClick={start}>
              <Play className="w-4 h-4 mr-1" /> {busy ? 'Starting…' : 'Start session'}
            </Button>
          </div>
        ) : null}

        {state?.canEnd ? (
          <div className="space-y-3">
            {token && qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- generated in the browser
              <img
                src={qrImage}
                alt="Attendance QR code for this session"
                className="mx-auto w-full max-w-xs border border-zinc-200 bg-white"
              />
            ) : null}
            {state.qrTokenExpiresAt ? (
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                Present until {clock(state.qrTokenExpiresAt)}, then late for {state.gracePeriodMinutes} min. The session
                ends by itself after that.
              </p>
            ) : null}
            <Button
              variant="outline"
              className="min-h-11 w-full border-red-500 text-red-600"
              disabled={busy}
              onClick={end}
            >
              <Square className="w-4 h-4 mr-1" /> End session
            </Button>
          </div>
        ) : null}

        {state && state.roster.length > 0 ? (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
              <Users className="w-4 h-4" /> {checkedIn} of {state.roster.length} checked in
            </p>
            <ul aria-label="Check-in list" className="max-h-80 overflow-y-auto border border-zinc-200 dark:border-zinc-800">
              {state.roster.map((entry, index) => (
                <li
                  key={`${entry.studentName}-${index}`}
                  className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 text-sm last:border-b-0 dark:border-zinc-800"
                >
                  <span className="min-w-0 break-words">{entry.studentName}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {STATUS_TEXT[entry.status] ?? entry.status}
                    {entry.scannedAt ? ` · ${clock(entry.scannedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
