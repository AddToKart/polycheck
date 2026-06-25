'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, BookOpen, CheckCircle, Clock, XCircle, CalendarDays, MapPin } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { Student, AttendanceRecord } from '@polycheck/shared'
import { generateStudentCalendarEvents } from '@polycheck/shared/utils'
import {
  formatDate,
  formatTime,
  getWeekDays,
  getDayName,
  getDayNameFull,
  isSameDay,
  getDateRangeForWeek,
  getMonthDays,
  getMonthName,
  getDateRangeForMonth,
  getHours,
  timeToPosition,
  getEventsForDate,
} from '@/lib/calendar-utils'
import type { CalendarEvent } from '@polycheck/shared'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sidebar } from '@/components/layout/sidebar'

const STATUS_BORDER_COLORS: Record<string, string> = {
  present: 'border-l-green-500 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50',
  late: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-950/50',
  absent: 'border-l-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50',
}

const STATUS_TEXT_COLORS: Record<string, string> = {
  present: 'text-green-700 dark:text-green-300',
  late: 'text-yellow-700 dark:text-yellow-300',
  absent: 'text-red-700 dark:text-red-300',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  present: <CheckCircle className="w-3 h-3 text-green-600" />,
  late: <Clock className="w-3 h-3 text-yellow-600" />,
  absent: <XCircle className="w-3 h-3 text-red-600" />,
}

