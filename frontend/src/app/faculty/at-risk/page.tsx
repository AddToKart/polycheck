'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, FileWarning, Loader2, RefreshCw } from 'lucide-react'
import {
  GenerateAtRiskReferralSchema,
  type StudentAtRisk,
  type User,
} from '@polycheck/shared'
import { api, requestUserLogout } from '@/lib/api-client'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/lib/hooks'
import { useNotifications } from '@/lib/notifications'
import { chedNoticeDownloadPath, ReferralQueue } from '@/components/at-risk/ReferralQueue'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const AT_RISK_PAGE_SIZE = 10

const STATUS_LABELS: Record<StudentAtRisk['status'], string> = {
  below_threshold: 'Below threshold',
  at_risk: 'At risk',
  on_track: 'On track',
  insufficient_data: 'Insufficient data',
}

const STATUS_CLASSES: Record<StudentAtRisk['status'], string> = {
  below_threshold: 'bg-maroon text-white dark:bg-maroon',
  at_risk: 'bg-golden text-maroon-dark',
  on_track: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  insufficient_data: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
}

/** Rows whose attendance standing has crossed into CHED CMO No. 40 territory (WF-LD7). */
function isNoticeEligible(row: StudentAtRisk): boolean {
  return row.status === 'below_threshold' || row.status === 'at_risk'
}

const REFERRAL_ERROR_MESSAGES: Record<string, string> = {
  referral_active:
    'An active CHED referral already exists for this student in this section.',
  student_not_at_risk:
    'This student is no longer flagged as at risk — refresh the list before issuing another notice.',
}

function describeReferralError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code && REFERRAL_ERROR_MESSAGES[code]) return REFERRAL_ERROR_MESSAGES[code]
  return error instanceof Error ? error.message : 'Unable to issue the CHED notice.'
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

type AtRiskView = 'list' | 'referrals'

