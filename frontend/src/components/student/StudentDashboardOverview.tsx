'use client'

import { AlertTriangle, Calendar, Clock } from 'lucide-react'
import type { AttendanceRecord, CalendarEvent, Student } from '@polycheck/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatusBadge from '@/components/StatusBadge'
import { formatTime } from '@/lib/calendar-utils'
import { StudentDigitalId } from './StudentDigitalId'

const statCards = [
  { key: 'present', label: 'Present', color: 'text-golden' },
  { key: 'late', label: 'Late', color: 'text-maroon' },
  { key: 'absent', label: 'Absent', color: 'text-maroon-dark' },
  { key: 'disputed', label: 'Disputed', color: 'text-maroon-dark dark:text-golden' },
] as const

interface StudentDashboardOverviewProps {
  user: Student
  stats: Record<(typeof statCards)[number]['key'], number>
  todayEvents: CalendarEvent[]
  records: AttendanceRecord[]
  isIdOpen: boolean
  isIdFlipped: boolean
  onOpenId: () => void
  onCloseId: () => void
  onFlipId: () => void
  onOpenSchedule: () => void
  onOpenScanner: (sessionId?: string) => void
  onReportIssue: (record: AttendanceRecord) => void
  sectionSubjectName: (sectionId: string) => string
}

const eventPresentation = (event: CalendarEvent) => {
  if (event.studentStatus === 'present') return { border: 'border-l-emerald-500', label: 'Present', badge: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/30' }
  if (event.studentStatus === 'late') return { border: 'border-l-amber-500', label: 'Late', badge: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30' }
  if (event.studentStatus === 'absent') return { border: 'border-l-rose-500', label: 'Absent', badge: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/30' }
  if (event.status === 'active') return { border: 'border-l-golden', label: 'Active Now', badge: 'text-maroon bg-golden/20 dark:text-golden dark:bg-golden/10 border border-golden/30' }
  return { border: 'border-l-zinc-300 dark:border-l-zinc-800', label: 'Scheduled', badge: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800' }
}

export function StudentDashboardOverview(props: StudentDashboardOverviewProps) {
  const { user, stats, todayEvents, records, sectionSubjectName } = props

  return (
    <div className="grid lg:grid-cols-3 gap-8 mb-8 items-start">
      <StudentDigitalId user={user} isOpen={props.isIdOpen} isFlipped={props.isIdFlipped} onOpen={props.onOpenId} onClose={props.onCloseId} onFlip={props.onFlipId} />

      <div className="lg:col-span-2 flex flex-col gap-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border border-zinc-300 dark:border-zinc-800 bg-background shadow-[0_4px_20px_rgba(123,17,19,0.035)] dark:shadow-none">
          {statCards.map(({ key, label, color }, index) => (
            <div key={key} className={`p-6 border-zinc-300 dark:border-zinc-800 ${index !== 0 ? 'border-l' : ''} ${index > 1 ? 'border-t lg:border-t-0' : ''}`}>
              <div className="flex items-center gap-3 mb-4 text-zinc-400"><p className="text-[10px] font-bold uppercase tracking-widest">{label}</p></div>
              <p className={`text-4xl font-heading font-bold ${color}`}>{stats[key]}</p>
            </div>
          ))}
        </div>

        <Card className="rounded-none border-zinc-300 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden shadow-none bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 p-6 flex flex-row items-center justify-between space-y-0 bg-zinc-50 dark:bg-zinc-900/50">
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Calendar className="w-4 h-4 text-maroon dark:text-golden" />Today&apos;s Schedule</CardTitle>
            <button onClick={props.onOpenSchedule} className="text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden hover:opacity-85 transition-opacity">Full Schedule</button>
          </CardHeader>
          <CardContent className="p-6">
            {todayEvents.length === 0 ? (
              <div className="text-center py-6"><p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No classes scheduled for today</p></div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {todayEvents.map((event) => {
                  const presentation = eventPresentation(event)
                  const activeWithoutAttendance = event.status === 'active' && !event.studentStatus
                  return (
                    <div key={event.id} className={`p-4 border border-zinc-200 dark:border-zinc-800 border-l-4 ${presentation.border} bg-background dark:bg-zinc-900/30 flex flex-col justify-between rounded-none`}>
                      <div className="flex justify-between items-start mb-2 gap-4">
                        <div className="min-w-0"><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{formatTime(event.startTime)} - {formatTime(event.endTime)}</p><h4 className="text-sm font-bold text-foreground truncate leading-snug">{event.subjectName}</h4></div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 whitespace-nowrap ${presentation.badge}`}>{presentation.label}</span>
                      </div>
                      <div className="mt-4 flex justify-between items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        <span>Sec {event.sectionName} {event.room ? `\\ ${event.room}` : ''}</span>
                        {activeWithoutAttendance ? (
                          <button onClick={() => props.onOpenScanner(event.type === 'session' ? event.id : undefined)} className="text-[9px] font-bold uppercase tracking-widest text-maroon dark:text-golden border border-maroon dark:border-golden px-2 py-1 bg-white dark:bg-zinc-800 hover:bg-maroon hover:text-white dark:hover:bg-golden dark:hover:text-maroon transition-colors">Scan Attendance</button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-zinc-300 dark:border-zinc-800 border-t-4 border-t-maroon dark:border-t-golden">
          <CardHeader className="border-b border-zinc-300 dark:border-zinc-800 p-6"><CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4 text-maroon dark:text-golden" />Recent Scans</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b-2 border-zinc-300/60 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30"><th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Subject</th><th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Date/Time</th><th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Result</th><th className="text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Action</th></tr></thead>
              <tbody>
                {records.map((record) => <AttendanceRow key={record.id} record={record} subjectName={sectionSubjectName(record.sectionId)} onReportIssue={props.onReportIssue} />)}
                {records.length === 0 ? <tr><td colSpan={4} className="px-6 py-16 text-center text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest">Audit log is empty</td></tr> : null}
              </tbody>
            </table></div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function AttendanceRow({ record, subjectName, onReportIssue }: { record: AttendanceRecord; subjectName: string; onReportIssue: (record: AttendanceRecord) => void }) {
  return (
    <tr className="border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="px-6 py-4 font-bold text-foreground">{subjectName}</td>
      <td className="px-6 py-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">{new Date(record.timestamp).toLocaleDateString()} &mdash; {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td className="px-6 py-4 text-right"><StatusBadge status={record.status} /></td>
      <td className="px-6 py-4 text-right">
        {record.status === 'disputed' ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-maroon dark:text-golden"><AlertTriangle className="w-3 h-3" />Disputed</span> : <button onClick={() => onReportIssue(record)} className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-maroon dark:hover:text-golden transition-colors border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:border-maroon dark:hover:border-golden">Report Issue</button>}
      </td>
    </tr>
  )
}