function StatusBlock({ event }: { event: CalendarEvent }) {
  if (event.type === 'schedule') return null
  const color = event.studentStatus ? STATUS_TEXT_COLORS[event.studentStatus] || '' : 'text-zinc-400 dark:text-zinc-500'
  const icon = event.studentStatus ? STATUS_ICONS[event.studentStatus] || null : null
  const label = event.studentStatus ? event.studentStatus.charAt(0).toUpperCase() + event.studentStatus.slice(1) : 'Pending'
  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-1 mt-1 text-[9px] font-bold uppercase tracking-widest ${color}`}>
        {icon}
        {label}
      </div>
      {event.isRescheduled && (
        <span className="inline-flex self-start px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider bg-yellow-500 text-black font-bold">
          Time Moved
        </span>
      )}
    </div>
  )
}

function getStudentEventStyle(event: CalendarEvent): string {
  if (event.status === 'moved') return 'border-l-zinc-300 bg-zinc-50/50 dark:bg-zinc-900/10 border-dashed opacity-60'
  if (event.type === 'schedule') return 'border-l-zinc-300 bg-transparent hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 border-dashed'
  if (event.studentStatus === 'present') return 'border-l-green-500 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50'
  if (event.studentStatus === 'late') return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-950/50'
  if (event.studentStatus === 'absent') return 'border-l-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50'
  return 'border-l-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
}

function getStudentEventTextClass(event: CalendarEvent): string {
  if (event.status === 'moved') return 'text-zinc-400 dark:text-zinc-500 line-through font-normal'
  if (event.type === 'schedule') return 'text-zinc-300 dark:text-zinc-600'
  if (event.studentStatus === 'present') return 'text-green-700 dark:text-green-300 font-semibold'
  if (event.studentStatus === 'late') return 'text-yellow-700 dark:text-yellow-300 font-semibold'
  if (event.studentStatus === 'absent') return 'text-red-700 dark:text-red-300 font-semibold'
  return 'text-zinc-500 dark:text-zinc-400'
}

function EventPopoverContent({ event }: { event: CalendarEvent }) {
  const badgeLabel = event.status === 'moved' 
    ? 'Moved' 
    : event.type === 'schedule' 
      ? 'Ghost' 
      : event.studentStatus 
        ? event.studentStatus.charAt(0).toUpperCase() + event.studentStatus.slice(1) 
        : 'Pending'
  
  const badgeVariant = event.status === 'moved' 
    ? 'outline' 
    : event.type === 'schedule' 
      ? 'outline' 
      : event.studentStatus === 'present' 
        ? 'active' 
        : event.studentStatus === 'late' 
          ? 'outline' 
          : event.studentStatus === 'absent' 
            ? 'destructive' 
            : 'inactive'

  const formatRescheduledTo = (to: typeof event.rescheduledTo) => {
    if (!to) return ''
    const dateObj = new Date(to.date + 'T00:00:00')
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
    return `${dayName}, ${to.date} @ ${formatTime(to.startTime)}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className={`font-heading font-bold text-base leading-tight ${event.status === 'moved' || event.type === 'schedule' ? 'text-zinc-400 dark:text-zinc-500' : 'text-foreground'}`}>
          {event.status === 'moved' 
            ? `${event.subjectCode || 'Class'} (MOVED)`
            : event.subjectName || 'No session yet'}
        </h4>
        <Badge variant={badgeVariant as any} className={`shrink-0 text-[9px] uppercase tracking-widest ${event.type === 'schedule' || event.status === 'moved' ? 'opacity-55' : ''}`}>
          {badgeLabel}
        </Badge>
      </div>
      <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-maroon dark:text-golden shrink-0" />
          <span className="font-medium">
            {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-maroon dark:text-golden shrink-0" />
          <span className="font-medium">{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
        </div>
        {event.room && (
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-maroon dark:text-golden shrink-0" />
            <span className="font-medium">{event.room}</span>
          </div>
        )}
        {event.sectionName && (
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-maroon dark:text-golden shrink-0" />
            <span className="font-medium">Section {event.sectionName}</span>
          </div>
        )}
        {event.teacherName && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">Instructor:</span>
            <span className="font-medium">{event.teacherName}</span>
          </div>
        )}
        {event.subjectCode && (
          <div className="pt-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">{event.subjectCode}</span>
          </div>
        )}
      </div>

      {event.status === 'moved' && event.rescheduledTo && (
        <div className="p-2.5 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 text-yellow-800 dark:text-yellow-300 text-xs rounded-none">
          <p className="font-bold uppercase tracking-wider text-[9px] mb-1">Class Rescheduled</p>
          <p className="text-[10px]">Moved to:</p>
          <p className="font-semibold text-[11px] mt-0.5">
            {formatRescheduledTo(event.rescheduledTo)}
          </p>
        </div>
      )}

      {event.isRescheduled && (
        <div className="p-2.5 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 text-yellow-800 dark:text-yellow-300 text-xs rounded-none">
          <p className="font-bold uppercase tracking-wider text-[9px] mb-0.5">Rescheduled Session</p>
          <p className="text-[10px]">This is a rescheduled make-up class meeting.</p>
        </div>
      )}

      {event.type === 'session' && (
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <Button asChild variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase tracking-widest rounded-none">
            <Link href={`/student/subjects/${event.sectionId}`}>View Subject Details</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function MonthView({
  year, month, events,
}: {
  year: number; month: number; events: CalendarEvent[]
}) {
  const weeks = useMemo(() => getMonthDays(year, month), [year, month])
  const today = new Date()

  return (
    <div className="overflow-auto border border-zinc-300 dark:border-zinc-700 md:flex-1">
      <div className="grid grid-cols-7 border-b border-zinc-300 dark:border-zinc-700">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-2 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-center border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
            {getDayName(i)}
          </div>
        ))}
      </div>
      <div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0 border-zinc-200 dark:border-zinc-700">
            {week.map((day, di) => {
              if (!day) {
                return <div key={`e-${di}`} className="min-h-[100px] bg-zinc-50/50 dark:bg-zinc-900/20 border-r last:border-r-0 border-zinc-200 dark:border-zinc-700" />
              }
              const dayEvents = events.filter((e) => e.date === formatDate(day))
              const isToday = isSameDay(day, today)
              const isCurrentMonth = day.getMonth() === month

              return (
                <div
                  key={di}
                  className={`min-h-[100px] p-1.5 border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 transition-colors ${
                    isCurrentMonth ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50/50 dark:bg-zinc-900/20'
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold mb-1 ${
                    isToday
                      ? 'bg-maroon dark:bg-golden text-white dark:text-maroon-dark'
                      : isCurrentMonth
                        ? 'text-zinc-700 dark:text-zinc-300'
                        : 'text-zinc-400 dark:text-zinc-600'
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <Popover key={ev.id}>
                        <PopoverTrigger asChild>
                          <button className={`w-full text-left px-1.5 py-0.5 text-[10px] font-medium truncate border-l-2 transition-colors ${getStudentEventStyle(ev)}`}>
                            <span className={getStudentEventTextClass(ev)}>
                              {formatTime(ev.startTime)}
                            </span>
                            <span className={`ml-1 font-semibold ${ev.status === 'moved' ? 'text-zinc-400 dark:text-zinc-500 line-through' : ev.type === 'schedule' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-700 dark:text-zinc-300'}`}>
                              {ev.status === 'moved'
                                ? `${ev.subjectCode || 'Class'} (MOVED)`
                                : ev.type === 'schedule' ? 'No session' : ev.subjectCode || ev.subjectName}
                            </span>
                            {ev.isRescheduled && (
                              <span className="ml-1 inline-flex px-1 text-[8px] font-extrabold uppercase bg-yellow-500 text-black leading-tight">
                                Moved
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72" align="start">
                          <EventPopoverContent event={ev} />
                        </PopoverContent>
                      </Popover>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] text-zinc-400 font-medium px-1.5">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekView({ date, events }: { date: Date; events: CalendarEvent[] }) {
  const weekDays = useMemo(() => getWeekDays(date), [date])
  const hours = useMemo(() => getHours(), [])
  const today = new Date()
  const startHour = 7

  const weekDayEvents = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of weekDays) {
      map.set(formatDate(day), getEventsForDate(events, day))
    }
    return map
  }, [weekDays, events])

  return (
    <div className="overflow-auto border border-zinc-300 dark:border-zinc-700 md:flex-1">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-300 dark:border-zinc-700 sticky top-0 z-20 bg-zinc-50 dark:bg-zinc-900">
          <div className="border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900" />
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today)
            return (
              <div key={i} className={`px-2 py-3 text-center border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 ${
                isToday ? 'bg-maroon/5 dark:bg-golden/10' : 'bg-zinc-50 dark:bg-zinc-900'
              }`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-maroon dark:text-golden' : 'text-zinc-500'}`}>
                  {getDayName(i)}
                </p>
                <p className={`text-xl font-heading font-bold mt-0.5 ${isToday ? 'text-maroon dark:text-golden' : 'text-foreground'}`}>
                  {day.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        <div className="relative grid grid-cols-[60px_repeat(7,1fr)]" style={{ height: `${12 * 90}px` }}>
          <div className="col-start-1 col-span-1">
            {hours.map((h, index) => (
              <div key={h} className="border-b border-zinc-200 dark:border-zinc-700 pr-2 flex items-start justify-end" style={{ height: '90px' }}>
                <span className={`text-[10px] font-bold text-zinc-400 ${index === 0 ? 'mt-1' : '-mt-2'}`}>{formatTime(h)}</span>
              </div>
            ))}
          </div>
          {weekDays.map((day, di) => {
            const ds = formatDate(day)
            const dayEvs = weekDayEvents.get(ds) || []

            // Sort by start time then by end time
            const sortedEvs = [...dayEvs].sort((a, b) => a.startTime.localeCompare(b.startTime))

            // Cluster events into connected components of overlapping events
            const clusters: CalendarEvent[][] = []
            let currentCluster: CalendarEvent[] = []
            let clusterMaxEnd = ''

            for (const ev of sortedEvs) {
              if (currentCluster.length === 0) {
                currentCluster.push(ev)
                clusterMaxEnd = ev.endTime
              } else if (ev.startTime < clusterMaxEnd) {
                // Overlaps with the current cluster
                currentCluster.push(ev)
                if (ev.endTime > clusterMaxEnd) {
                  clusterMaxEnd = ev.endTime
                }
              } else {
                // Does not overlap with the current cluster; start a new one
                clusters.push(currentCluster)
                currentCluster = [ev]
                clusterMaxEnd = ev.endTime
              }
            }
            if (currentCluster.length > 0) {
              clusters.push(currentCluster)
            }

            const eventLayout = new Map<string, { colIndex: number; totalCols: number }>()

            for (const cluster of clusters) {
              const columns: CalendarEvent[][] = []
              for (const ev of cluster) {
                let placed = false
                for (const col of columns) {
                  // Check if ev overlaps with any event in this column
                  const hasOverlap = col.some(
                    (other) =>
                      (ev.startTime >= other.startTime && ev.startTime < other.endTime) ||
                      (other.startTime >= ev.startTime && other.startTime < ev.endTime)
                  )
                  if (!hasOverlap) {
                    col.push(ev)
                    placed = true
                    break
                  }
                }
                if (!placed) {
                  columns.push([ev])
                }
              }

              columns.forEach((col, colIndex) => {
                for (const ev of col) {
                  eventLayout.set(ev.id, { colIndex, totalCols: columns.length })
                }
              })
            }

            return (
              <div key={di} className="relative border-r last:border-r-0 border-zinc-200 dark:border-zinc-700">
                {hours.map((h) => (
                  <div key={h} className="border-b border-zinc-200/50 dark:border-zinc-700/50" style={{ height: '90px' }} />
                ))}
                {sortedEvs.map((ev) => {
                  const top = timeToPosition(ev.startTime, startHour) * 1.5
                  const duration = timeToPosition(ev.endTime, startHour) - timeToPosition(ev.startTime, startHour)
                  const height = Math.max(duration * 1.5, 24)

                  const layout = eventLayout.get(ev.id) || { colIndex: 0, totalCols: 1 }
                  const widthPct = 100 / layout.totalCols
                  const leftPct = layout.colIndex * widthPct

                  return (
                    <Popover key={ev.id}>
                      <PopoverTrigger asChild>
                        <button
                          className={`absolute px-1.5 py-1 text-left overflow-hidden border-l-2 transition-colors ${getStudentEventStyle(ev)}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            left: `${leftPct}%`,
                            width: `calc(${widthPct}% - 1px)`,
                            zIndex: 10
                          }}
                        >
                          <p className={`text-[10px] font-bold truncate leading-tight ${getStudentEventTextClass(ev)}`}>
                            {ev.status === 'moved'
                              ? `${ev.subjectCode || 'Class'} (MOVED)`
                              : ev.type === 'schedule' ? 'No session' : ev.subjectCode || ev.subjectName}
                            {ev.isRescheduled && (
                              <span className="ml-1 inline-flex px-1 text-[8px] font-extrabold uppercase bg-yellow-500 text-black leading-tight">
                                Moved
                              </span>
                            )}
                          </p>
                          <p className="text-[8px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {formatTime(ev.startTime)} - {formatTime(ev.endTime)}
                          </p>
                          {ev.room && (
                            <p className={`text-[8px] truncate ${(ev.type === 'schedule' || ev.status === 'moved') ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>{ev.room}</p>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <EventPopoverContent event={ev} />
                      </PopoverContent>
                    </Popover>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StudentScheduleContent() {
  const router = useRouter()
  const [user, setUser] = useState<Student | null>(null)
  const [view, setView] = useState('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth())
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') {
      router.push('/')
      return
    }
    setUser(cu as Student)
    if (cu.studentId) {
      setRecords(api.getAttendanceForStudent(cu.id))
    }
  }, [router])

  const handleLogout = useCallback(() => {
    api.logout()
    router.push('/')
  }, [router])

  const studentId = user?.id ?? ''

  const sections = useMemo(() => {
    if (!user) return []
    return api.getStudentSections(user.id)
  }, [user])

  const sessions = useMemo(() => {
    return api.getSessions()
  }, [])

  const events = useMemo(() => {
    if (sections.length === 0 || !studentId) return []
    const range = view === 'month'
      ? getDateRangeForMonth(currentYear, currentMonth)
      : getDateRangeForWeek(currentDate)
    return generateStudentCalendarEvents(
      sections,
      sessions,
      records,
      (id) => {
        const subj = api.getSubject(id)
        return subj ? { name: subj.name, code: subj.code } : undefined
      },
      formatDate(range.start),
      formatDate(range.end),
    )
  }, [sections, sessions, records, currentDate, currentYear, currentMonth, view, studentId])

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const today = new Date()


  const goToPrev = useCallback(() => {
    if (view === 'month') {
      if (currentMonth === 0) {
        setCurrentYear((y) => y - 1)
        setCurrentMonth(11)
      } else {
        setCurrentMonth((m) => m - 1)
      }
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 7)
      setCurrentDate(d)
    }
  }, [view, currentMonth, currentDate])

  const goToNext = useCallback(() => {
    if (view === 'month') {
      if (currentMonth === 11) {
        setCurrentYear((y) => y + 1)
        setCurrentMonth(0)
      } else {
        setCurrentMonth((m) => m + 1)
      }
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + 7)
      setCurrentDate(d)
    }
  }, [view, currentMonth, currentDate])

  const goToToday = useCallback(() => {
    const now = new Date()
    setCurrentDate(now)
    setCurrentYear(now.getFullYear())
    setCurrentMonth(now.getMonth())
  }, [])

  const headerLabel = useMemo(() => {
    if (view === 'month') {
      return `${getMonthName(currentMonth)} ${currentYear}`
    }
    const start = weekDays[0]
    const end = weekDays[6]
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`
    }
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${start.getFullYear()}`
  }, [view, currentMonth, currentYear, weekDays])

  if (!user) return null

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon">
      <Sidebar user={{ ...user, email: user.email || '' } as any} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col">
        <div className="p-8 md:p-12 max-w-6xl w-full mx-auto flex-1 flex flex-col md:overflow-hidden min-h-0">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6 shrink-0">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">My Schedule</p>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground tracking-tight">{headerLabel}</h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shrink-0">
            <Tabs value={view} onValueChange={setView}>
              <TabsList>
                <TabsTrigger value="month">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Month
                </TabsTrigger>
                <TabsTrigger value="week">
                  <Calendar className="w-4 h-4 mr-2" />
                  Week
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="text-[10px] font-bold uppercase tracking-widest rounded-none px-4"
              >
                Today
              </Button>
              <div className="flex items-center border border-zinc-300 dark:border-zinc-700">
                <Button variant="ghost" size="icon" onClick={goToPrev} className="rounded-none h-8 w-8 border-r border-zinc-300 dark:border-zinc-700">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goToNext} className="rounded-none h-8 w-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
            {sections.length === 0 ? (
              <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50 dark:bg-zinc-900/20 shrink-0">
                <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO ENROLLMENTS</p>
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  You are not enrolled in any subjects. Contact your instructor for the enrollment code.
                </p>
              </div>
            ) : view === 'month' ? (
              <MonthView year={currentYear} month={currentMonth} events={events} />
            ) : (
              <WeekView date={currentDate} events={events} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6 mt-8 px-1 border-t border-zinc-200 dark:border-zinc-800 pt-6 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-l-4 border-zinc-300 bg-transparent border-dashed" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Class scheduled (no session yet)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-l-4 border-green-500 bg-green-50" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-l-4 border-yellow-500 bg-yellow-50" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-l-4 border-red-500 bg-red-50" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Absent</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function StudentSchedulePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-background text-zinc-500 uppercase tracking-widest text-xs font-bold">Loading schedule...</div>}>
      <StudentScheduleContent />
    </Suspense>
  )
}
