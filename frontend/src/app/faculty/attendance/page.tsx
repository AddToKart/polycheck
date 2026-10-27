'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import {
  formatCampusDate,
  getRecentCampusDateRange,
  type AttendanceReport,
  type Section,
  type Subject,
  type User,
} from '@polycheck/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import { Sidebar } from '@/components/layout/sidebar'
import {
  FilterBar,
  FilterDateRange,
  FilterSelect,
} from '@/components/FilterBar'
import { useUrlFilters } from '@/lib/hooks/use-url-filters'
import { useNotifications } from '@/lib/notifications'
import { Download, ChevronRight, RefreshCw } from 'lucide-react'

const { startDate: defaultFromDate, endDate: defaultToDate } = getRecentCampusDateRange(30)

const FILTER_SCHEMA = {
  subjectId: { defaultValue: '' },
  sectionId: { defaultValue: '' },
  from: { defaultValue: defaultFromDate },
  to: { defaultValue: defaultToDate },
} as const

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
] as const

type DatePresetKey = (typeof DATE_PRESETS)[number]['key']

function AttendanceOverviewContent() {
  const router = useRouter()
  const { addNotification } = useNotifications()
  const filters = useUrlFilters(FILTER_SCHEMA)
  const { subjectId, sectionId, from: fromDate, to: toDate } = filters.values

  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
    const fetchOptions = async () => {
      try {
        const [nextSubjects, nextSections] = await Promise.all([api.getSubjects(), api.getSections()])
        setSubjects(nextSubjects)
        setSections(nextSections)
      } catch {
        // The report remains usable; filter selects simply stay empty.
      }
    }
    void fetchOptions()
  }, [router])

  useEffect(() => {
    if (!user || !fromDate || !toDate) return
    let active = true
    setLoading(true)
    setError('')
    void api
      .getAttendanceReport({
        startDate: fromDate,
        endDate: toDate,
        subjectId: subjectId || undefined,
        sectionId: sectionId || undefined,
      })
      .then((nextReport) => {
        if (active) setReport(nextReport)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'The attendance report could not load.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, fromDate, toDate, subjectId, sectionId, retryKey])

  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects])
  const sectionMap = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections])

  const subjectOptions = useMemo(
    () => subjects.map((subject) => ({ value: subject.id, label: `${subject.name} (${subject.code})` })),
    [subjects],
  )

  const sectionOptions = useMemo(
    () =>
      sections
        .filter((section) => !subjectId || section.subjectId === subjectId)
        .map((section) => {
          const subject = subjectMap.get(section.subjectId)
          return {
            value: section.id,
            label: `Section ${section.section}${subject ? ` · ${subject.code}` : ''}`,
          }
        })
        .sort((left, right) => left.label.localeCompare(right.label)),
    [sections, subjectId, subjectMap],
  )

  const presetRanges = useMemo<Record<DatePresetKey, { startDate: string; endDate: string }>>(
    () => ({
      today: { startDate: formatCampusDate(), endDate: formatCampusDate() },
      '7d': getRecentCampusDateRange(7),
      '30d': getRecentCampusDateRange(30),
    }),
    [],
  )

  if (!user) return null

  const summaries = report?.summaries ?? []
  const totals = report?.totals ?? {
    totalRecords: 0,
    totalSessions: 0,
    present: 0,
    late: 0,
    absent: 0,
    pending: 0,
    disputed: 0,
    excused: 0,
  }

  const handleSubjectChange = (value: string) => {
    filters.setFilters({ subjectId: value, sectionId: '' })
  }

  const handlePreset = (key: DatePresetKey) => {
    const range = presetRanges[key]
    filters.setFilters({ from: range.startDate, to: range.endDate })
  }

  const reportFilters = {
    startDate: fromDate,
    endDate: toDate,
    subjectId: subjectId || undefined,
    sectionId: sectionId || undefined,
  }

  const handleExport = async () => {
    try {
      const csv = await api.exportAttendanceCsv(reportFilters)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance-${formatCampusDate()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      addNotification(
        'error',
        'Export Failed',
        cause instanceof Error ? cause.message : 'The attendance CSV could not be generated.',
      )
    }
  }

  const handleLogout = () => {
    api.logout()
    router.push('/')
  }

  const statCards = [
    { label: 'Total Sessions', value: totals.totalSessions, color: 'text-foreground' },
    { label: 'Present', value: totals.present, color: 'text-golden' },
    { label: 'Late', value: totals.late, color: 'text-maroon' },
    { label: 'Absent', value: totals.absent, color: 'text-maroon-dark dark:text-red-400' },
    { label: 'Excused', value: totals.excused ?? 0, color: 'text-maroon dark:text-golden' },
    { label: 'Pending', value: totals.pending, color: 'text-zinc-500' },
    { label: 'Disputed', value: totals.disputed, color: 'text-amber-600' },
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Attendance</p>
              <h1 className="text-3xl font-heading font-bold text-foreground">Attendance Overview</h1>
            </div>
            <Button onClick={handleExport} variant="outline" className="rounded-none text-xs font-bold uppercase tracking-widest">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <FilterBar
            className="mb-8"
            onClear={filters.clearAll}
            activeCount={filters.activeCount}
            label="Attendance filters"
          >
            <FilterSelect
              id="attendance-subject"
              label="Subject"
              value={subjectId}
              onChange={handleSubjectChange}
              options={subjectOptions}
              allLabel="All subjects"
              className="min-w-[13rem] flex-1"
            />
            <FilterSelect
              id="attendance-section"
              label="Section"
              value={sectionId}
              onChange={(value) => filters.setFilter('sectionId', value)}
              options={sectionOptions}
              allLabel="All sections"
              className="min-w-[13rem] flex-1"
            />
            <div className="min-w-[13rem] space-y-1">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Quick range
              </span>
              <div role="group" aria-label="Date range presets" className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map((preset) => {
                  const range = presetRanges[preset.key]
                  const active = fromDate === range.startDate && toDate === range.endDate
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handlePreset(preset.key)}
                      className={`h-9 rounded-none border px-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        active
                          ? 'border-maroon bg-maroon text-white dark:border-golden dark:bg-golden dark:text-maroon-dark'
                          : 'border-zinc-300 bg-white text-zinc-500 hover:border-maroon hover:text-maroon dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-golden dark:hover:text-golden'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <FilterDateRange
              idPrefix="attendance"
              from={fromDate}
              to={toDate}
              onFromChange={(value) => filters.setFilter('from', value)}
              onToChange={(value) => filters.setFilter('to', value)}
            />
          </FilterBar>

          {error ? (
            <div
              role="alert"
              className="mb-6 flex flex-col gap-3 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => setRetryKey((key) => key + 1)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          ) : null}

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-0 border border-zinc-300 dark:border-zinc-800 mb-8">
            {statCards.map((card, index) => (
              <div
                key={card.label}
                className={`p-5 border-zinc-300 dark:border-zinc-800 ${
                  index !== 0 ? 'border-l' : ''
                } ${index > 3 ? 'border-t lg:border-t-0' : ''}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">{card.label}</p>
                <p className={`text-3xl font-heading font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* By Subject Table */}
          <div className="border border-zinc-300 dark:border-zinc-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                By Subject · Click to view students
              </p>
              {loading ? (
                <span role="status" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Updating…
                </span>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                    <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Subject</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sessions</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-golden">Present</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-maroon">Late</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-maroon-dark dark:text-red-400">Absent</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden">Excused</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pending</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-amber-600">Disputed</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => {
                    const section = sectionMap.get(s.sectionId)
                    return (
                      <tr
                        key={s.sectionId}
                        className="border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40 dark:focus-visible:ring-golden/40"
                        onClick={() => router.push(`/faculty/sections/${s.sectionId}`)}
                        tabIndex={0}
                        aria-label={`View ${s.subjectName} section ${section?.section ?? ''} attendance`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            router.push(`/faculty/sections/${s.sectionId}`)
                          }
                        }}
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden transition-colors">
                            {s.subjectName}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Section {section?.section ?? s.sectionId.slice(-3).toUpperCase()}
                            {section?.room ? ` · ${section.room}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-600 dark:text-zinc-400 font-medium">{s.totalSessions}</td>
                        <td className="px-4 py-4 text-center">
                          <Badge variant="present">{s.present}</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge variant="late">{s.late}</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge variant="absent">{s.absent}</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge variant="excused">{s.excused ?? 0}</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge variant="pending">{s.pending}</Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge className="bg-amber-600 text-white">{s.disputed}</Badge>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-maroon dark:group-hover:text-golden transition-colors ml-auto" />
                        </td>
                      </tr>
                    )
                  })}
                  {summaries.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <span className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          {loading ? 'Loading attendance data…' : 'No attendance data available.'}
                          {!loading ? <StatusBadge status="pending" /> : null}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function AttendanceOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-xs font-bold uppercase tracking-widest text-zinc-500">
          Loading attendance…
        </div>
      }
    >
      <AttendanceOverviewContent />
    </Suspense>
  )
}

