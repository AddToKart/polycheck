import {
  getMonthDays as sharedGetMonthDays,
  getWeekDays as sharedGetWeekDays,
  getMonthName as sharedGetMonthName,
  getDayName as sharedGetDayName,
  formatDate as sharedFormatDate,
  formatTime as sharedFormatTime,
  isSameDay as sharedIsSameDay,
} from '@polycheck/shared/utils'
import type { Section, Session } from '@polycheck/shared'

export interface CalendarEvent {
  id: string
  title: string
  sectionId: string
  sectionName: string
  subjectName: string
  subjectCode?: string
  room?: string
  startTime: string
  endTime: string
  date: string
  type: 'schedule' | 'session'
  sessionId?: string
  isActive?: boolean
  teacherName?: string
}

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

function dayNameToIndex(day: string): number {
  return DAY_MAP[day] ?? -1
}

export function getMonthDays(year: number, month: number): (Date | null)[][] {
  return sharedGetMonthDays(year, month)
}

export function getWeekDays(date: Date): Date[] {
  return sharedGetWeekDays(date).map((w) => new Date(w.date + 'T00:00:00'))
}

export function getMonthName(month: number): string {
  return sharedGetMonthName(month)
}

export function getDayName(dayIndex: number): string {
  return sharedGetDayName(dayIndex)
}

export function getDayNameFull(dayIndex: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex]
}

export function formatDate(date: Date): string {
  return sharedFormatDate(date)
}

export function formatTime(time: string): string {
  return sharedFormatTime(time)
}

export function isSameDay(a: Date, b: Date): boolean {
  return sharedIsSameDay(a, b)
}

export function getDateRangeForMonth(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
  }
}

export function getDateRangeForWeek(date: Date): { start: Date; end: Date } {
  const days = getWeekDays(date)
  return { start: days[0], end: days[6] }
}

export function getHours(): string[] {
  const hours: string[] = []
  for (let h = 7; h <= 19; h++) {
    hours.push(`${h.toString().padStart(2, '0')}:00`)
  }
  return hours
}

export function timeToPosition(time: string, startHour: number = 7): number {
  const [h, m] = time.split(':').map(Number)
  return (h - startHour) * 60 + m
}

export function generateCalendarEvents(
  sections: { id: string; section: string; room: string; schedule: { day: string; startTime: string; endTime: string; room?: string }[]; subjectId: string; teacherName: string }[],
  sessions: { id: string; sectionId: string; subjectName: string; date: string; startTime: string; endTime: string; room?: string; isActive: boolean; teacherId: string }[],
  getSubject: (id: string) => { name: string; code: string } | undefined,
  startDate: Date,
  endDate: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const sessionMap = new Map<string, boolean>()

  for (const session of sessions) {
    sessionMap.set(`${session.sectionId}_${session.date}`, true)
  }

  for (const section of sections) {
    const subject = getSubject(section.subjectId)
    for (const sched of section.schedule) {
      const dayIndex = dayNameToIndex(sched.day)
      if (dayIndex === -1) continue

      const current = new Date(startDate)
      while (current <= endDate) {
        if (current.getDay() === dayIndex) {
          const dateStr = formatDate(current)
          const existingSession = sessions.find(
            (s) => s.sectionId === section.id && s.date === dateStr
          )
          if (existingSession) {
            events.push({
              id: `sess-${existingSession.id}`,
              title: existingSession.subjectName,
              sectionId: section.id,
              sectionName: `Sec ${section.section}`,
              subjectName: existingSession.subjectName,
              subjectCode: subject?.code,
              room: existingSession.room || sched.room || section.room,
              startTime: existingSession.startTime,
              endTime: existingSession.endTime,
              date: dateStr,
              type: 'session',
              sessionId: existingSession.id,
              isActive: existingSession.isActive,
              teacherName: section.teacherName,
            })
          } else {
            events.push({
              id: `sched-${section.id}-${dateStr}-${sched.startTime}`,
              title: subject?.name ?? section.id,
              sectionId: section.id,
              sectionName: `Sec ${section.section}`,
              subjectName: subject?.name ?? section.id,
              subjectCode: subject?.code,
              room: sched.room || section.room,
              startTime: sched.startTime,
              endTime: sched.endTime,
              date: dateStr,
              type: 'schedule',
              teacherName: section.teacherName,
            })
          }
        }
        current.setDate(current.getDate() + 1)
      }
    }
  }

  for (const session of sessions) {
    const sessionDate = new Date(session.date + 'T00:00:00')
    if (sessionDate < startDate || sessionDate > endDate) continue
    const key = `${session.sectionId}_${session.date}`
    if (sessionMap.get(key)) {
      continue
    }
    const section = sections.find((s) => s.id === session.sectionId)
    const subject = section ? getSubject(section.subjectId) : undefined
    events.push({
      id: `sess-${session.id}`,
      title: session.subjectName,
      sectionId: session.sectionId,
      sectionName: section ? `Sec ${section.section}` : '',
      subjectName: session.subjectName,
      subjectCode: subject?.code,
      room: session.room,
      startTime: session.startTime,
      endTime: session.endTime,
      date: session.date,
      type: 'session',
      sessionId: session.id,
      isActive: session.isActive,
      teacherName: section?.teacherName,
    })
  }

  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.startTime.localeCompare(b.startTime)
  })
}

export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const dateStr = formatDate(date)
  return events.filter((e) => e.date === dateStr)
}
