'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Calendar, Clock, MapPin, User as UserIcon } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { User } from '@polycheck/shared'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  getMonthDays,
  getWeekDays,
  getMonthName,
  getDayName,
  formatDate,
  formatTime,
  isSameDay,
  getDateRangeForMonth,
  getHours,
  timeToPosition,
  generateCalendarEvents,
  getEventsForDate,
  type CalendarEvent,
} from '@/lib/calendar-utils'

const STATUS_COLORS: Record<string, string> = {
  schedule: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50',
  session_active: 'border-l-green-500 bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50',
  session_completed: 'border-l-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
}

function getEventStyle(event: CalendarEvent): string {
  if (event.type === 'schedule') return STATUS_COLORS.schedule
  if (event.isActive) return STATUS_COLORS.session_active
  return STATUS_COLORS.session_completed
}

const BADGE_CONFIG: Record<string, { label: string; variant: string }> = {
  schedule: { label: 'Scheduled', variant: 'outline' },
  session_active: { label: 'Active', variant: 'active' },
  session_completed: { label: 'Completed', variant: 'inactive' },
}

function getEventBadge(event: CalendarEvent): { label: string; variant: string } {
  if (event.type === 'schedule') return BADGE_CONFIG.schedule
  if (event.isActive) return BADGE_CONFIG.session_active
  return BADGE_CONFIG.session_completed
}

