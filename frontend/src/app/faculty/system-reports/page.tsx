'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MonitorSmartphone, RefreshCw, Search } from 'lucide-react'
import type {
  ReportCategory,
  ReportSeverity,
  ReportStatus,
  SystemReport,
  SystemReportFilters,
  SystemReportStats,
} from '@polycheck/shared'
import { REPORT_CATEGORY_LABELS, REPORT_SEVERITY_LABELS, REPORT_STATUS_LABELS } from '@polycheck/shared'
import { api, ApiHttpError } from '@/lib/api-client'
import { API_BASE } from '@/lib/api-config'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNotifications } from '@/lib/notifications'
import { LoadingSpinner } from '@/lib/hooks'
import {
  CATEGORY_FILTER_OPTIONS,
  REPORT_STAT_CARDS,
  ROLE_FILTER_OPTIONS,
  SEVERITY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  describeTelemetry,
  severityBadgeClass,
  statusBadgeClass,
} from '@/components/reports/system-reports-helpers'

type CockpitUser = ReturnType<typeof api.getCurrentUser> & { scope?: string | null }

export default function SystemReportsPage() {
  const router = useRouter()
  const { addNotification } = useNotifications()
  const [user, setUser] = useState<CockpitUser | null>(null)
  const [stats, setStats] = useState<SystemReportStats | null>(null)
  const [page, setPage] = useState<{ data: SystemReport[]; total: number; hasMore: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<SystemReportFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [detail, setDetail] = useState<SystemReport | null>(null)
  const [nextStatus, setNextStatus] = useState<ReportStatus>('in_review')
  const [adminNotes, setAdminNotes] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    const syncUser = () => {
      const current = api.getCurrentUser()
      if (!current || current.role !== 'super_admin') {
        router.replace('/faculty')
        return
      }
      setUser(current)
    }
    syncUser()
    window.addEventListener('polycheck-auth-changed', syncUser)
    return () => window.removeEventListener('polycheck-auth-changed', syncUser)
  }, [router])

  // Debounced free-text search feeding server-side filters.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.search === searchInput ? current : { ...current, search: searchInput, offset: 0 },
      )
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async (signal?: AbortSignal) => {
    if (api.getCurrentUser()?.role !== 'super_admin') return
    setLoading(true)
    setError('')
    try {
      const [statsResult, pageResult] = await Promise.all([
        api.getSystemReportStats(),
        api.getSystemReports(filters, { signal }),
      ])
      setStats(statsResult)
      setPage(pageResult)
    } catch (cause) {
      if (signal?.aborted) return
      setError(cause instanceof Error ? cause.message : 'Unable to load system reports.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const openDetail = (report: SystemReport) => {
    setDetail(report)
    setNextStatus(report.status)
    setAdminNotes(report.adminNotes ?? '')
  }

  const saveStatus = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!detail) return
    setSavingStatus(true)
    try {
      const updated = await api.updateSystemReportStatus(detail.id, {
        status: nextStatus,
        ...(adminNotes.trim() ? { adminNotes: adminNotes.trim() } : {}),
      })
      setDetail(updated)
      setPage((current) =>
        current
          ? { ...current, data: current.data.map((row) => (row.id === updated.id ? updated : row)) }
          : current,
      )
      addNotification('success', 'Report updated', `${REPORT_STATUS_LABELS[updated.status]} — the submitter was notified when resolved.`)
    } catch (cause) {
      if (cause instanceof ApiHttpError) {
        addNotification('error', 'Update failed', cause.message)
      } else {
        addNotification('error', 'Update failed', 'Try again in a moment.')
      }
    } finally {
      setSavingStatus(false)
    }
  }

  const canManage = useMemo(() => user?.scope !== 'department', [user])

  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-pup-black">
      <Sidebar
        user={user}
        onLogout={() => {
          void api.logout()
          router.push('/')
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <MonitorSmartphone className="h-7 w-7 text-maroon dark:text-golden" aria-hidden="true" />
            <div className="flex-1">
              <h1 className="font-heading text-2xl font-bold text-maroon dark:text-white">System Reports</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Triage campus issue reports and feedback submitted by students and teachers.
              </p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {!canManage ? (
            <p
              role="note"
              className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
            >
              Department administrators have read-only access. Institution administrators triage and resolve.
            </p>
          ) : null}

          {error ? <p role="alert" className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          {stats ? (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="report-stats">
              {REPORT_STAT_CARDS.map((card) => (
                <Card key={card.key}>
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{card.label}</p>
                    <p
                      className="mt-1 font-heading text-2xl font-bold text-maroon dark:text-golden"
                      data-testid={card.testId}
                    >
                      {card.value(stats)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap items-end gap-3" data-testid="report-filters">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Category</Label>
              <select
                aria-label="Filter by category"
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                value={filters.category ?? ''}
                onChange={(event) =>
                  setFilters((c) => ({ ...c, category: (event.target.value || undefined) as ReportCategory | undefined, offset: 0 }))
                }
              >
                {CATEGORY_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Severity</Label>
              <select
                aria-label="Filter by severity"
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                value={filters.severity ?? ''}
                onChange={(event) =>
                  setFilters((c) => ({ ...c, severity: (event.target.value || undefined) as ReportSeverity | undefined, offset: 0 }))
                }
              >
                {SEVERITY_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Status</Label>
              <select
                aria-label="Filter by status"
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                value={filters.status ?? ''}
                onChange={(event) =>
                  setFilters((c) => ({ ...c, status: (event.target.value || undefined) as ReportStatus | undefined, offset: 0 }))
                }
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Role</Label>
              <select
                aria-label="Filter by role"
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                value={filters.role ?? ''}
                onChange={(event) =>
                  setFilters((c) => ({ ...c, role: (event.target.value || undefined) as 'student' | 'teacher' | undefined, offset: 0 }))
                }
              >
                {ROLE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">From</Label>
              <Input
                type="date"
                aria-label="Reports from date"
                className="h-9 w-36 text-xs"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setFilters((c) => ({ ...c, startDate: event.target.value || undefined, offset: 0 }))
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">To</Label>
              <Input
                type="date"
                aria-label="Reports to date"
                className="h-9 w-36 text-xs"
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setFilters((c) => ({ ...c, endDate: event.target.value || undefined, offset: 0 }))
                }}
              />
            </div>
            <div className="relative flex-1 min-w-52 space-y-1">
              <Label className="text-[10px] uppercase">Search</Label>
              <Search className="pointer-events-none absolute left-2.5 top-[30px] h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              <Input
                aria-label="Search reports"
                className="h-9 pl-8 text-xs"
                placeholder="Title or description"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : !page || page.data.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No reports match these filters.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800" data-testid="report-table">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-widest text-zinc-400 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold">Report</th>
                    <th className="px-4 py-2.5 text-left font-bold">Submitter</th>
                    <th className="px-4 py-2.5 text-left font-bold">Category</th>
                    <th className="px-4 py-2.5 text-left font-bold">Severity</th>
                    <th className="px-4 py-2.5 text-left font-bold">Status</th>
                    <th className="px-4 py-2.5 text-left font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {page.data.map((report) => (
                    <tr
                      key={report.id}
                      className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      onClick={() => openDetail(report)}
                    >
                      <td className="max-w-64 truncate px-4 py-3 font-medium text-foreground">{report.title}</td>
                      <td className="px-4 py-3">
                        <span className="block text-xs text-foreground">{report.user.fullName}</span>
                        <span className="text-[10px] uppercase tracking-widest text-zinc-400">{report.user.role}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">{REPORT_CATEGORY_LABELS[report.category]}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${severityBadgeClass(report.severity)}`}>
                          {REPORT_SEVERITY_LABELS[report.severity]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusBadgeClass(report.status)}`}>
                          {REPORT_STATUS_LABELS[report.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(report.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {page && page.total > page.data.length && page.hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setFilters((c) => ({ ...c, offset: (c.offset ?? 0) + (page.data.length || 50) }))}
              >
                Load more ({page.total - page.data.length} remaining)
              </Button>
            </div>
          ) : null}
        </div>
      </main>

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null)
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">{detail.title}</DialogTitle>
                <DialogDescription>
                  {REPORT_CATEGORY_LABELS[detail.category]} · submitted{' '}
                  {new Date(detail.createdAt).toLocaleString('en-PH')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-foreground dark:border-zinc-800 dark:bg-zinc-900">
                  {detail.description}
                </p>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-zinc-200 p-4 text-xs sm:grid-cols-2 dark:border-zinc-800">
                  {describeTelemetry(detail).map((row) => (
                    <div key={row.label}>
                      <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{row.label}</dt>
                      <dd className="mt-0.5 text-foreground">{row.value}</dd>
                    </div>
                  ))}
                </dl>

                {detail.screenshotUrl ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Screenshot</p>
                    {/* evidence bytes stream with auth and bypass the optimizer */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${API_BASE}${detail.screenshotUrl.replace(/^\/api/, '')}`}
                      alt={`Attachment for ${detail.title}`}
                      className="max-h-72 w-full rounded-xl border border-zinc-200 object-contain dark:border-zinc-800"
                    />
                  </div>
                ) : null}

                {canManage ? (
                  <form className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800" onSubmit={(event) => void saveStatus(event)}>
                    <div className="space-y-2">
                      <Label htmlFor="report-status">Status</Label>
                      <select
                        id="report-status"
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                        value={nextStatus}
                        onChange={(event) => setNextStatus(event.target.value as ReportStatus)}
                      >
                        {STATUS_FILTER_OPTIONS.filter((option) => option.value !== '').map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="report-admin-notes">Admin notes</Label>
                      <textarea
                        id="report-admin-notes"
                        rows={3}
                        maxLength={2_000}
                        placeholder="Internal triage notes, e.g. “Calibrated Room 302 geofence from 30m to 45m; verified resolved”."
                        value={adminNotes}
                        onChange={(event) => setAdminNotes(event.target.value)}
                        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setDetail(null)}>
                        Close
                      </Button>
                      <Button type="submit" disabled={savingStatus} className="bg-maroon text-white hover:bg-maroon-dark">
                        {savingStatus ? 'Saving…' : 'Save changes'}
                      </Button>
                    </div>
                  </form>
                ) : detail.adminNotes ? (
                  <p className="rounded-xl bg-zinc-50 p-4 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    <span className="font-bold uppercase tracking-widest text-zinc-400">Admin note:</span>{' '}
                    {detail.adminNotes}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
