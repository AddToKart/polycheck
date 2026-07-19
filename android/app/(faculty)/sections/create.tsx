import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import type { DayOfWeek, Subject, User } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useTheme } from '../../../theme/ThemeContext'
import { CampusHeader } from '../../../components/CampusHeader'
import { CampusButton, CampusCard, SectionHeading } from '../../../components/CampusPrimitives'
import { CampusFormField } from '../../../components/CampusFormField'
import { CampusPickerField, ChoiceSheet, formatCampusTime, TimePickerSheet } from '../../../components/CampusPickerSheets'

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']

const generateEnrollmentCode = (subjectName: string) => {
  const prefix = subjectName.split(' ').filter(Boolean).map((word) => word[0]).join('').toUpperCase().slice(0, 4) || 'CODE'
  return `${prefix}${Math.random().toString(36).substring(2, 5).toUpperCase()}`
}

export default function CreateSectionScreen() {
  const { isDark } = useTheme()
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [section, setSection] = useState('')
  const [room, setRoom] = useState('')
  const [semester, setSemester] = useState('')
  const [showSemesterPicker, setShowSemesterPicker] = useState(false)
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [showStartTime, setShowStartTime] = useState(false)
  const [showEndTime, setShowEndTime] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [scheduleEntries, setScheduleEntries] = useState<Array<{ day: DayOfWeek; startTime: string; endTime: string; room?: string }>>([])
  const [newDay, setNewDay] = useState<DayOfWeek>('Mon')
  const [newStartTime, setNewStartTime] = useState('08:00')
  const [newEndTime, setNewEndTime] = useState('09:00')
  const [newScheduleRoom, setNewScheduleRoom] = useState('')

  useEffect(() => {
    const currentUser = api.getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      router.replace('/(faculty)/dashboard')
      return
    }
    setUser(currentUser)
    if (subjectId) void api.getSubject(subjectId).then(setSubject).catch(() => router.back())
  }, [subjectId])

  const enrollmentCode = useMemo(() => subject ? generateEnrollmentCode(subject.name) : '', [subject])
  if (!user || !subject) return null

  const addSchedule = () => {
    if (newEndTime <= newStartTime) {
      Alert.alert('Check the time', 'End time must be later than start time.')
      return
    }
    setScheduleEntries((entries) => [...entries, { day: newDay, startTime: newStartTime, endTime: newEndTime, room: newScheduleRoom.trim() || undefined }])
    setNewScheduleRoom('')
  }

  const valid = !!section.trim() && !!room.trim() && !!semester && scheduleEntries.length > 0
  const create = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      const created = await api.createSection({ subjectId, section: section.trim(), room: room.trim(), schedule: scheduleEntries, semester })
      await api.resetEnrollmentCode(created.id)
      router.back()
    } catch (error) {
      Alert.alert('Unable to create section', error instanceof Error ? error.message : 'Please try again.')
    } finally { setSubmitting(false) }
  }

  return <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
    <CampusHeader eyebrow="Subject setup" title="Create a section" subtitle={`${subject.name} · ${subject.code}`} onBack={() => router.back()} />
    <ScrollView contentContainerClassName="px-4 pb-28 pt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <SectionHeading eyebrow="Class identity" title="Section details" />
      <CampusCard className="mb-7 gap-4">
        <CampusFormField label="Section name" icon="groups" placeholder="e.g. A, B, BSIT 3-1" value={section} onChangeText={setSection} />
        <CampusFormField label="Default room" icon="meeting-room" placeholder="e.g. CCIS Lab 3" value={room} onChangeText={setRoom} />
        <CampusPickerField label="Semester" value={semester} placeholder="Select semester" onPress={() => setShowSemesterPicker(true)} />
      </CampusCard>

      <SectionHeading eyebrow="Weekly rhythm" title="Class schedule" />
      <View className="mb-4 gap-3">
        {scheduleEntries.map((entry, index) => <CampusCard key={`${entry.day}-${entry.startTime}-${index}`} className="p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-11 min-w-14 items-center justify-center rounded-2xl bg-maroon dark:bg-golden"><Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">{entry.day}</Text></View>
            <View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{formatCampusTime(entry.startTime)} – {formatCampusTime(entry.endTime)}</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{entry.room || room || 'Default section room'}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${entry.day} schedule`} onPress={() => setScheduleEntries((entries) => entries.filter((_, entryIndex) => entryIndex !== index))} className="h-11 w-11 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30"><MaterialIcons name="delete-outline" size={20} color="#DC2626" /></Pressable>
          </View>
        </CampusCard>)}
      </View>

      <CampusCard className="mb-7 border-dashed p-4">
        <Text className="mb-4 font-sans-bold text-sm text-ink dark:text-white">Add meeting time</Text>
        <View className="gap-4">
          <CampusPickerField label="Day" value={newDay} placeholder="Select day" onPress={() => setShowDayPicker(true)} />
          <View className="flex-row gap-3"><View className="flex-1"><CampusPickerField label="Starts" value={formatCampusTime(newStartTime)} placeholder="Start time" icon="schedule" onPress={() => setShowStartTime(true)} /></View><View className="flex-1"><CampusPickerField label="Ends" value={formatCampusTime(newEndTime)} placeholder="End time" icon="schedule" onPress={() => setShowEndTime(true)} /></View></View>
          <CampusFormField label="Room override (optional)" icon="room" placeholder={room || 'Use default room'} value={newScheduleRoom} onChangeText={setNewScheduleRoom} />
          <CampusButton label="Add schedule" icon="add" variant="secondary" onPress={addSchedule} />
        </View>
      </CampusCard>

      <SectionHeading eyebrow="Enrollment" title="Join code" />
      <CampusCard className="mb-7 items-center bg-maroon dark:bg-[#2A0E11]">
        <Text className="font-sans-bold text-[10px] uppercase tracking-[2px] text-golden">Generated after creation</Text>
        <Text className="mt-3 font-mono text-2xl tracking-[4px] text-white">{enrollmentCode}</Text>
        <Text className="mt-2 text-center font-sans text-xs text-white/60">The server will issue the authoritative enrollment code.</Text>
      </CampusCard>
      <CampusButton label={submitting ? 'Creating section…' : 'Create section'} icon="add" disabled={!valid || submitting} onPress={() => void create()} />
    </ScrollView>

    <ChoiceSheet visible={showSemesterPicker} title="Select semester" options={SEMESTERS.map((value) => ({ value, label: value }))} value={semester} onSelect={setSemester} onClose={() => setShowSemesterPicker(false)} />
    <ChoiceSheet visible={showDayPicker} title="Select day" options={DAYS.map((value) => ({ value, label: value }))} value={newDay} onSelect={(value) => setNewDay(value as DayOfWeek)} onClose={() => setShowDayPicker(false)} />
    <TimePickerSheet visible={showStartTime} title="Select start time" value={newStartTime} onChange={setNewStartTime} onClose={() => setShowStartTime(false)} />
    <TimePickerSheet visible={showEndTime} title="Select end time" value={newEndTime} onChange={setNewEndTime} onClose={() => setShowEndTime(false)} />
  </SafeAreaView>
}