export default function AtRiskStudentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [rows, setRows] = useState<StudentAtRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<AtRiskView>('list')

  // F5: the "Issue CHED notice" confirmation dialog state.
  const { addNotification } = useNotifications()
  const [noticeRow, setNoticeRow] = useState<StudentAtRisk | null>(null)
  const [noticeNote, setNoticeNote] = useState('')
  const [noticeBusy, setNoticeBusy] = useState(false)
  const [noticeError, setNoticeError] = useState('')
  const [referralKey, setReferralKey] = useState(0)

  useEffect(() => {
    const current = api.getCurrentUser()
    // Teachers manage at-risk students for their own sections (backend-scoped);
    // department heads and super admins get department/institution scope.
    if (!current || (current.role !== 'teacher' && current.role !== 'super_admin')) {
      router.replace('/faculty')
      return
    }
    setUser(current)
  }, [router])

  const refreshRows = useCallback(
    () =>
      api
        .getAtRiskStudents({ limit: 50 })
        .then(setRows)
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : 'Unable to refresh')
        }),
    [],
  )

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    setError('')
    api
      .getAtRiskStudents({ limit: 50 })
      .then((result) => {
        if (active) setRows(result)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load at-risk students')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  const threshold = rows[0]?.thresholdPercent

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (left, right) =>
          left.studentName.localeCompare(right.studentName) ||
          left.sectionName.localeCompare(right.sectionName),
      ),
    [rows],
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / AT_RISK_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => sorted.slice((safePage - 1) * AT_RISK_PAGE_SIZE, safePage * AT_RISK_PAGE_SIZE),
    [sorted, safePage]
  )

  const openNoticeDialog = (row: StudentAtRisk) => {
    setNoticeNote('')
    setNoticeError('')
    setNoticeRow(row)
  }

  const closeNoticeDialog = useCallback(() => {
    setNoticeRow(null)
    setNoticeError('')
  }, [])

  const confirmIssueNotice = async () => {
    const row = noticeRow
    if (!row) return
    setNoticeError('')
    const validation = GenerateAtRiskReferralSchema.safeParse({
      studentId: row.studentId,
      sectionId: row.sectionId,
      note: noticeNote.trim() || undefined,
    })
    if (!validation.success) {
      setNoticeError(
        validation.error.issues[0]?.message ?? 'Note must be 500 characters or fewer.',
      )
      return
    }
    setNoticeBusy(true)
    try {
      const referral = await api.generateAtRiskReferral(validation.data)
      addNotification(
        'success',
        'CHED notice issued',
        `The notice of impending drop for ${row.studentName} was generated and downloaded.`,
      )
      closeNoticeDialog()
      setNoticeNote('')
      try {
        const blob = await api.downloadAssistantFile(chedNoticeDownloadPath(referral.id))
        triggerBrowserDownload(blob, 'PUP-CHED-Drop-Notice.pdf')
      } catch (downloadCause) {
        addNotification(
          'warning',
          'Notice download failed',
          downloadCause instanceof Error ? downloadCause.message : 'Re-download the notice from the Referrals tab.',
        )
      }
      setReferralKey((current) => current + 1)
      await refreshRows()
    } catch (cause) {
      setNoticeError(describeReferralError(cause))
    } finally {
      setNoticeBusy(false)
    }
  }

  const handleLogout = () => {
    void requestUserLogout().then((outcome) => {
      if (outcome.loggedOut) router.push('/')
    })
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-8">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Academic department oversight
              </p>
              <h1 className="flex items-center gap-2 text-3xl font-heading font-bold text-maroon dark:text-white">
                <AlertTriangle className="h-7 w-7" aria-hidden />
                At-risk students
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {user.role === 'teacher' && user.isDepartmentHead
                  ? `Students in ${user.department ?? 'your department'} approaching the ${threshold ?? 75}% attendance floor.`
                  : user.role === 'teacher'
                    ? `Students in your sections approaching the ${threshold ?? 75}% attendance floor.`
                    : `Students approaching the ${threshold ?? 75}% attendance floor in your scope.`}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setLoading(true)
                void refreshRows().finally(() => setLoading(false))
                setReferralKey((current) => current + 1)
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </Button>
          </div>

          <div className="mb-4 flex gap-2" role="tablist" aria-label="At-risk views">
            {(
              [
                { id: 'list', label: 'Oversight list' },
                { id: 'referrals', label: 'Referrals' },
              ] as const
            ).map((tab) => {
              const selected = view === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setView(tab.id)}
                  className={
                    selected
                      ? 'border border-maroon bg-maroon px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white dark:border-golden dark:bg-golden dark:text-maroon-dark'
                      : 'border border-zinc-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:border-maroon hover:text-maroon dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-golden dark:hover:text-golden'
                  }
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {view === 'list' && error ? (
            <p
              role="alert"
              className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          {view === 'referrals' ? (
            <ReferralQueue user={user} refreshKey={referralKey} />
          ) : (
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center gap-3 py-16 text-sm text-zinc-500">
                    <LoadingSpinner />
                    Loading oversight data…
                  </div>
                ) : sorted.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="font-heading text-lg font-bold text-maroon dark:text-golden">
                      Everyone is on track
                    </p>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      No students are near the attendance threshold in your scope yet.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Phone layout: stacked rows from the same oversight data */}
                    <div className="divide-y divide-zinc-100 md:hidden dark:divide-zinc-800/60">
                      {pagedRows.map((row) => (
                        <div key={`${row.sectionId}:${row.studentId}`} className="space-y-3 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{row.studentName}</p>
                              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                {row.studentNumber ?? '—'}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${STATUS_CLASSES[row.status]}`}
                              >
                                {STATUS_LABELS[row.status]}
                              </span>
                              {row.absencesBeforeBelowThreshold === 0 ? (
                                <span
                                  data-testid="impending-drop"
                                  className="inline-block bg-golden px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-maroon-dark"
                                >
                                  Impending drop
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="min-w-0 text-xs text-zinc-600 dark:text-zinc-300">
                            <p className="font-medium">{row.subjectName}</p>
                            <p className="text-zinc-500 dark:text-zinc-400">
                              {row.sectionName} · {row.professorName}
                            </p>
                          </div>
                          <dl className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <dt className="text-[10px] uppercase tracking-widest text-zinc-400">Rate</dt>
                              <dd className="mt-0.5 font-semibold text-zinc-800 dark:text-zinc-100">
                                {row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[10px] uppercase tracking-widest text-zinc-400">Absences left</dt>
                              <dd className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                                {row.absencesBeforeBelowThreshold ?? '—'}
                              </dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-[10px] uppercase tracking-widest text-zinc-400">Last absence</dt>
                              <dd className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                                {row.lastAbsenceDate ?? '—'}
                              </dd>
                            </div>
                          </dl>
                          {isNoticeEligible(row) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-11"
                              onClick={() => openNoticeDialog(row)}
                            >
                              <FileWarning className="h-4 w-4" aria-hidden />
                              Issue CHED notice
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-zinc-200 text-[10px] uppercase tracking-widest text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                          <tr>
                            <th className="px-5 py-3">Student</th>
                            <th className="px-5 py-3">Section</th>
                            <th className="px-5 py-3">Professor</th>
                            <th className="px-5 py-3">Rate</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Absences left</th>
                            <th className="px-5 py-3">Last absence</th>
                            <th className="px-5 py-3 text-right">CHED notice</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedRows.map((row) => (
                            <tr
                              key={`${row.sectionId}:${row.studentId}`}
                              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                            >
                              <td className="px-5 py-3">
                                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{row.studentName}</p>
                                <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                  {row.studentNumber ?? '—'}
                                </p>
                              </td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                                <p>{row.subjectName}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.sectionName}</p>
                              </td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">{row.professorName}</td>
                              <td className="px-5 py-3 font-semibold text-zinc-800 dark:text-zinc-100">
                                {row.attendanceRate === null ? '—' : `${row.attendanceRate}%`}
                              </td>
                              <td className="px-5 py-3">
                                <span
                                  className={`inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${STATUS_CLASSES[row.status]}`}
                                >
                                  {STATUS_LABELS[row.status]}
                                </span>
                                {row.absencesBeforeBelowThreshold === 0 ? (
                                  <span
                                    data-testid="impending-drop"
                                    className="mt-1 block w-fit bg-golden px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-maroon-dark"
                                  >
                                    Impending drop
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                                {row.absencesBeforeBelowThreshold ?? '—'}
                              </td>
                              <td className="px-5 py-3 text-zinc-600 dark:text-zinc-300">
                                {row.lastAbsenceDate ?? '—'}
                              </td>
                              <td className="px-5 py-3 text-right">
                                {isNoticeEligible(row) ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openNoticeDialog(row)}
                                    aria-label={`Issue CHED notice for ${row.studentName}`}
                                  >
                                    <FileWarning className="h-3.5 w-3.5" aria-hidden />
                                    Issue
                                  </Button>
                                ) : (
                                  <span className="text-zinc-300 dark:text-zinc-700">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {sorted.length > 0 && (
                      <PaginationBar
                        page={safePage}
                        totalPages={totalPages}
                        totalItems={sorted.length}
                        pageSize={AT_RISK_PAGE_SIZE}
                        itemName="students"
                        onPageChange={setPage}
                        showNumbers
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog
        open={Boolean(noticeRow)}
        onOpenChange={(open) => {
          if (!open && !noticeBusy) closeNoticeDialog()
        }}
      >
        <DialogContent className="w-[92vw] max-h-[90vh] overflow-y-auto max-w-md dark:border-golden/15 dark:bg-surface-dark">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Issue CHED notice</DialogTitle>
            <DialogDescription>
              Generates the official Notice of Impending Drop (CHED CMO No. 40, Art. V §21) slip,
              downloads it for the student record, and alerts the department head.
            </DialogDescription>
          </DialogHeader>

          {noticeRow ? (
            <div className="mt-2 space-y-4">
              <div className="space-y-1 border-b border-zinc-200 pb-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <p>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">Student:</span>{' '}
                  {noticeRow.studentName}
                  {noticeRow.studentNumber ? ` (${noticeRow.studentNumber})` : ''}
                </p>
                <p>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">Section:</span>{' '}
                  {noticeRow.subjectName} · {noticeRow.sectionName}
                </p>
                <p>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">Standing:</span>{' '}
                  {noticeRow.attendanceRate === null ? '—' : `${noticeRow.attendanceRate}%`} of the{' '}
                  {noticeRow.thresholdPercent}% floor
                  {noticeRow.absencesBeforeBelowThreshold === 0 ? ' — threshold reached' : ''}
                </p>
              </div>

              <div>
                <label
                  htmlFor="ched-note"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-zinc-500"
                >
                  Note <span className="font-medium normal-case tracking-normal text-zinc-400">(optional)</span>
                </label>
                <textarea
                  id="ched-note"
                  rows={4}
                  maxLength={500}
                  value={noticeNote}
                  onChange={(event) => setNoticeNote(event.target.value)}
                  placeholder="e.g. Fourth consecutive absence verified against the class record; advising guidance counseling."
                  aria-invalid={Boolean(noticeError)}
                  aria-describedby={noticeError ? 'ched-note-error' : undefined}
                  className="w-full resize-none border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-maroon focus:ring-2 focus:ring-maroon/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <p className="mt-1 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {noticeNote.trim().length}/500
                </p>
              </div>

              {noticeError ? (
                <div
                  role="alert"
                  id="ched-note-error"
                  className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                >
                  {noticeError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <DialogClose asChild>
                  <Button variant="outline" disabled={noticeBusy}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  onClick={() => void confirmIssueNotice()}
                  disabled={noticeBusy}
                  className="rounded-none bg-maroon text-white text-xs font-bold uppercase tracking-widest hover:bg-maroon-dark"
                >
                  {noticeBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <FileWarning className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {noticeBusy ? 'Generating…' : 'Generate notice'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
