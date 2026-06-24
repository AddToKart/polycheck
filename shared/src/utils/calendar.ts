import type { CalendarEvent } from '../types/api'
import type { DayOfWeek, Section } from '../types/subject'
import type { Session } from '../types/session'
import type { AttendanceRecord } from '../types/attendance'

export interface WeekDay {
  day: string
  date: string
  isToday: boolean
  isCurrentMonth: boolean
}

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const DAY_OF_WEEK_MAP: Record<DayOfWeek, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${pad(hour12)}:${pad(m)} ${period}`
}

export function getDayName(dayIndex: number): string {
  return DAY_NAMES_SHORT[dayIndex] ?? ''
}

export function getMonthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex] ?? ''
}

export function getWeekDays(date: Date): WeekDay[] {
  const current = new Date(date)
  const dayOfWeek = current.getDay()
  const sunday = new Date(current)
  sunday.setDate(current.getDate() - dayOfWeek)

  const today = new Date()
  const todayStr = formatDate(today)
  const month = date.getMonth()

  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    const dateStr = formatDate(d)
    days.push({
      day: getDayName(d.getDay()),
      date: dateStr,
      isToday: dateStr === todayStr,
      isCurrentMonth: d.getMonth() === month,
    })
  }
  return days
}

export function getMonthDays(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = []

  for (let p = 0; p < startPad; p++) {
    week.push(null)
  }

  for (let d = 1; d <= totalDays; d++) {
    week.push(new Date(year, month, d))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  while (week.length < 7) {
    week.push(null)
  }
  if (week.length > 0) {
    weeks.push(week)
  }

  return weeks
}

export function getDateRangeForMonth(year: number, month: number): { start: string; end: string } {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  return { start: formatDate(first), end: formatDate(last) }
}

export function getWeeksInMonth(year: number, month: number): number {
  return getMonthDays(year, month).length
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function generateCalendarEvents(
  sections: Section[],
  sessions: Session[],
  startDate: string,
  endDate: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T23:59:59')

  const sessionMap = new Map<string, Session>()
  for (const s of sessions) {
    const key = `${s.sectionId}|${s.date}`
    sessionMap.set(key, s)
  }

  for (const section of sections) {
    for (const schedule of section.schedule) {
      const dayIndex = DAY_OF_WEEK_MAP[schedule.day]
      if (dayIndex === undefined) continue

      const cursor = new Date(start)
      while (cursor <= end) {
        if (cursor.getDay() === dayIndex) {
          const dateStr = formatDate(cursor)
          const sessionKey = `${section.id}|${dateStr}`
          const existing = sessionMap.get(sessionKey)

          if (existing) {
            events.push({
              id: existing.id,
              title: existing.subjectName,
              date: dateStr,
              startTime: existing.startTime,
              endTime: existing.endTime,
              room: existing.room,
              sectionId: existing.sectionId,
              subjectName: existing.subjectName,
              sectionName: section.section,
              type: 'session',
              status: existing.isActive ? 'active' : 'inactive',
            })
          } else {
            events.push({
              id: `schedule-${section.id}-${dateStr}-${schedule.day}`,
              title: section.section ? `${section.section}` : '',
              date: dateStr,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              room: schedule.room,
              sectionId: section.id,
              subjectName: section.section || '',
              sectionName: section.section,
              type: 'schedule',
            })
          }
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
  }

  events.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date)
    if (dateCmp !== 0) return dateCmp
    return a.startTime.localeCompare(b.startTime)
  })

  return events
}

export function generateStudentCalendarEvents(
  sections: Section[],
  sessions: Session[],
  attendanceRecords: AttendanceRecord[],
  getSubject: (subjectId: string) => { name: string; code: string } | undefined,
  startDate: string,
  endDate: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T23:59:59')

  const attendanceBySession = new Map<string, AttendanceRecord>()
  for (const r of attendanceRecords) {
    attendanceBySession.set(r.sessionId, r)
  }

  const sessionSectionMap = new Map<string, Section>()
  for (const s of sections) {
    for (const sess of sessions) {
      if (sess.sectionId === s.id) sessionSectionMap.set(sess.id, s)
    }
  }

  for (const session of sessions) {
    const sessionDate = new Date(session.date + 'T00:00:00')
    if (sessionDate < start || sessionDate > end) continue
    const section = sections.find((s) => s.id === session.sectionId)
    const subject = section ? getSubject(section.subjectId) : undefined
    const record = attendanceBySession.get(session.id)

    events.push({
      id: session.id,
      title: session.subjectName,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      room: session.room,
      sectionId: session.sectionId,
      subjectName: session.subjectName,
      subjectCode: subject?.code,
      sectionName: section?.section ?? '',
      type: 'session',
      status: session.isActive ? 'active' : 'inactive',
      studentStatus: record ? (record.status === 'present' ? 'present' : record.status === 'late' ? 'late' : record.status === 'absent' ? 'absent' : undefined) : (!session.isActive ? 'absent' : undefined),
      teacherName: section?.teacherName,
    })
  }

  for (const section of sections) {
    for (const schedule of section.schedule) {
      const dayIndex = DAY_OF_WEEK_MAP[schedule.day]
      if (dayIndex === undefined) continue

      const cursor = new Date(start)
      while (cursor <= end) {
        if (cursor.getDay() === dayIndex) {
          const dateStr = formatDate(cursor)
          const hasSession = sessions.some((s) => s.sectionId === section.id && s.date === dateStr)
          if (!hasSession) {
            events.push({
              id: `ghost-${section.id}-${dateStr}-${schedule.day}`,
              title: '',
              date: dateStr,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              room: schedule.room,
              sectionId: section.id,
              subjectName: '',
              sectionName: section.section,
              type: 'schedule',
            })
          }
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
  }

  events.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date)
    if (dateCmp !== 0) return dateCmp
    return a.startTime.localeCompare(b.startTime)
  })

  return events
}

export function getDayNameFull(dayIndex: number): string {
  return DAY_NAMES_FULL[dayIndex] ?? ''
}

export function getDateRangeForWeek(date: Date): { start: string; end: string } {
  const weekDays = getWeekDays(date)
  return { start: weekDays[0].date, end: weekDays[6].date }
}
