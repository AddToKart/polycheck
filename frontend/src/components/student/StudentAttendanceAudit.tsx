'use client'

import { Clock, X } from 'lucide-react'
import type { AttendanceRecord, AttendanceStatus } from '@polycheck/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FilterDateField, FilterSelect, type FilterOption } from '@/components/FilterBar'
import { AttendanceRow } from './StudentDashboardOverview'

interface StudentAttendanceAuditProps {
  records: AttendanceRecord[]
  filteredCount: number
  filter: 'all' | AttendanceStatus
  page: number
  pageCount: number
  pageSize: number
  onFilterChange: (filter: 'all' | AttendanceStatus) => void
  onPageChange: (page: number) => void
  onReportIssue: (record: AttendanceRecord) => void
  onRequestExcuse: (record: AttendanceRecord) => void
  sectionSubjectName: (sectionId: string) => string
  subjectOptions: FilterOption[]
  subjectId: string
  fromDate: string
  toDate: string
  onSubjectChange: (value: string) => void
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onClearFilters: () => void
}

export function StudentAttendanceAudit(props: StudentAttendanceAuditProps) {
  const hasFilters = Boolean(props.subjectId || props.fromDate || props.toDate || props.filter !== 'all')

  return (
    <Card className="rounded-none border-zinc-300 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
      <CardHeader className="border-b border-zinc-300 dark:border-zinc-800 p-6">
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-4 h-4 text-maroon dark:text-golden" />
          Full Attendance Audit
        </CardTitle>
        <div className="flex flex-wrap gap-2 pt-4">
          {(['all', 'present', 'late', 'absent', 'excused', 'pending', 'disputed'] as const).map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={props.filter === status ? 'default' : 'outline'}
              className="h-8 rounded-none text-[10px] font-bold uppercase tracking-wider"
              onClick={() => props.onFilterChange(status)}
              aria-pressed={props.filter === status}
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <FilterSelect
            id="student-history-subject"
            label="Subject"
            value={props.subjectId}
            onChange={props.onSubjectChange}
            options={props.subjectOptions}
            allLabel="All subjects"
            className="min-w-[12rem] flex-1"
          />
          <FilterDateField
            id="student-history-from"
            label="From"
            value={props.fromDate}
            onChange={props.onFromDateChange}
          />
          <FilterDateField
            id="student-history-to"
            label="To"
            value={props.toDate}
            onChange={props.onToDateChange}
          />
          <button
            type="button"
            onClick={props.onClearFilters}
            disabled={!hasFilters}
            className="mb-0.5 inline-flex h-9 items-center gap-1.5 rounded-none border border-zinc-300 bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:border-maroon hover:text-maroon disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-golden dark:hover:text-golden"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-300/60 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30">
                <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Subject</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Date/Time</th>
                <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Result</th>
                <th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {props.records.map((record) => (
                <AttendanceRow
                  key={record.id}
                  record={record}
                  subjectName={props.sectionSubjectName(record.sectionId)}
                  onReportIssue={props.onReportIssue}
                  onRequestExcuse={props.onRequestExcuse}
                />
              ))}
              {props.filteredCount === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                    No {props.filter === 'all' ? '' : `${props.filter} `}attendance records
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
      {props.pageCount > 1 ? (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/30 gap-4">
          <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
            Showing {props.page * props.pageSize + 1} - {Math.min((props.page + 1) * props.pageSize, props.filteredCount)} of {props.filteredCount} scans
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <Button variant="outline" size="sm" className="rounded-none text-xs font-bold uppercase tracking-widest h-8" onClick={() => props.onPageChange(Math.max(0, props.page - 1))} disabled={props.page === 0}>Prev</Button>
            {Array.from({ length: props.pageCount }, (_, index) => (
              <Button
                key={index}
                variant={props.page === index ? 'default' : 'outline'}
                size="sm"
                className={`rounded-none text-xs font-bold w-8 h-8 p-0 ${props.page === index ? 'bg-maroon hover:bg-maroon-dark text-white border-maroon' : 'text-zinc-500 hover:text-foreground'}`}
                onClick={() => props.onPageChange(index)}
              >
                {index + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="rounded-none text-xs font-bold uppercase tracking-widest h-8" onClick={() => props.onPageChange(Math.min(props.pageCount - 1, props.page + 1))} disabled={props.page === props.pageCount - 1}>Next</Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
