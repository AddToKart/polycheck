'use client'

import Link from 'next/link'
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react'
import type { AttendanceStandingStatus, Section, StudentAtRisk } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const STANDING_STYLES: Record<
  AttendanceStandingStatus,
  { label: string; className: string }
> = {
  below_threshold: {
    label: 'Below threshold',
    className: 'bg-maroon-dark text-golden border border-golden',
  },
  at_risk: { label: 'At risk', className: 'bg-golden text-maroon-dark' },
  on_track: {
    label: 'On track',
    className: 'border border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
  },
  insufficient_data: {
    label: 'Not enough data',
    className: 'border border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500',
  },
}

function riskCaption(student: StudentAtRisk): string {
  if (student.status === 'below_threshold') {
    return `Below the ${student.thresholdPercent}% attendance threshold`
  }
  if (student.absencesBeforeBelowThreshold !== null) {
    const absences = student.absencesBeforeBelowThreshold
    if (absences === 0) return 'Next absence drops below threshold'
    return `${absences} absence${absences === 1 ? '' : 's'} until below threshold`
  }
  return 'Not enough counted sessions yet'
}

interface StudentsAtRiskCardProps {
  students: StudentAtRisk[]
  sections: Section[]
  sectionId: string
  loading: boolean
  error: string
  onSectionChange: (sectionId: string) => void
  onRetry: () => void
}

/** RISK2 — deterministic "students to check on" widget for the teacher dashboard. */
export function StudentsAtRiskCard({
  students,
  sections,
  sectionId,
  loading,
  error,
  onSectionChange,
  onRetry,
}: StudentsAtRiskCardProps) {
  return (
    <Card className="mb-12 rounded-none border-zinc-300/80 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
      <CardHeader className="flex-col gap-4 space-y-0 border-b border-zinc-200 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/50">
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-maroon dark:text-golden" aria-hidden="true" />
          Students to check on
        </CardTitle>
        <div className="flex items-center gap-2">
          <label
            htmlFor="at-risk-section"
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-400"
          >
            Section
          </label>
          <select
            id="at-risk-section"
            value={sectionId}
            onChange={(event) => onSectionChange(event.target.value)}
            className="h-8 min-w-[10rem] rounded-none border border-zinc-300 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-maroon dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="">All sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                Section {section.section}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p role="status" className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Checking attendance rates…
          </p>
        ) : error ? (
          <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-heading font-bold text-foreground">No students falling behind</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Everyone in this scope is meeting the attendance threshold.
            </p>
          </div>
        ) : (
          <ul>
            {students.map((student, index) => {
              const standing = STANDING_STYLES[student.status] ?? STANDING_STYLES.insufficient_data
              return (
                <li key={`${student.studentId}:${student.sectionId}`}>
                  <Link
                    href={`/faculty/students/${student.studentId}?sectionId=${student.sectionId}`}
                    className={`group flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      index !== 0 ? 'border-t border-zinc-200 dark:border-zinc-800' : ''
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-maroon text-xs font-bold text-golden dark:bg-golden dark:text-maroon-dark">
                      {student.studentName
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground group-hover:text-maroon dark:group-hover:text-golden">
                        {student.studentName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {student.subjectName} · Section {student.sectionName}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {riskCaption(student)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-lg font-heading font-bold text-foreground">
                        {student.attendanceRate === null ? '—' : `${Math.round(student.attendanceRate)}%`}
                      </span>
                      <span
                        className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${standing.className}`}
                      >
                        {standing.label}
                      </span>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-maroon dark:text-zinc-600 dark:group-hover:text-golden"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
