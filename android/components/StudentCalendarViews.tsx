import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { AttendanceStatus, CalendarEvent } from '@polycheck/shared'
import { useTheme } from '../theme/ThemeContext'
import { AttendanceStatusPill, CampusCard, CampusEmptyState } from './CampusPrimitives'

type EventMap = Map<string, CalendarEvent[]>

const formatTime = (timeStr?: string) => {
  if (!timeStr || typeof timeStr !== 'string') return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (isNaN(h) || isNaN(m)) return timeStr
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`
}

const eventDotClass = (event: CalendarEvent) => {
  if (event.status === 'moved') return 'bg-zinc-400'
  if (event.type === 'schedule') return 'bg-zinc-600'
  if (event.studentStatus === 'present') return 'bg-emerald-500'
  if (event.studentStatus === 'late') return 'bg-amber-400'
  if (event.studentStatus === 'absent') return 'bg-red-500'
  return 'bg-maroon dark:bg-golden'
}

type StudentMonthCalendarProps = {
  monthDays: (Date | null)[][] | Date[]
  currentMonth: number
  today: string
  selectedDay: string | null
  eventsByDate: EventMap
  onSelectDay: (dateStr: string) => void
}

export const StudentMonthCalendar = ({
  monthDays,
  currentMonth,
  today,
  selectedDay,
  eventsByDate,
  onSelectDay,
}: StudentMonthCalendarProps) => {
  const flatDays: (Date | null)[] = Array.isArray(monthDays[0])
    ? (monthDays as (Date | null)[][]).flat()
    : (monthDays as Date[])

  return (
    <CampusCard className="mb-4 rounded-none p-3 border-t-4 border-t-maroon dark:border-t-golden">
      <View className="mb-2 flex-row justify-between border-b border-line pb-2 dark:border-line-dark">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
          <Text key={`${day}-${idx}`} className="w-[14%] text-center font-sans-bold text-xs text-muted dark:text-zinc-400">
            {day}
          </Text>
        ))}
      </View>

      {Array.from({ length: Math.ceil(flatDays.length / 7) }).map((_, weekIdx) => (
        <View key={weekIdx} className="flex-row justify-between">
          {flatDays.slice(weekIdx * 7, (weekIdx + 1) * 7).map((day, dayIdx) => {
            if (!day) return <View key={`empty-${weekIdx}-${dayIdx}`} className="aspect-square flex-1" />
            const date = day.toISOString().split('T')[0]
            const isToday = date === today
            const selected = date === selectedDay
            const dayEvents = eventsByDate.get(date) ?? []
            const outsideMonth = day.getMonth() !== currentMonth
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={`${day.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}, ${dayEvents.length} classes`}
                accessibilityState={{ selected }}
                onPress={() => onSelectDay(date)}
                className={`aspect-square flex-1 items-center justify-center rounded-none border ${selected ? 'border-maroon bg-maroon/5 dark:border-golden dark:bg-golden/10' : 'border-transparent'}`}
              >
                <View className={`h-6 w-6 items-center justify-center rounded-none ${isToday ? 'bg-maroon dark:bg-golden' : ''}`}>
                  <Text className={`font-sans-bold text-xs ${isToday ? 'text-white dark:text-maroon-dark' : outsideMonth ? 'text-zinc-300 dark:text-zinc-700' : 'text-ink dark:text-white'}`}>
                    {day.getDate()}
                  </Text>
                </View>

                <View className="mt-1 flex-row gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <View key={event.id} className={`h-1.5 w-1.5 rounded-full ${eventDotClass(event)}`} />
                  ))}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </CampusCard>
  )
}

type WeekDay = { date: string; day: string; isToday: boolean }

export const StudentWeekCalendar = ({
  weekDays,
  eventsByDate,
  onSelectEvent,
}: {
  weekDays: WeekDay[]
  eventsByDate: EventMap
  onSelectEvent: (event: CalendarEvent) => void
}) => (
  <View className="mb-4">
    {/* Swipe Header */}
    <View className="mb-2 flex-row items-center justify-between px-1">
      <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-maroon dark:text-golden">
        Swipe sideways to view all 7 days (Sun–Sat)
      </Text>
      <MaterialIcons name="swipe" size={16} color="#7B1113" />
    </View>

    {/* Horizontal Week Viewport */}
    <ScrollView
      horizontal
      decelerationRate="fast"
      snapToInterval={242}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingRight: 32, paddingBottom: 12 }}
    >
      {weekDays.map((weekDay) => {
        const events = [...(eventsByDate.get(weekDay.date) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime))
        return (
          <View
            key={weekDay.date}
            style={{ width: 230, minHeight: 220 }}
            className={`rounded-none border p-3.5 ${weekDay.isToday ? 'border-maroon border-t-4 border-t-maroon bg-maroon/5 dark:border-golden dark:border-t-golden dark:bg-golden/10' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}
          >
            <View className="mb-3 flex-row items-center justify-between border-b border-line/60 pb-2 dark:border-line-dark/60">
              <View>
                <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-muted dark:text-zinc-500">{weekDay.day}</Text>
                <Text className={`mt-0.5 font-sans-bold text-2xl font-bold ${weekDay.isToday ? 'text-maroon dark:text-golden' : 'text-ink dark:text-white'}`}>
                  {new Date(`${weekDay.date}T00:00:00`).getDate()}
                </Text>
              </View>
              {weekDay.isToday ? <View className="h-2 w-2 rounded-none bg-golden" /> : null}
            </View>

            <View className="gap-2">
              {events.length === 0 ? (
                <Text className="py-8 text-center font-sans-bold text-xs uppercase tracking-wider text-muted dark:text-zinc-500">No classes</Text>
              ) : events.map((event) => (
                <Pressable
                  key={event.id}
                  hitSlop={4}
                  onPress={() => onSelectEvent(event)}
                  className={`rounded-none border-l-4 bg-zinc-50 p-3 dark:bg-white/5 ${event.status === 'moved' ? 'border-l-zinc-400' : event.type === 'schedule' ? 'border-l-zinc-300' : event.studentStatus === 'present' ? 'border-l-emerald-500' : event.studentStatus === 'late' ? 'border-l-amber-400' : event.studentStatus === 'absent' ? 'border-l-red-500' : 'border-l-maroon dark:border-l-golden'}`}
                >
                  <Text className="font-sans-bold text-[10px] text-maroon dark:text-golden">{formatTime(event.startTime)}</Text>
                  <Text className="mt-1 font-sans-bold text-xs text-ink dark:text-white" numberOfLines={2}>
                    {event.status === 'moved' ? `${event.subjectCode || 'Class'} moved` : event.type === 'schedule' ? 'No session yet' : event.subjectCode || event.subjectName}
                  </Text>
                  <Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-400" numberOfLines={1}>{event.room || 'Room TBA'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      })}
    </ScrollView>
  </View>
)

export const StudentCalendarEventList = ({ events, onSelectEvent }: { events: CalendarEvent[]; onSelectEvent: (event: CalendarEvent) => void }) => {
  const { isDark } = useTheme()
  if (!events.length) return <CampusEmptyState icon="event-available" title="NO CLASSES THIS DAY" description="Choose another date to review your schedule." />

  return (
    <View className="gap-3">
      {[...events].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((event) => (
        <CampusCard key={event.id} onPress={() => onSelectEvent(event)} accessibilityLabel={`Open ${event.subjectName}`} className="p-4 rounded-none border-l-4 border-l-maroon dark:border-l-golden">
          <View className="flex-row items-center gap-4">
            <View className="w-16">
              <Text className="font-sans-bold text-xs text-maroon dark:text-golden">{formatTime(event.startTime)}</Text>
              <Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{formatTime(event.endTime)}</Text>
            </View>
            <View className="h-12 w-px bg-line dark:bg-line-dark" />
            <View className="flex-1">
              <Text className="font-sans-bold text-sm text-ink dark:text-white">{event.status === 'moved' ? `${event.subjectName} · Moved` : event.type === 'schedule' ? 'No session yet' : event.subjectName}</Text>
              <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">Sec {event.sectionName}{event.room ? ` · ${event.room}` : ''}</Text>
              {event.studentStatus ? <View className="mt-2"><AttendanceStatusPill status={event.studentStatus} /></View> : null}
            </View>
            <MaterialIcons name="chevron-right" size={21} color={isDark ? '#A1A1AA' : '#746C6E'} />
          </View>
        </CampusCard>
      ))}
    </View>
  )
}

export const StudentCalendarEventModal = ({
  event,
  onClose,
  onViewSubject,
}: {
  event: CalendarEvent | null
  onClose: () => void
  onViewSubject: (sectionId: string) => void
}) => {
  const { isDark } = useTheme()

  return (
    <Modal visible={Boolean(event)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.80)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        {event ? (
          <View style={{ width: '100%', borderRadius: 0, borderWidth: 1, borderTopWidth: 5, borderTopColor: '#FFDF00', borderColor: isDark ? '#30272A' : '#7B1113', backgroundColor: isDark ? '#171316' : '#FFFFFF', padding: 20 }}>
            <View className="mb-3 flex-row items-center justify-between border-b border-line pb-2 dark:border-line-dark">
              <View>
                <Text className="font-sans-bold text-[10px] uppercase tracking-[2px] text-maroon dark:text-golden">Class Detail</Text>
                <Text className="font-sans-bold text-lg font-bold text-ink dark:text-white">{event.subjectName}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onClose} className="h-9 w-9 items-center justify-center rounded-none border border-line bg-zinc-100 dark:border-line-dark dark:bg-white/5">
                <MaterialIcons name="close" size={18} color={isDark ? '#FFFFFF' : '#4A0A0B'} />
              </Pressable>
            </View>

            <View className="gap-2.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-xs text-muted dark:text-zinc-400">Section</Text>
                <Text className="font-sans-bold text-xs text-ink dark:text-white">Sec {event.sectionName}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-xs text-muted dark:text-zinc-400">Scheduled Time</Text>
                <Text className="font-sans-bold text-xs text-ink dark:text-white">{formatTime(event.startTime)} – {formatTime(event.endTime)}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-xs text-muted dark:text-zinc-400">Room</Text>
                <Text className="font-sans-bold text-xs text-ink dark:text-white">{event.room || 'Room TBA'}</Text>
              </View>
              {event.studentStatus ? (
                <View className="flex-row items-center justify-between">
                  <Text className="font-sans text-xs text-muted dark:text-zinc-400">Status</Text>
                  <AttendanceStatusPill status={event.studentStatus} />
                </View>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => onViewSubject(event.sectionId)}
              className="mt-5 min-h-11 items-center justify-center rounded-none bg-maroon dark:bg-golden"
            >
              <Text className="font-sans-bold text-xs uppercase tracking-widest text-white dark:text-maroon-dark">View Class Overview</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}