function EventPopoverContent({ event }: { event: CalendarEvent }) {
  const badge = getEventBadge(event)
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-heading font-bold text-base text-foreground leading-tight">
          {event.subjectName}
        </h4>
        <Badge variant={badge.variant as any} className="shrink-0 text-[9px] uppercase tracking-widest">
          {badge.label}
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
        <div className="flex items-center gap-2">
          <UserIcon className="w-3.5 h-3.5 text-maroon dark:text-golden shrink-0" />
          <span className="font-medium">{event.sectionName}</span>
        </div>
        {event.subjectCode && (
          <div className="pt-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">{event.subjectCode}</span>
          </div>
        )}
      </div>
      {event.type === 'session' && event.sessionId && (
        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <Button asChild variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase tracking-widest rounded-none">
            <Link href={`/faculty/sessions/${event.sessionId}`}>View Session Details</Link>
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
    <div className="border border-zinc-300 dark:border-zinc-700">
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
              const dayEvents = getEventsForDate(events, day)
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
                          <button className={`w-full text-left px-1.5 py-0.5 text-[10px] font-medium truncate border-l-2 transition-colors ${getEventStyle(ev)}`}>
                            <span className={
                              ev.type === 'schedule' ? 'text-blue-700 dark:text-blue-300' :
                              ev.isActive ? 'text-green-700 dark:text-green-300' :
                              'text-zinc-500 dark:text-zinc-400'
                            }>
                              {formatTime(ev.startTime)}
                            </span>
                            <span className="ml-1 text-zinc-700 dark:text-zinc-300 font-semibold">{ev.subjectCode || ev.subjectName}</span>
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
    <div className="overflow-auto border border-zinc-300 dark:border-zinc-700">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-300 dark:border-zinc-700">
          <div className="border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50" />
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today)
            return (
              <div key={i} className={`px-2 py-3 text-center border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 ${
                isToday ? 'bg-maroon/5 dark:bg-golden/10' : 'bg-zinc-50 dark:bg-zinc-900/50'
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
            {hours.map((h) => (
              <div key={h} className="border-b border-zinc-200 dark:border-zinc-700 pr-2 flex items-start justify-end" style={{ height: '90px' }}>
                <span className="text-[10px] font-bold text-zinc-400 -mt-2">{formatTime(h)}</span>
              </div>
            ))}
          </div>
          {weekDays.map((day, di) => {
            const ds = formatDate(day)
            const dayEvs = weekDayEvents.get(ds) || []
            return (
              <div key={di} className="relative border-r last:border-r-0 border-zinc-200 dark:border-zinc-700">
                {hours.map((h) => (
                  <div key={h} className="border-b border-zinc-200/50 dark:border-zinc-700/50" style={{ height: '90px' }} />
                ))}
                {dayEvs.map((ev) => {
                  const top = timeToPosition(ev.startTime, startHour) * 1.5
                  const duration = timeToPosition(ev.endTime, startHour) - timeToPosition(ev.startTime, startHour)
                  const height = Math.max(duration * 1.5, 24)
                  return (
                    <Popover key={ev.id}>
                      <PopoverTrigger asChild>
                        <button
                          className={`absolute left-0.5 right-0.5 px-1.5 py-1 text-left overflow-hidden border-l-2 transition-colors ${getEventStyle(ev)}`}
                          style={{ top: `${top}px`, height: `${height}px`, zIndex: 10 }}
                        >
                          <p className={`text-[10px] font-bold truncate leading-tight ${
                            ev.type === 'schedule' ? 'text-blue-700 dark:text-blue-300' :
                            ev.isActive ? 'text-green-700 dark:text-green-300' :
                            'text-zinc-500 dark:text-zinc-400'
                          }`}>
                            {ev.subjectCode || ev.subjectName}
                          </p>
                          <p className="text-[8px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {formatTime(ev.startTime)} - {formatTime(ev.endTime)}
                          </p>
                          {ev.room && (
                            <p className="text-[8px] text-zinc-400 dark:text-zinc-500 truncate">{ev.room}</p>
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

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-6 mt-6 px-1">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Scheduled Class</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 border-l-4 border-green-500 bg-green-50 dark:bg-green-950/30" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Active Session</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 border-l-4 border-zinc-400 bg-zinc-50 dark:bg-zinc-800/30" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Completed Session</span>
      </div>
    </div>
  )
}

export default function FacultySchedulePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [view, setView] = useState('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth())

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || (cu.role !== 'teacher' && cu.role !== 'super_admin')) {
      router.push('/')
      return
    }
    setUser(cu)
  }, [router])

  const handleLogout = useCallback(() => {
    api.logout()
    router.push('/')
  }, [router])

  const events = useMemo(() => {
    if (!user) return []
    const sections = api.getSections().filter((s) => s.teacherId === user.id)
    const allSessions = api.getSessions()
    const teacherSectionIds = new Set(sections.map((s) => s.id))
    const teacherSessions = allSessions.filter((s) => teacherSectionIds.has(s.sectionId))
    const range = getDateRangeForMonth(currentYear, currentMonth)
    return generateCalendarEvents(
      sections,
      teacherSessions,
      (id) => {
        const subj = api.getSubject(id)
        return subj ? { name: subj.name, code: subj.code } : undefined
      },
      range.start,
      range.end,
    )
  }, [user, currentYear, currentMonth])

  const goToPrev = useCallback(() => {
    if (view === 'month') {
      if (currentMonth === 0) { setCurrentYear((y) => y - 1); setCurrentMonth(11) }
      else { setCurrentMonth((m) => m - 1) }
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 7)
      setCurrentDate(d)
    }
  }, [view, currentMonth, currentDate])

  const goToNext = useCallback(() => {
    if (view === 'month') {
      if (currentMonth === 11) { setCurrentYear((y) => y + 1); setCurrentMonth(0) }
      else { setCurrentMonth((m) => m + 1) }
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
    if (view === 'month') return `${getMonthName(currentMonth)} ${currentYear}`
    const days = getWeekDays(currentDate)
    const start = days[0]
    const end = days[6]
    if (start.getMonth() === end.getMonth()) {
      return `${getMonthName(start.getMonth())} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`
    }
    return `${getMonthName(start.getMonth())} ${start.getDate()} - ${getMonthName(end.getMonth())} ${end.getDate()}, ${start.getFullYear()}`
  }, [view, currentMonth, currentYear, currentDate])

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 md:p-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Faculty Schedule</p>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground tracking-tight">{headerLabel}</h1>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-3">
              <Button asChild className="rounded-none bg-maroon text-white hover:bg-maroon-dark uppercase tracking-widest font-bold text-xs h-10 px-5">
                <Link href="/faculty/sessions/create">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Session
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
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

            <div className="flex items-center gap-2">
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

          {view === 'month' ? (
            events.length === 0 ? (
              <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50 dark:bg-zinc-900/20">
                <CalendarDays className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO SCHEDULED CLASSES</p>
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-6">No classes or sessions scheduled for this month.</p>
                <Button asChild variant="outline" className="rounded-none text-[10px] font-bold uppercase tracking-widest">
                  <Link href="/faculty/sessions/create"><Plus className="w-3.5 h-3.5 mr-1.5" />Create a Session</Link>
                </Button>
              </div>
            ) : (
              <MonthView year={currentYear} month={currentMonth} events={events} />
            )
          ) : (
            events.length === 0 ? (
              <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50 dark:bg-zinc-900/20">
                <Calendar className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO SCHEDULED CLASSES</p>
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-6">No classes scheduled for this week.</p>
                <Button asChild variant="outline" className="rounded-none text-[10px] font-bold uppercase tracking-widest">
                  <Link href="/faculty/sessions/create"><Plus className="w-3.5 h-3.5 mr-1.5" />Create a Session</Link>
                </Button>
              </div>
            ) : (
              <WeekView date={currentDate} events={events} />
            )
          )}

          <Legend />
        </div>
      </main>
    </div>
  )
}
