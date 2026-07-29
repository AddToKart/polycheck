import { Modal, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { CalendarEvent } from '@polycheck/shared'
import { formatTime } from '@polycheck/shared/utils'
import { useTheme } from '../theme/ThemeContext'
import { AttendanceStatusPill, CampusButton } from './CampusPrimitives'

const EventDetailRow = ({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) => {
  const { isDark } = useTheme()
  return (
    <View className="flex-row items-center gap-3 border-b border-line py-3 dark:border-line-dark">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-maroon/5 dark:bg-golden/10">
        <MaterialIcons name={icon} size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
      </View>
      <Text className="w-14 font-sans text-xs text-muted dark:text-zinc-500">{label}</Text>
      <Text className="flex-1 text-right font-sans-bold text-xs text-ink dark:text-white">{value}</Text>
    </View>
  )
}

export const StudentCalendarEventModal = ({ event, onClose, onViewSubject }: { event: CalendarEvent | null; onClose: () => void; onViewSubject: (sectionId: string) => void }) => {
  const { isDark } = useTheme()
  if (!event) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
        <View className="rounded-t-[32px] border-t border-line bg-white p-5 pb-8 dark:border-line-dark dark:bg-surface-dark" onStartShouldSetResponder={() => true}>
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-maroon dark:text-golden">Class details</Text>
              <Text className="mt-1 font-heading text-2xl text-ink dark:text-white">{event.subjectName}</Text>
            </View>
            {event.status === 'moved' ? <View className="rounded-full bg-zinc-100 px-3 py-2 dark:bg-white/5"><Text className="font-sans-bold text-xs text-muted dark:text-zinc-300">Moved</Text></View> : event.studentStatus ? <AttendanceStatusPill status={event.studentStatus} /> : null}
          </View>

          {event.status === 'moved' && event.rescheduledTo ? (
            <View className="mt-4 rounded-2xl border border-golden/50 bg-golden/10 p-4">
              <Text className="font-sans-bold text-xs text-maroon dark:text-golden">This class was rescheduled</Text>
              <Text className="mt-2 font-sans text-xs leading-5 text-ink dark:text-zinc-200">
                {new Date(`${event.rescheduledTo.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })} · {formatTime(event.rescheduledTo.startTime)}–{formatTime(event.rescheduledTo.endTime)}
              </Text>
            </View>
          ) : null}
          {event.isRescheduled ? <View className="mt-4 rounded-2xl bg-golden/10 p-4"><Text className="font-sans-medium text-xs text-maroon dark:text-golden">This is a rescheduled make-up class meeting.</Text></View> : null}

          <View className="mt-4">
            <EventDetailRow icon="class" label="Section" value={`Sec ${event.sectionName}`} />
            {event.room ? <EventDetailRow icon="room" label="Room" value={event.room} /> : null}
            <EventDetailRow icon="access-time" label="Time" value={`${formatTime(event.startTime)}–${formatTime(event.endTime)}`} />
            <EventDetailRow icon="today" label="Date" value={new Date(`${event.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} />
          </View>

          <View className="mt-5 flex-row gap-3">
            <CampusButton label="Close" variant="secondary" onPress={onClose} className="flex-1" />
            <CampusButton label="View class" icon="arrow-forward" onPress={() => onViewSubject(event.sectionId)} className="flex-1" />
          </View>
        </View>
      </Pressable>
    </Modal>
  )
}
