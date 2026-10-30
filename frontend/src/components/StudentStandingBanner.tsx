'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { AttendanceStanding } from '@polycheck/shared'
import { AlertCircle, ArrowRight, X } from 'lucide-react'
import { api } from '@/lib/api-client'
import { pickStandingAlert, standingSessionDismissKey } from '@/lib/standing-alert'

function formatRate(rate: number): string {
  // Floor to one decimal so a below-threshold rate never displays as the minimum.
  const floored = Math.floor(Math.max(0, rate) * 10) / 10
  return Number.isInteger(floored) ? String(floored) : floored.toFixed(1)
}

function wasDismissed(userId: string, sectionId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(standingSessionDismissKey(userId, sectionId)) === '1'
  } catch {
    return false
  }
}

function dismissForSession(userId: string, sectionId: string) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(standingSessionDismissKey(userId, sectionId), '1')
  } catch {
    // Dismissal still applies until the next page load when storage is blocked.
  }
}

export function StudentStandingBanner({ userId }: { userId: string }) {
  const [alert, setAlert] = useState<AttendanceStanding | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const current = api.getCurrentUser()
      if (!current || current.role !== 'student') return
      const studentId = userId || current.id
      if (!studentId) return
      try {
        const standings = await api.getMyStanding()
        if (cancelled) return
        const standing = pickStandingAlert(standings)
        if (!standing || wasDismissed(studentId, standing.sectionId)) return
        setAlert(standing)
      } catch {
        // The standing notice is supplementary; a failed call must not disturb the dashboard.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const handleDismiss = useCallback(() => {
    if (!alert) return
    dismissForSession(userId, alert.sectionId)
    setAlert(null)
  }, [alert, userId])

  if (!alert || alert.attendanceRate === null) return null

  const professor = alert.professorName.trim() || 'your professor'
  const rate = formatRate(alert.attendanceRate)

  return (
    <aside
      aria-label="Attendance standing notice"
      className="relative mb-6 border border-golden/60 border-l-4 border-l-golden bg-golden/10 px-4 py-3 pr-12 dark:border-golden/20 dark:border-l-golden dark:bg-golden/5"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-maroon dark:text-golden" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-relaxed text-maroon-dark dark:text-golden">
            Attendance check — {alert.subjectName} · Section {alert.sectionName}: {rate}% (minimum{' '}
            {alert.thresholdPercent}%).
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {alert.status === 'at_risk'
              ? 'One more recorded absence drops you below the minimum.'
              : `You are below the minimum. Consider talking to ${professor}.`}
          </p>
          {alert.caveat ? (
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{alert.caveat}</p>
          ) : null}
          <Link
            href={`/student/subjects/${alert.sectionId}`}
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-maroon underline-offset-2 hover:underline dark:text-golden"
          >
            View subject
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss attendance notice"
        className="absolute right-2 top-2 p-1.5 text-zinc-500 transition-colors hover:text-maroon dark:text-zinc-400 dark:hover:text-golden"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  )
}
