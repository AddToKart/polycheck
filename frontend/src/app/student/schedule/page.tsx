'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, BookOpen, CheckCircle, Clock, XCircle } from 'lucide-react'
import { api } from '@/lib/mock-api'
import type { Student, AttendanceRecord } from '@polycheck/shared'
import { generateStudentCalendarEvents, formatTime, getWeekDays, getDayName, getDayNameFull, isSameDay, getDateRangeForWeek } from '@polycheck/shared/utils'
import type { CalendarEvent } from '@polycheck/shared'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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
    <div className={`flex items-center gap-1 mt-1 text-[9px] font-bold uppercase tracking-widest ${color}`}>
      {icon}
      {label}
    </div>
  )
}

export default function StudentSchedulePage() {
  const router = useRouter()
  const [user, setUser] = useState<Student | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
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
    const range = getDateRangeForWeek(currentDate)
    return generateStudentCalendarEvents(
      sections,
      sessions,
      records,
      (id) => {
        const subj = api.getSubject(id)
        return subj ? { name: subj.name, code: subj.code } : undefined
      },
      range.start,
      range.end,
    )
  }, [sections, sessions, records, currentDate, studentId])

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const today = new Date()

  const weekDayEvents = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of weekDays) {
      map.set(day.date, events.filter((e) => e.date === day.date))
    }
    return map
  }, [weekDays, events])

  const goToPrevWeek = useCallback(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }, [currentDate])

  const goToNextWeek = useCallback(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }, [currentDate])

  const goToToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  const headerLabel = useMemo(() => {
    const start = new Date(weekDays[0].date + 'T00:00:00')
    const end = new Date(weekDays[6].date + 'T00:00:00')
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`
    }
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${start.getFullYear()}`
  }, [weekDays])

  if (!user) return null

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between bg-maroon dark:bg-golden text-white dark:text-maroon-dark">
        <div>
          <Link href="/student/dashboard">
            <h1 className="text-2xl font-heading font-bold tracking-tight text-golden dark:text-maroon-dark">Polycheck</h1>
          </Link>
          <p className="text-[10px] uppercase tracking-widest text-white/70 dark:text-maroon-dark/80 mt-1">Student</p>
        </div>
        <div className="flex items-center gap-2">
          <img src="/pup-logo.png" alt="PUP Logo" className="w-8 h-8 shrink-0 object-contain" />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="flex flex-col">
          <Link
            href="/student/dashboard"
            className="flex items-center gap-4 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all border-l-4 border-transparent text-zinc-500 hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <Calendar className="w-5 h-5 shrink-0" strokeWidth={1.5} />
            Dashboard
          </Link>
          <Link
            href="/student/schedule"
            className="flex items-center gap-4 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all border-l-4 border-maroon dark:border-golden bg-zinc-100 dark:bg-zinc-900 text-maroon dark:text-golden"
          >
            <Calendar className="w-5 h-5 shrink-0 text-maroon dark:text-golden" strokeWidth={2.5} />
            My Schedule
          </Link>
        </div>
      </nav>
      <div className="p-6 border-t border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-maroon flex items-center justify-center text-golden font-heading font-bold text-sm shrink-0 border border-maroon-dark">
            {user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground truncate">{user.fullName}</p>
            <p className="text-xs text-zinc-500 truncate">{user.studentId}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:text-white hover:bg-maroon hover:border-maroon transition-colors"
          onClick={handleLogout}
        >
          Disconnect
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background selection:bg-golden selection:text-maroon">
      <aside className="hidden md:flex w-64 bg-background border-r border-zinc-300 dark:border-zinc-800 flex flex-col shrink-0 h-dvh sticky top-0 overflow-hidden">
        {sidebarContent}
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 md:p-12 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">My Schedule</p>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground tracking-tight">{headerLabel}</h1>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="text-[10px] font-bold uppercase tracking-widest rounded-none px-4"
              >
                Today
              </Button>
              <div className="flex items-center border border-zinc-300 dark:border-zinc-700">
                <Button variant="ghost" size="icon" onClick={goToPrevWeek} className="rounded-none h-8 w-8 border-r border-zinc-300 dark:border-zinc-700">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={goToNextWeek} className="rounded-none h-8 w-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 p-16 text-center bg-zinc-50 dark:bg-zinc-900/20">
              <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
              <p className="text-xl font-heading font-bold text-zinc-400 mb-2">NO ENROLLMENTS</p>
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                You are not enrolled in any subjects. Contact your instructor for the enrollment code.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {weekDays.map((day, i) => {
                const ds = day.date
                const dayEvs = weekDayEvents.get(ds) || []
                const isT = isSameDay(new Date(day.date + 'T00:00:00'), today)
                return (
                  <Card key={i} className={`rounded-none border ${isT ? 'border-maroon dark:border-golden border-t-4 border-t-maroon dark:border-t-golden' : 'border-zinc-300 dark:border-zinc-800'} bg-white dark:bg-zinc-900`}>
                    <div className={`p-3 border-b border-zinc-200 dark:border-zinc-700 ${isT ? 'bg-maroon/5 dark:bg-golden/10' : 'bg-zinc-50 dark:bg-zinc-900/50'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${isT ? 'text-maroon dark:text-golden' : 'text-zinc-500'}`}>
                        {getDayName(i)}
                      </p>
                      <p className={`text-lg font-heading font-bold mt-0.5 ${isT ? 'text-maroon dark:text-golden' : 'text-foreground'}`}>
                        {new Date(day.date + 'T00:00:00').getDate()}
                      </p>
                      <p className="text-[9px] text-zinc-400 uppercase tracking-wider mt-0.5">
                        {getDayNameFull(i)}
                      </p>
                    </div>
                    <div className="p-2 space-y-2 min-h-[120px]">
                      {dayEvs.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 text-center py-4">No classes</p>
                      ) : (
                        dayEvs.map((ev) => {
                          const isGhost = ev.type === 'schedule'
                          const borderColor = isGhost ? 'border-l-zinc-300 bg-transparent border-dashed' : (ev.studentStatus ? STATUS_BORDER_COLORS[ev.studentStatus] || 'border-l-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50' : 'border-l-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50')
                          const textColor = isGhost ? 'text-zinc-300 dark:text-zinc-600' : (ev.studentStatus ? STATUS_TEXT_COLORS[ev.studentStatus] || 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-500 dark:text-zinc-400')
                          return (
                            <Link
                              key={ev.id}
                              href={isGhost ? '#' : `/student/subjects/${ev.sectionId}`}
                              className={`block p-2 border-l-4 transition-colors ${borderColor} ${isGhost ? 'cursor-default' : ''}`}
                            >
                              <p className={`text-[10px] font-bold truncate leading-tight ${textColor}`}>
                                {isGhost ? '(class)' : ev.subjectCode || ev.subjectName}
                              </p>
                              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {formatTime(ev.startTime)} - {formatTime(ev.endTime)}
                              </p>
                              {ev.room && (
                                <p className={`text-[9px] truncate ${isGhost ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>{ev.room}</p>
                              )}
                              {ev.teacherName && (
                                <p className={`text-[9px] truncate ${isGhost ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>{ev.teacherName}</p>
                              )}
                              {!isGhost && <StatusBlock event={ev} />}
                            </Link>
                          )
                        })
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
