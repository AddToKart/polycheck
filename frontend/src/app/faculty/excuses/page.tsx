'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle,
  FileCheck2,
  ImageOff,
  Layers,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import type { AttendanceRecord, Section, Subject, User } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ExcuseStatusBadge from '@/components/ExcuseStatusBadge'
import { FilterBar, FilterDateRange, FilterSelect } from '@/components/FilterBar'
import { useUrlFilters } from '@/lib/hooks/use-url-filters'
import { EXCUSE_REASON_LABELS } from '@/lib/excuse'
import { resolveEvidenceUrl } from '@/lib/evidence-url'
import { useNotifications } from '@/lib/notifications'
import { LoadingSpinner } from '@/lib/hooks'

const FILTER_SCHEMA = {
  sectionId: { defaultValue: '' },
  from: { defaultValue: '' },
  to: { defaultValue: '' },
} as const

type ExcuseTab = 'pending' | 'resolved'

interface StudentGroup {
  studentId: string
  studentName: string
  records: AttendanceRecord[]
}

interface SectionGroup {
  sectionId: string
  sectionName: string
  subjectName: string
  students: StudentGroup[]
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function ExcusesContent() {
  const router = useRouter()
  const { addNotification } = useNotifications()
  const filters = useUrlFilters(FILTER_SCHEMA)
  const { sectionId, from, to } = filters.values

  const [user, setUser] = useState<User | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [tab, setTab] = useState<ExcuseTab>('pending')
  const [selected, setSelected] = useState<AttendanceRecord | null>(null)
  const [note, setNote] = useState('')
  const [deciding, setDeciding] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [evidenceFailed, setEvidenceFailed] = useState(false)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/faculty')
      return
    }
    setUser(cu)
    const fetchOptions = async () => {
      try {
        const [nextSections, nextSubjects] = await Promise.all([api.getSections(), api.getSubjects()])
        setSections(nextSections)
        setSubjects(nextSubjects)
      } catch {
        // The queue still renders; labels fall back to record fields.
      }
    }
    void fetchOptions()
  }, [router])

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    setLoadError('')
    void api
      .listExcuses({
        sectionId: sectionId || undefined,
        startDate: from || undefined,
        endDate: to || undefined,
      })
      .then((nextRecords) => {
        if (active) setRecords(nextRecords.filter((record) => Boolean(record.excuseStatus)))
      })
      .catch((cause) => {
        if (active) setLoadError(cause instanceof Error ? cause.message : 'The excuse queue could not load.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, sectionId, from, to, retryKey])

  const sectionMap = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections])
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects])

  const sectionOptions = useMemo(
    () =>
      sections
        .map((section) => {
          const subject = subjectMap.get(section.subjectId)
          return {
            value: section.id,
            label: `Section ${section.section}${subject ? ` · ${subject.code}` : ''}`,
          }
        })
        .sort((left, right) => left.label.localeCompare(right.label)),
    [sections, subjectMap],
  )

  const pendingCount = records.filter((record) => record.excuseStatus === 'requested').length
  const resolvedCount = records.filter(
    (record) => record.excuseStatus === 'approved' || record.excuseStatus === 'rejected',
  ).length

  const visibleRecords = useMemo(
    () =>
      records
        .filter((record) =>
          tab === 'pending' ? record.excuseStatus === 'requested' : record.excuseStatus !== 'requested',
        )
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()),
    [records, tab],
  )

  const grouped = useMemo(() => {
    const groups = new Map<string, SectionGroup>()
    for (const record of visibleRecords) {
      const section = sectionMap.get(record.sectionId)
      const subject = section ? subjectMap.get(section.subjectId) : undefined
      const sectionKey = record.sectionId
      if (!groups.has(sectionKey)) {
        groups.set(sectionKey, {
          sectionId: record.sectionId,
          sectionName: section ? `Section ${section.section}` : 'Unknown section',
          subjectName: subject?.name ?? 'Unknown subject',
          students: [],
        })
      }
      const group = groups.get(sectionKey)!
      let studentGroup = group.students.find((student) => student.studentId === record.studentId)
      if (!studentGroup) {
        studentGroup = { studentId: record.studentId, studentName: record.studentName, records: [] }
        group.students.push(studentGroup)
      }
      studentGroup.records.push(record)
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        students: [...group.students].sort((left, right) => left.studentName.localeCompare(right.studentName)),
      }))
      .sort((left, right) => left.subjectName.localeCompare(right.subjectName))
  }, [visibleRecords, sectionMap, subjectMap])

  const openRecord = (record: AttendanceRecord) => {
    setSelected(record)
    setNote('')
    setDecisionError('')
    setEvidenceFailed(false)
  }

  const handleDecision = async (decision: 'approve' | 'reject') => {
    if (!selected || user?.role !== 'teacher') return
    const prompt =
      decision === 'approve'
        ? `Approve ${selected.studentName}'s excuse? The record will be marked Excused.`
        : `Reject ${selected.studentName}'s excuse? The original attendance status stays unchanged.`
    if (!window.confirm(prompt)) return
    setDeciding(true)
    setDecisionError('')
    try {
      await api.decideExcuse(selected.id, decision, note.trim() || undefined)
      addNotification(
        decision === 'approve' ? 'success' : 'info',
        decision === 'approve' ? 'Excuse Approved' : 'Excuse Rejected',
        `${selected.studentName}'s excuse was ${decision === 'approve' ? 'approved' : 'rejected'}.`,
      )
      setSelected(null)
      setRetryKey((key) => key + 1)
    } catch (cause) {
      setDecisionError(cause instanceof Error ? cause.message : 'The decision could not be saved.')
    } finally {
      setDeciding(false)
    }
  }

  if (!user) return null

  const isTeacher = user.role === 'teacher'
  const selectedSection = selected ? sectionMap.get(selected.sectionId) : undefined
  const selectedSubject = selectedSection ? subjectMap.get(selectedSection.subjectId) : undefined
  const evidenceUrl = selected ? resolveEvidenceUrl(selected.excuseEvidencePath) : null

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-100 dark:bg-pup-black">
      <Sidebar user={user} onLogout={() => { api.logout(); router.push('/') }} />
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-pup-black border-b border-zinc-300/80 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-heading font-bold text-maroon-dark dark:text-golden">Excuse Requests</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isTeacher
                ? `${pendingCount} awaiting review, ${resolvedCount} resolved`
                : `${pendingCount} pending, ${resolvedCount} resolved · read-only oversight`}
            </p>
          </div>
        </div>

        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="flex border-b border-zinc-300 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setTab('pending')}
              aria-pressed={tab === 'pending'}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 rounded-none focus:outline-none ${
                tab === 'pending'
                  ? 'border-maroon dark:border-golden text-maroon dark:text-golden'
                  : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              Pending Requests ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setTab('resolved')}
              aria-pressed={tab === 'resolved'}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 rounded-none focus:outline-none ${
                tab === 'resolved'
                  ? 'border-maroon dark:border-golden text-maroon dark:text-golden'
                  : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              Resolved History ({resolvedCount})
            </button>
          </div>

          <FilterBar
            onClear={filters.clearAll}
            activeCount={filters.activeCount}
            label="Excuse filters"
          >
            <FilterSelect
              id="excuse-section"
              label="Section"
              value={sectionId}
              onChange={(value) => filters.setFilter('sectionId', value)}
              options={sectionOptions}
              allLabel="All sections"
              className="min-w-[14rem] flex-1"
            />
            <FilterDateRange
              idPrefix="excuse"
              from={from}
              to={to}
              onFromChange={(value) => filters.setFilter('from', value)}
              onToChange={(value) => filters.setFilter('to', value)}
            />
          </FilterBar>

          {loading ? (
            <LoadingSpinner className="py-16" />
          ) : loadError ? (
            <Card className="rounded-none dark:border-golden/15 dark:bg-surface-dark">
              <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
                <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : grouped.length === 0 ? (
            <Card className="rounded-none dark:border-golden/15 dark:bg-surface-dark">
              <CardContent className="p-12 text-center">
                <FileCheck2 className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" aria-hidden="true" />
                <h2 className="text-lg font-heading font-bold dark:text-white mb-2">
                  No {tab === 'pending' ? 'pending' : 'resolved'} excuses found
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Try adjusting the section or date filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {grouped.map((group) => (
                <Card
                  key={group.sectionId}
                  className="rounded-none border border-zinc-200 dark:border-golden/15 dark:bg-surface-dark overflow-hidden"
                >
                  <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <Layers className="w-5 h-5 text-maroon dark:text-golden" aria-hidden="true" />
                    <div>
                      <h2 className="text-sm font-bold text-maroon-dark dark:text-golden uppercase tracking-wide">
                        {group.subjectName}
                      </h2>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {group.sectionName} · {group.students.reduce((sum, student) => sum + student.records.length, 0)} request
                        {group.students.reduce((sum, student) => sum + student.records.length, 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {group.students.map((student) => (
                      <div key={student.studentId} className="p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                          {student.studentName}
                        </p>
                        <div className="space-y-2">
                          {student.records.map((record) => (
                            <button
                              key={record.id}
                              type="button"
                              onClick={() => openRecord(record)}
                              className="flex w-full items-start justify-between gap-3 border border-zinc-200 px-3 py-2 text-left transition-colors hover:border-maroon/40 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-golden/30 dark:hover:bg-zinc-900"
                              aria-label={`Review excuse request from ${record.studentName}`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-foreground">
                                  {record.excuseReason ? EXCUSE_REASON_LABELS[record.excuseReason] : 'Excuse'}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {record.excuseDescription ?? 'No description provided.'}
                                </p>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                  {formatDateTime(record.timestamp)}
                                </p>
                              </div>
                              {record.excuseStatus ? <ExcuseStatusBadge status={record.excuseStatus} /> : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open && !deciding) setSelected(null) }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto dark:bg-surface-dark dark:border-golden/15 p-8">
          {selected ? (
            <>
              <DialogHeader className="items-center text-center">
                <FileCheck2 className="w-10 h-10 text-maroon dark:text-golden mx-auto mb-3" aria-hidden="true" />
                <DialogTitle className="dark:text-white">
                  {selected.excuseStatus === 'requested' ? 'Review Excuse' : 'Excuse Archive'}
                </DialogTitle>
                <DialogDescription className="font-semibold text-maroon dark:text-golden">
                  {selected.studentName}
                </DialogDescription>
              </DialogHeader>

              <div className="bg-zinc-50 dark:bg-pup-black border border-zinc-200 dark:border-zinc-800 p-4 mb-4 space-y-2 text-sm rounded-none">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500 dark:text-zinc-400">Status</span>
                  {selected.excuseStatus ? <ExcuseStatusBadge status={selected.excuseStatus} /> : null}
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-20">Subject</span>
                  <span className="dark:text-zinc-300">{selectedSubject?.name ?? 'Unknown'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-20">Section</span>
                  <span className="dark:text-zinc-300">{selectedSection ? `Section ${selectedSection.section}` : 'Unknown'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-20">Session</span>
                  <span className="dark:text-zinc-300">{formatDateTime(selected.timestamp)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-20">Reason</span>
                  <span className="font-bold text-maroon dark:text-golden">
                    {selected.excuseReason ? EXCUSE_REASON_LABELS[selected.excuseReason] : 'Unknown'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-20">Details</span>
                  <span className="dark:text-zinc-300">{selected.excuseDescription ?? 'No description provided.'}</span>
                </div>
                {selected.excuseReviewedAt ? (
                  <div className="flex gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-20">Reviewed</span>
                    <span className="dark:text-zinc-300">{formatDateTime(selected.excuseReviewedAt)}</span>
                  </div>
                ) : null}
                {selected.excuseReviewNote ? (
                  <div className="flex gap-2">
                    <span className="text-zinc-500 dark:text-zinc-400 shrink-0 w-20">Note</span>
                    <span className="dark:text-zinc-300">{selected.excuseReviewNote}</span>
                  </div>
                ) : null}
              </div>

              <div className="mb-4">
                <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-zinc-500">Evidence</p>
                {evidenceUrl && !evidenceFailed ? (
                  <div className="space-y-1">
                    <a
                      href={evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-pup-black"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={evidenceUrl}
                        alt={`Evidence attached to ${selected.studentName}'s excuse`}
                        className="mx-auto max-h-56 w-full object-contain"
                        onError={() => setEvidenceFailed(true)}
                      />
                    </a>
                    <a
                      href={evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold uppercase tracking-widest text-maroon hover:underline dark:text-golden"
                    >
                      Open full size
                    </a>
                  </div>
                ) : selected.excuseEvidencePath ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Evidence is attached but cannot be previewed in this browser.
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                    <ImageOff className="w-3.5 h-3.5" aria-hidden="true" />
                    No photo attached
                  </p>
                )}
              </div>

              {isTeacher && selected.excuseStatus === 'requested' ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="excuse-decision-note" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Note to student <span className="font-medium normal-case tracking-normal text-zinc-400">(optional)</span>
                    </label>
                    <textarea
                      id="excuse-decision-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Explain the decision…"
                      className="w-full resize-none rounded-none border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-maroon focus:ring-2 focus:ring-maroon/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  {decisionError ? (
                    <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                      {decisionError}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-none bg-green-600 text-white hover:bg-green-700"
                      disabled={deciding}
                      onClick={() => void handleDecision('approve')}
                    >
                      <CheckCircle className="w-4 h-4" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-none"
                      disabled={deciding}
                      onClick={() => void handleDecision('reject')}
                    >
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mb-4 border border-zinc-200 bg-zinc-100 px-3 py-3 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-pup-black dark:text-zinc-400">
                  {selected.excuseStatus === 'requested'
                    ? 'Read-only oversight. The assigned teacher reviews this request.'
                    : 'This request has been decided and logged in history.'}
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full rounded-none text-zinc-500 dark:text-zinc-400"
                onClick={() => setSelected(null)}
                disabled={deciding}
              >
                Close
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ExcusesPage() {
  return (
    <Suspense fallback={null}>
      <ExcusesContent />
    </Suspense>
  )
}

