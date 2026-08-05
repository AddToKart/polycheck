'use client'

import Link from 'next/link'
import { useMemo, type ReactNode } from 'react'
import { BookOpen, CheckCircle, ChevronLeft, ChevronRight, Clock, XCircle } from 'lucide-react'
import type { AttendanceRecord, CalendarEvent, Section, Session } from '@polycheck/shared'
import { generateStudentCalendarEvents } from '@polycheck/shared/utils'
import { Button } from '@/components/ui/button'
import { formatDate, formatTime, getDateRangeForWeek, getDayName, getDayNameFull, getWeekDays, isSameDay } from '@/lib/calendar-utils'

interface StudentWeeklyScheduleProps {
  date: Date
  onDateChange: (date: Date) => void
  sections: Section[]
  sessions: Session[]
  records: AttendanceRecord[]
  subjectMap: Map<string, { name: string; code: string }>
}

const STATUS_BORDER: Record<string, string> = {
  present: 'border-l-green-500 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50',
  late: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-950/50',
  absent: 'border-l-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50',
}
const STATUS_TEXT: Record<string, string> = { present: 'text-green-700 dark:text-green-300', late: 'text-yellow-700 dark:text-yellow-300', absent: 'text-red-700 dark:text-red-300' }
const STATUS_ICONS: Record<string, ReactNode> = { present: <CheckCircle className="w-3 h-3 text-green-600" />, late: <Clock className="w-3 h-3 text-yellow-600" />, absent: <XCircle className="w-3 h-3 text-red-600" /> }

export function StudentWeeklySchedule({ date, onDateChange, sections, sessions, records, subjectMap }: StudentWeeklyScheduleProps) {
  const weekDays = useMemo(() => getWeekDays(date), [date])
  const eventsByDay = useMemo(() => {
    const range = getDateRangeForWeek(date)
    const events = generateStudentCalendarEvents(sections, sessions, records, (id) => subjectMap.get(id), formatDate(range.start), formatDate(range.end))
    return new Map(weekDays.map((day) => {
      const dayString = formatDate(day)
      return [dayString, events.filter((event) => event.date === dayString)]
    }))
  }, [date, records, sections, sessions, subjectMap, weekDays])

  const firstDay = weekDays[0]
  const lastDay = weekDays[6]
  const dateLabel = firstDay.getMonth() === lastDay.getMonth()
    ? `${firstDay.toLocaleDateString('en-US', { month: 'long' })} ${firstDay.getDate()} - ${lastDay.getDate()}, ${firstDay.getFullYear()}`
    : `${firstDay.toLocaleDateString('en-US', { month: 'short' })} ${firstDay.getDate()} - ${lastDay.toLocaleDateString('en-US', { month: 'short' })} ${lastDay.getDate()}, ${firstDay.getFullYear()}`

  const moveWeek = (offset: number) => {
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + offset)
    onDateChange(nextDate)
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">My Weekly Schedule</p><h2 className="text-xl font-heading font-bold text-foreground">{dateLabel}</h2></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())} className="text-[10px] font-bold uppercase tracking-widest rounded-none px-4">Today</Button>
          <div className="flex items-center border border-zinc-300 dark:border-zinc-700">
            <Button variant="ghost" size="icon" onClick={() => moveWeek(-7)} className="rounded-none h-8 w-8 border-r border-zinc-300 dark:border-zinc-700"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => moveWeek(7)} className="rounded-none h-8 w-8"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50 dark:bg-zinc-900/20"><BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" /><p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO ENROLLMENTS</p><p className="text-xs uppercase tracking-widest text-zinc-500">Enroll in a subject to see your schedule.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayString = formatDate(day)
            const events = eventsByDay.get(dayString) ?? []
            const isToday = isSameDay(day, new Date())
            return (
              <div key={dayString} className={`rounded-none border ${isToday ? 'border-maroon dark:border-golden border-t-4 border-t-maroon dark:border-t-golden' : 'border-zinc-300 dark:border-zinc-800'} bg-white dark:bg-zinc-900`}>
                <div className={`p-3 border-b border-zinc-200 dark:border-zinc-700 ${isToday ? 'bg-maroon/5 dark:bg-golden/10' : 'bg-zinc-50 dark:bg-zinc-900/50'}`}><p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-maroon dark:text-golden' : 'text-zinc-500'}`}>{getDayName(index)}</p><p className={`text-lg font-heading font-bold mt-0.5 ${isToday ? 'text-maroon dark:text-golden' : 'text-foreground'}`}>{day.getDate()}</p><p className="text-[9px] text-zinc-400 uppercase tracking-wider mt-0.5">{getDayNameFull(index)}</p></div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {events.length === 0 ? <p className="text-[10px] text-zinc-400 text-center py-4">No classes</p> : events.map((event) => <ScheduleEvent key={event.id} event={event} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function ScheduleEvent({ event }: { event: CalendarEvent }) {
  const isGhost = event.type === 'schedule'
  const borderColor = isGhost ? 'border-l-zinc-300 bg-transparent border-dashed' : (event.studentStatus ? STATUS_BORDER[event.studentStatus] || 'border-l-zinc-400 bg-zinc-50 dark:bg-zinc-800/30' : 'border-l-zinc-400 bg-zinc-50 dark:bg-zinc-800/30')
  const textColor = isGhost ? 'text-zinc-300 dark:text-zinc-600' : (event.studentStatus ? STATUS_TEXT[event.studentStatus] || 'text-zinc-500' : 'text-zinc-500')
  const statusIcon = event.studentStatus ? STATUS_ICONS[event.studentStatus] : null
  const statusLabel = event.studentStatus ? event.studentStatus.charAt(0).toUpperCase() + event.studentStatus.slice(1) : null
  return (
    <Link href={isGhost ? '#' : `/student/subjects/${event.sectionId}`} className={`block p-2 border-l-4 transition-colors ${borderColor} ${isGhost ? 'cursor-default' : ''}`}>
      <p className={`text-[10px] font-bold truncate leading-tight ${textColor}`}>{isGhost ? 'No session yet' : event.subjectCode || event.subjectName}</p>
      <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5">{formatTime(event.startTime)} - {formatTime(event.endTime)}</p>
      {event.room ? <p className={`text-[9px] truncate ${isGhost ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>{event.room}</p> : null}
      {event.teacherName ? <p className={`text-[9px] truncate ${isGhost ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>{event.teacherName}</p> : null}
      {!isGhost && statusIcon && statusLabel ? <div className={`flex items-center gap-1 mt-1 text-[9px] font-bold uppercase tracking-widest ${textColor}`}>{statusIcon}{statusLabel}</div> : null}
    </Link>
  )
}
