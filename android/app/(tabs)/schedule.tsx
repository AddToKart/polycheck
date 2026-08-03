import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { formatCampusDate, type AttendanceRecord, type CalendarEvent, type Section, type Session, type Subject } from '@polycheck/shared'
import { generateStudentCalendarEvents } from '@polycheck/shared/utils'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusIconButton, CampusEmptyState, SectionHeading } from '../../components/CampusPrimitives'
import {
  StudentCalendarEventList,
  StudentCalendarEventModal,
  StudentMonthCalendar,
  StudentWeekCalendar,
} from '../../components/StudentCalendarViews'

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const formatDate = (date: Date) => formatCampusDate(date)
const getMonthName = (month: number) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month]

export default function ScheduleScreen() {
  const { isDark, toggle } = useTheme()
  const user = api.getCurrentUser()
  const studentId = user && 'studentId' in user ? user.id : null

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(formatDate(new Date()))
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const [sections, setSections] = useState<Section[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [subjects, setSubjects] = useState<Record<string, Subject>>({})

  useFocusEffect(useCallback(() => {
    if (!studentId) return
    let active = true
    void Promise.all([api.getStudentSections(studentId), api.getSessions(), api.getMyAttendance(studentId), api.getSubjects()])
      .then(([sec, sessionList, att, sub]) => {
        if (!active) return
        setSections(sec)
        setSessions(sessionList)
        setAttendanceRecords(att)
        setSubjects(Object.fromEntries(sub.map((s) => [s.id, s])))
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [studentId]))

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []

    const startOffset = firstDay.getDay()
    for (let i = startOffset; i > 0; i--) {
      days.push(new Date(year, month, 1 - i))
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    const endOffset = 42 - days.length
    for (let i = 1; i <= endOffset; i++) {
      days.push(new Date(year, month + 1, i))
    }
    return days
  }, [currentDate])

  const weekDays = useMemo(() => {
    const todayStr = formatDate(new Date())
    const curr = new Date(currentDate)
    const dayOfWeek = curr.getDay()
    const sunday = new Date(curr.setDate(curr.getDate() - dayOfWeek))

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday)
      d.setDate(sunday.getDate() + i)
      const dateStr = formatDate(d)
      return { date: dateStr, day: dayNames[i], isToday: dateStr === todayStr }
    })
  }, [currentDate])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const rangeStart = viewMode === 'month' ? monthDays[0] : new Date(`${weekDays[0].date}T00:00:00`)
    const rangeEnd = viewMode === 'month' ? monthDays[monthDays.length - 1] : new Date(`${weekDays[6].date}T23:59:59`)
    const events = generateStudentCalendarEvents(
      sections,
      sessions,
      attendanceRecords,
      (subjectId) => subjects[subjectId],
      formatDate(rangeStart),
      formatDate(rangeEnd),
    )
    for (const event of events) {
      const existing = map.get(event.date) ?? []
      existing.push(event)
      map.set(event.date, existing)
    }
    return map
  }, [sections, sessions, attendanceRecords, subjects, monthDays, weekDays, viewMode])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return []
    return eventsByDate.get(selectedDay) ?? []
  }, [selectedDay, eventsByDate])

  const shiftRange = useCallback((direction: -1 | 1) => {
    setSelectedDay(null)
    setCurrentDate((date) => viewMode === 'month'
      ? new Date(date.getFullYear(), date.getMonth() + direction, 1)
      : new Date(date.getFullYear(), date.getMonth(), date.getDate() + (direction * 7)))
  }, [viewMode])

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDay(formatDate(today))
  }

  if (!studentId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-campus dark:bg-campus-dark">
        <ActivityIndicator size="large" color={pupColors.maroon} />
      </SafeAreaView>
    )
  }

  const displayedRange = viewMode === 'month'
    ? `${getMonthName(currentDate.getMonth())} ${currentDate.getFullYear()}`
    : `${new Date(`${weekDays[0].date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${new Date(`${weekDays[6].date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Class Calendar"
        title="My Schedule"
        subtitle="Scheduled, moved, and completed classes in one view."
        actions={<CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />}
      />

      <View className="px-4">
        <View className="mb-3 flex-row rounded-none border border-line bg-white p-1 dark:border-line-dark dark:bg-surface-dark">
          {(['month', 'week'] as const).map((mode) => {
            const active = viewMode === mode
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setViewMode(mode)}
                className={`min-h-10 flex-1 items-center justify-center rounded-none ${active ? 'bg-maroon dark:bg-golden' : ''}`}
              >
                <Text className={`font-sans-bold text-xs uppercase tracking-widest ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{mode}</Text>
              </Pressable>
            )
          })}
        </View>

        <View className="mb-3 flex-row items-center justify-between rounded-none border border-line bg-white p-2 dark:border-line-dark dark:bg-surface-dark">
          <Pressable accessibilityRole="button" accessibilityLabel="Previous date range" onPress={() => shiftRange(-1)} className="h-10 w-10 items-center justify-center rounded-none border border-line bg-zinc-50 dark:border-line-dark dark:bg-white/5">
            <MaterialIcons name="chevron-left" size={22} color={isDark ? pupColors.golden : pupColors.maroon} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={goToToday} className="flex-1 items-center px-2">
            <Text className="font-sans-bold text-sm text-ink dark:text-white uppercase tracking-wider">{displayedRange}</Text>
            <Text className="mt-0.5 font-sans-bold text-[9px] uppercase tracking-widest text-maroon dark:text-golden">Return to Today</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next date range" onPress={() => shiftRange(1)} className="h-10 w-10 items-center justify-center rounded-none border border-line bg-zinc-50 dark:border-line-dark dark:bg-white/5">
            <MaterialIcons name="chevron-right" size={22} color={isDark ? pupColors.golden : pupColors.maroon} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        scrollEnabled={viewMode === 'month'}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mb-3 gap-4 px-1">
          {[
            ['bg-zinc-400', 'Scheduled'],
            ['bg-zinc-600', 'Moved'],
            ['bg-emerald-500', 'Present'],
            ['bg-amber-400', 'Late'],
            ['bg-red-500', 'Absent'],
          ].map(([dot, label]) => (
            <View key={label} className="flex-row items-center gap-1.5">
              <View className={`h-2 w-2 rounded-none ${dot}`} />
              <Text className="font-sans-bold text-[9px] uppercase tracking-wider text-muted dark:text-zinc-400">{label}</Text>
            </View>
          ))}
        </ScrollView>

        {!sections.length ? (
          <CampusEmptyState icon="calendar-today" title="NO CLASSES TO SCHEDULE" description="Enroll in a class to see its weekly schedule and attendance sessions." />
        ) : viewMode === 'week' ? (
          <StudentWeekCalendar weekDays={weekDays} eventsByDate={eventsByDate} onSelectEvent={setSelectedEvent} />
        ) : (
          <>
            <StudentMonthCalendar
              monthDays={monthDays}
              currentMonth={currentDate.getMonth()}
              today={formatDate(new Date())}
              selectedDay={selectedDay}
              eventsByDate={eventsByDate}
              onSelectDay={(date) => setSelectedDay((selected) => selected === date ? null : date)}
            />
            {selectedDay ? (
              <>
                <SectionHeading
                  eyebrow="Selected Day"
                  title={new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })}
                />
                <StudentCalendarEventList events={selectedDayEvents} onSelectEvent={setSelectedEvent} />
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <StudentCalendarEventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onViewSubject={(sectionId) => { setSelectedEvent(null); router.push(`/(tabs)/subject-info/${sectionId}`) }}
      />
    </SafeAreaView>
  )
}
