'use client'

import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import type { ReportStatus, SystemReport } from '@polycheck/shared'
import { REPORT_CATEGORY_LABELS, REPORT_STATUS_LABELS } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { LoadingSpinner } from '@/lib/hooks'

export function reportStatusBadgeClass(status: ReportStatus): string {
  switch (status) {
    case 'open':
      return 'bg-maroon text-white'
    case 'in_review':
      return 'bg-golden text-maroon-dark border border-maroon-dark'
    case 'resolved':
      return 'bg-emerald-600 text-white'
    case 'dismissed':
      return 'bg-zinc-700 text-zinc-100 dark:bg-zinc-300 dark:text-zinc-900'
    default:
      return 'bg-maroon text-white'
  }
}

/** The submitter's own report stream (shared by /profile and future entry points). */
export function MyReportsPanel({ reloadSignal = 0 }: { reloadSignal?: number }) {
  const [reports, setReports] = useState<SystemReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .getMySystemReports()
      .then((rows) => {
        if (active) {
          setReports(rows)
          setError('')
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load your reports.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadSignal])

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <p role="alert" className="py-6 text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Flag className="h-8 w-8 text-zinc-300 dark:text-zinc-700" aria-hidden="true" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No reports yet. Use “Report an Issue” in the sidebar to file the first one.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3" data-testid="my-reports-list">
      {reports.map((report) => (
        <li
          key={report.id}
          className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          data-testid="my-report-card"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${reportStatusBadgeClass(report.status)}`}
            >
              {REPORT_STATUS_LABELS[report.status]}
            </span>
            <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {REPORT_CATEGORY_LABELS[report.category]}
            </span>
            <span className="text-xs text-zinc-400">
              {new Date(report.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{report.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{report.description}</p>
          {report.adminNotes ? (
            <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <span className="font-bold uppercase tracking-widest text-zinc-400">Admin note:</span>{' '}
              {report.adminNotes}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
