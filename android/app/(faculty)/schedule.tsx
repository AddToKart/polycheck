import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { AttendanceRecord, CalendarEvent, User } from '@polycheck/shared'
import { formatDate, formatTime, getDateRangeForMonth, getMonthDays, getMonthName, getWeekDays } from '@polycheck/shared/utils'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, SectionHeading } from '../../components/CampusPrimitives'
import { StudentMonthCalendar, StudentWeekCalendar } from '../../components/StudentCalendarViews'

const EventDetail = ({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) => {
  const { isDark } = useTheme()
  return <View className="flex-row items-center gap-3 border-b border-line py-3 dark:border-line-dark"><View className="h-9 w-9 items-center justify-center rounded-xl bg-maroon/5 dark:bg-golden/10"><MaterialIcons name={icon} size={18} color={isDark ? '#FFDF00' : '#7B1113'} /></View><Text className="w-14 font-sans text-xs text-muted dark:text-zinc-500">{label}</Text><Text className="flex-1 text-right font-sans-bold text-xs text-ink dark:text-white">{value}</Text></View>
}

export default function FacultyScheduleScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    const currentUser = api.getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      router.replace(currentUser?.role === 'super_admin' ? '/(faculty)/dashboard' : '/')
      return
    }
    setUser(currentUser)
    setSelectedDay(formatDate(new Date()))
  }, [])

  useEffect(() => {
    if (!user) return
    const range = viewMode === 'month'
      ? getDateRangeForMonth(currentDate.getFullYear(), currentDate.getMonth())
      : { start: getWeekDays(currentDate)[0].date, end: getWeekDays(currentDate)[6].date }
    void Promise.all([api.getCalendarEvents(user.id, range.start, range.end), api.getAttendanceRecords()])
      .then(([nextEvents, nextRecords]) => { setEvents(nextEvents); setAttendanceRecords(nextRecords) })
      .catch(() => Alert.alert('Unable to load schedule', 'Please check your connection and try again.'))
  }, [currentDate, user, viewMode])

  const monthDays = useMemo(() => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()), [currentDate])
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate])
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((event) => map.set(event.date, [...(map.get(event.date) ?? []), event]))
    return map
  }, [events])
  const selectedEvents = selectedDay ? eventsByDate.get(selectedDay) ?? [] : []
  const counts = useMemo(() => {
    if (!selectedEvent || selectedEvent.type !== 'session') return null
    const records = attendanceRecords.filter((record) => record.sessionId === selectedEvent.id)
    return {
      present: records.filter((record) => record.status === 'present').length,
      late: records.filter((record) => record.status === 'late').length,
      absent: records.filter((record) => record.status === 'absent').length,
    }
  }, [attendanceRecords, selectedEvent])

  const move = useCallback((amount: number) => {
    const next = new Date(currentDate)
    if (viewMode === 'month') next.setMonth(next.getMonth() + amount, 1)
    else next.setDate(next.getDate() + (amount * 7))
    setCurrentDate(next)
    setSelectedDay(null)
  }, [currentDate, viewMode])

  if (!user) return null

  const displayRange = viewMode === 'month'
    ? `${getMonthName(currentDate.getMonth())} ${currentDate.getFullYear()}`
    : `${new Date(`${weekDays[0].date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${new Date(`${weekDays[6].date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`

  return <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
    <CampusHeader eyebrow="Faculty calendar" title="Teaching schedule" subtitle="See class patterns, active meetings, and rescheduled sessions in one place." />
    <View className="px-4 pt-2">
      <View className="flex-row rounded-2xl bg-zinc-200/70 p-1 dark:bg-white/5">
        {(['month', 'week'] as const).map((mode) => <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: viewMode === mode }} onPress={() => setViewMode(mode)} className={`min-h-11 flex-1 items-center justify-center rounded-xl ${viewMode === mode ? 'bg-maroon dark:bg-golden' : ''}`}><Text className={`font-sans-bold text-xs capitalize ${viewMode === mode ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{mode}</Text></Pressable>)}
      </View>
      <View className="my-3 flex-row items-center gap-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Previous period" onPress={() => move(-1)} className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white dark:border-line-dark dark:bg-surface-dark"><MaterialIcons name="chevron-left" size={24} color={isDark ? '#FFDF00' : '#7B1113'} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Go to today" onPress={() => { const today = new Date(); setCurrentDate(today); setSelectedDay(formatDate(today)) }} className="min-h-12 justify-center rounded-2xl border border-maroon px-4 dark:border-golden"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">Today</Text></Pressable>
        <Text className="flex-1 text-center font-sans-bold text-sm text-ink dark:text-white">{displayRange}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next period" onPress={() => move(1)} className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white dark:border-line-dark dark:bg-surface-dark"><MaterialIcons name="chevron-right" size={24} color={isDark ? '#FFDF00' : '#7B1113'} /></Pressable>
      </View>
      <View className="mb-2 flex-row flex-wrap justify-center gap-x-4 gap-y-2">{[
        { label: 'Scheduled', color: 'bg-zinc-300 dark:bg-zinc-600' }, { label: 'Session', color: 'bg-maroon dark:bg-golden' }, { label: 'Active', color: 'bg-emerald-500' }, { label: 'Moved', color: 'bg-zinc-500' },
      ].map((item) => <View key={item.label} className="flex-row items-center gap-1.5"><View className={`h-2 w-2 rounded-full ${item.color}`} /><Text className="font-sans-bold text-[9px] uppercase tracking-[.6px] text-muted dark:text-zinc-500">{item.label}</Text></View>)}</View>
    </View>

    <ScrollView contentContainerClassName="px-4 pb-32 pt-2" showsVerticalScrollIndicator={false}>
      {viewMode === 'month' ? <StudentMonthCalendar monthDays={monthDays} currentMonth={currentDate.getMonth()} today={formatDate(new Date())} selectedDay={selectedDay} eventsByDate={eventsByDate} onSelectDay={(date) => setSelectedDay(date === selectedDay ? null : date)} /> : <StudentWeekCalendar weekDays={weekDays} eventsByDate={eventsByDate} onSelectEvent={setSelectedEvent} />}
      {viewMode === 'month' && selectedDay ? <>
        <SectionHeading eyebrow="Selected day" title={new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })} />
        <View className="gap-3">{selectedEvents.length ? [...selectedEvents].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((event) => {
          const actionable = event.type === 'session' || event.status === 'moved'
          return <CampusCard key={event.id} onPress={actionable ? () => setSelectedEvent(event) : undefined} accessibilityLabel={actionable ? `Open ${event.subjectName}` : undefined} className="p-4"><View className="flex-row items-center gap-4"><View className="w-16"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">{formatTime(event.startTime)}</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{formatTime(event.endTime)}</Text></View><View className="h-12 w-px bg-line dark:bg-line-dark" /><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{event.status === 'moved' ? `${event.subjectName} · Moved` : event.type === 'schedule' ? 'No session activated' : event.subjectName}</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">Sec {event.sectionName}{event.room ? ` · ${event.room}` : ''}</Text></View>{actionable ? <MaterialIcons name="chevron-right" size={20} color="#746C6E" /> : null}</View></CampusCard>
        }) : <CampusEmptyState icon="event-available" title="No classes this day" description="Choose another date or create a session from the Sessions tab." />}</View>
      </> : null}
    </ScrollView>

    <Modal visible={!!selectedEvent} transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setSelectedEvent(null)}>
        {selectedEvent ? <Pressable onPress={() => undefined} className="rounded-t-[34px] bg-white px-5 pb-10 pt-4 dark:bg-[#151013]">
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-maroon dark:text-golden">{selectedEvent.status === 'moved' ? 'Rescheduled slot' : selectedEvent.type === 'session' ? 'Class session' : 'Scheduled class'}</Text>
          <Text className="mt-1 font-heading text-2xl text-ink dark:text-white">{selectedEvent.subjectName}</Text>
          {selectedEvent.status === 'moved' && selectedEvent.rescheduledTo ? <View className="mt-4 rounded-2xl border border-golden/50 bg-golden/10 p-4"><Text className="font-sans-bold text-xs text-maroon dark:text-golden">Moved to a new class slot</Text><Text className="mt-2 font-sans text-xs leading-5 text-ink dark:text-zinc-200">{new Date(`${selectedEvent.rescheduledTo.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })} · {formatTime(selectedEvent.rescheduledTo.startTime)}–{formatTime(selectedEvent.rescheduledTo.endTime)}</Text></View> : null}
          {selectedEvent.isRescheduled ? <View className="mt-4 rounded-2xl bg-golden/10 p-4"><Text className="font-sans-medium text-xs text-maroon dark:text-golden">This is a rescheduled make-up session.</Text></View> : null}
          <View className="mt-4"><EventDetail icon="class" label="Section" value={`Sec ${selectedEvent.sectionName}`} />{selectedEvent.room ? <EventDetail icon="room" label="Room" value={selectedEvent.room} /> : null}<EventDetail icon="access-time" label="Time" value={`${formatTime(selectedEvent.startTime)}–${formatTime(selectedEvent.endTime)}`} /><EventDetail icon="today" label="Date" value={new Date(`${selectedEvent.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} /></View>
          {counts ? <View className="my-5 flex-row gap-2"><View className="flex-1 rounded-2xl bg-emerald-500 p-3"><Text className="text-center font-sans-bold text-xs text-white">P {counts.present}</Text></View><View className="flex-1 rounded-2xl bg-amber-400 p-3"><Text className="text-center font-sans-bold text-xs text-maroon-dark">L {counts.late}</Text></View><View className="flex-1 rounded-2xl bg-red-500 p-3"><Text className="text-center font-sans-bold text-xs text-white">A {counts.absent}</Text></View></View> : null}
          <View className="mt-5 flex-row gap-3"><CampusButton className="flex-1" label="Close" variant="secondary" onPress={() => setSelectedEvent(null)} />{selectedEvent.type === 'session' ? <CampusButton className="flex-1" label="View session" icon="visibility" onPress={() => { const id = selectedEvent.id; setSelectedEvent(null); router.push(`/(faculty)/sessions/${id}`) }} /> : null}</View>
        </Pressable> : null}
      </Pressable>
    </Modal>
  </SafeAreaView>
}
