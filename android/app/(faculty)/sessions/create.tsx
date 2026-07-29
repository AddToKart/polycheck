import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import type { Section, Session, Subject, User } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useTheme } from '../../../theme/ThemeContext'
import MapView from '../../../components/MapView'
import { CampusHeader } from '../../../components/CampusHeader'
import { CampusButton, CampusCard, SectionHeading } from '../../../components/CampusPrimitives'
import { CampusFormField } from '../../../components/CampusFormField'
import { CampusPickerField, ChoiceSheet, formatCampusTime, TimePickerSheet } from '../../../components/CampusPickerSheets'

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const ToggleRow = ({ checked, label, description, onPress }: { checked: boolean; label: string; description?: string; onPress: () => void }) => (
  <Pressable accessibilityRole="switch" accessibilityState={{ checked }} onPress={onPress} className="min-h-16 flex-row items-center gap-3 rounded-2xl border border-line bg-zinc-50 px-4 dark:border-line-dark dark:bg-white/5">
    <View className={`h-7 w-12 justify-center rounded-full p-1 ${checked ? 'bg-maroon dark:bg-golden' : 'bg-zinc-300 dark:bg-zinc-700'}`}><View className={`h-5 w-5 rounded-full bg-white ${checked ? 'self-end dark:bg-maroon-dark' : 'self-start'}`} /></View>
    <View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{label}</Text>{description ? <Text className="mt-1 font-sans text-[11px] leading-4 text-muted dark:text-zinc-400">{description}</Text> : null}</View>
  </Pressable>
)

export default function CreateSessionScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [mapFocus, setMapFocus] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [sectionSessions, setSectionSessions] = useState<Session[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [room, setRoom] = useState('')
  const [latitude, setLatitude] = useState(14.8697)
  const [longitude, setLongitude] = useState(120.9991)
  const [radius, setRadius] = useState(40)
  const [recenterKey, setRecenterKey] = useState(0)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [showSectionPicker, setShowSectionPicker] = useState(false)
  const [showStartTime, setShowStartTime] = useState(false)
  const [showEndTime, setShowEndTime] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [bulkEndDate, setBulkEndDate] = useState(() => { const next = new Date(); next.setMonth(next.getMonth() + 4); return next.toISOString().slice(0, 10) })
  const [bulkDays, setBulkDays] = useState<string[]>([])
  const [isRescheduled, setIsRescheduled] = useState(false)
  const [rescheduledFromDate, setRescheduledFromDate] = useState('')
  const [showReplaceDatePicker, setShowReplaceDatePicker] = useState(false)

  useEffect(() => {
    const currentUser = api.getCurrentUser()
    if (!currentUser || currentUser.role !== 'teacher') {
      router.replace('/(faculty)/dashboard')
      return
    }
    setUser(currentUser)
    void api.getSubjects().then(setSubjects).catch(() => Alert.alert('Unable to load subjects', 'Please try again.'))
  }, [])

  useEffect(() => {
    if (!selectedSubjectId) { setSections([]); setSectionId(''); return }
    void api.getSections(selectedSubjectId).then((nextSections) => setSections(nextSections.filter((section) => section.teacherId === user?.id)))
    setSectionId('')
  }, [selectedSubjectId, user?.id])

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId)
  const selectedSection = sections.find((section) => section.id === sectionId)
  const selectedParentSubject = selectedSection ? subjects.find((subject) => subject.id === selectedSection.subjectId) : undefined

  useEffect(() => {
    if (!selectedSection) return
    setBulkDays(selectedSection.schedule.map((schedule) => schedule.day))
    if (selectedSection.room) setRoom(selectedSection.room)
    setIsRescheduled(false)
    setRescheduledFromDate('')
  }, [selectedSection])

  useEffect(() => {
    if (!sectionId) { setSectionSessions([]); return }
    void api.getSessions(sectionId).then(setSectionSessions)
  }, [sectionId])

  const replaceDates = useMemo(() => {
    if (!selectedSection) return []
    const dates: Array<{ dateStr: string; label: string; scheduleTime: string; room?: string }> = []
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    for (let offset = 0; offset < 14; offset += 1) {
      const next = new Date()
      next.setDate(next.getDate() + offset)
      const schedule = selectedSection.schedule.find((item) => item.day === dayNames[next.getDay()])
      if (!schedule) continue
      const dateStr = next.toISOString().slice(0, 10)
      dates.push({
        dateStr,
        label: `${next.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} (${schedule.startTime}–${schedule.endTime})`,
        scheduleTime: `${schedule.startTime} - ${schedule.endTime}`,
        room: selectedSection.room || undefined,
      })
    }
    return dates
  }, [selectedSection])

  const bulkCount = useMemo(() => {
    if (!bulkStartDate || !bulkEndDate || !bulkDays.length) return 0
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const targetDays = bulkDays.map((day) => dayMap[day])
    const cursor = new Date(bulkStartDate)
    const end = new Date(bulkEndDate)
    let count = 0
    while (cursor <= end) { if (targetDays.includes(cursor.getDay())) count += 1; cursor.setDate(cursor.getDate() + 1) }
    return count
  }, [bulkDays, bulkEndDate, bulkStartDate])

  const existingSession = !bulkMode && sectionId && date ? sectionSessions.find((session) => session.date === date) : undefined
  const hasConflict = !!existingSession && !isRescheduled

  if (!user) return null

  const useMyLocation = async () => {
    setLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') { Alert.alert('Location permission needed', 'Allow location access to pin your current position.'); return }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLatitude(location.coords.latitude)
      setLongitude(location.coords.longitude)
      setRecenterKey((value) => value + 1)
    } catch { Alert.alert('Unable to locate you', 'Turn on device location and try again.') } finally { setLocating(false) }
  }

  const create = async () => {
    if (!sectionId || !selectedSection || submitting) return
    if (endTime <= startTime) { Alert.alert('Check the time', 'End time must be later than start time.'); return }
    setSubmitting(true)
    try {
      if (bulkMode) {
        await api.createBulkSessions({ sectionId, subjectName: selectedParentSubject?.name ?? '', startDate: bulkStartDate, endDate: bulkEndDate, daysOfWeek: bulkDays, startTime, endTime, room: room || undefined, geofence: { latitude, longitude, radiusMeters: radius }, teacherId: user.id })
        Alert.alert('Sessions created', `${bulkCount} recurring sessions were created.`)
      } else {
        const replaced = replaceDates.find((item) => item.dateStr === rescheduledFromDate)
        await api.createSession({ sectionId, subjectName: selectedParentSubject?.name ?? '', date, startTime, endTime, room: room || undefined, geofence: { latitude, longitude, radiusMeters: radius }, teacherId: user.id, isRescheduled: isRescheduled || undefined, rescheduledFromDate: isRescheduled ? rescheduledFromDate : undefined, originalScheduleTime: isRescheduled ? replaced?.scheduleTime : undefined, originalRoom: isRescheduled ? replaced?.room : undefined })
      }
      router.back()
    } catch (error) { Alert.alert('Unable to create session', error instanceof Error ? error.message : 'Please try again.') } finally { setSubmitting(false) }
  }

  const disabled = !sectionId || (bulkMode && bulkCount === 0) || hasConflict || submitting

  return <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
    <CampusHeader eyebrow="Session planning" title={bulkMode ? 'Create recurring sessions' : 'Create a session'} subtitle="Choose the class, meeting window, and trusted attendance area." onBack={() => router.back()} />
    <ScrollView contentContainerClassName="px-4 pb-28 pt-3" keyboardShouldPersistTaps="handled" scrollEnabled={!mapFocus} showsVerticalScrollIndicator={false}>
      <SectionHeading eyebrow="Step one" title="Choose the class" />
      <CampusCard className="mb-7 gap-4">
        <CampusPickerField label="Subject" value={selectedSubject ? `${selectedSubject.name} (${selectedSubject.code})` : ''} placeholder="Select a subject" onPress={() => setShowSubjectPicker(true)} />
        <View className={!selectedSubject ? 'opacity-50' : ''}><CampusPickerField label="Section" value={selectedSection ? `Section ${selectedSection.section}${selectedSection.room ? ` · ${selectedSection.room}` : ''}` : ''} placeholder={selectedSubject ? 'Select a section' : 'Select a subject first'} onPress={() => selectedSubject && setShowSectionPicker(true)} /></View>
        <ToggleRow checked={bulkMode} label="Create recurring sessions" description="Build all selected weekday meetings across a semester range." onPress={() => setBulkMode((value) => !value)} />
      </CampusCard>

      <SectionHeading eyebrow="Step two" title={bulkMode ? 'Set the recurrence' : 'Set the meeting'} />
      <CampusCard className="mb-7 gap-4">
        {bulkMode ? <>
          <View className="flex-row gap-3"><View className="flex-1"><CampusFormField label="Start date" hint="YYYY-MM-DD" value={bulkStartDate} onChangeText={setBulkStartDate} /></View><View className="flex-1"><CampusFormField label="End date" hint="YYYY-MM-DD" value={bulkEndDate} onChangeText={setBulkEndDate} /></View></View>
          <View><Text className="mb-2 font-sans-bold text-xs text-ink dark:text-zinc-200">Meeting days</Text><View className="flex-row flex-wrap gap-2">{ALL_DAYS.map((day) => {
            const selected = bulkDays.includes(day)
            return <Pressable key={day} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setBulkDays((days) => selected ? days.filter((item) => item !== day) : [...days, day])} className={`min-h-11 min-w-[22%] flex-1 items-center justify-center rounded-2xl border ${selected ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-zinc-50 dark:border-line-dark dark:bg-white/5'}`}><Text className={`font-sans-bold text-xs ${selected ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{day}</Text></Pressable>
          })}</View></View>
          <View className="rounded-2xl bg-golden/15 p-4"><Text className="font-sans-bold text-sm text-maroon-dark dark:text-golden">{bulkCount} session{bulkCount === 1 ? '' : 's'} will be created</Text></View>
        </> : <>
          <CampusFormField label="Session date" icon="event" hint="YYYY-MM-DD" value={date} onChangeText={setDate} />
          {hasConflict ? <View accessibilityRole="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"><Text className="font-sans-bold text-xs text-amber-800 dark:text-amber-300">Session conflict</Text><Text className="mt-2 font-sans text-xs leading-5 text-amber-900 dark:text-amber-200">A session already exists on {date}. Change the date or mark this as a rescheduled class.</Text></View> : null}
          {selectedSection?.schedule.length ? <ToggleRow checked={isRescheduled} label="Reschedule a standard class slot" description="The original slot will appear as moved for students." onPress={() => { const next = !isRescheduled; setIsRescheduled(next); setRescheduledFromDate(next ? replaceDates[0]?.dateStr ?? '' : '') }} /> : null}
          {isRescheduled ? <CampusPickerField label="Standard slot to replace" value={replaceDates.find((item) => item.dateStr === rescheduledFromDate)?.label ?? ''} placeholder="Select standard slot" onPress={() => setShowReplaceDatePicker(true)} /> : null}
        </>}
        <View className="flex-row gap-3"><View className="flex-1"><CampusPickerField label="Starts" value={formatCampusTime(startTime)} placeholder="Start time" icon="schedule" onPress={() => setShowStartTime(true)} /></View><View className="flex-1"><CampusPickerField label="Ends" value={formatCampusTime(endTime)} placeholder="End time" icon="schedule" onPress={() => setShowEndTime(true)} /></View></View>
        <CampusFormField label="Room" icon="meeting-room" placeholder="e.g. CCIS Lab 3" value={room} onChangeText={setRoom} />
      </CampusCard>

      <SectionHeading eyebrow="Step three" title="Set the attendance area" />
      <CampusCard className="mb-7 p-4">
        <View className="mb-3 flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">Geofence</Text><Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">Drag the pin or tap the map. Use the radius control to define the accepted scan area.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Use my current location" disabled={locating} onPress={() => void useMyLocation()} className="min-h-11 flex-row items-center gap-2 rounded-2xl bg-maroon/5 px-3 dark:bg-golden/10">{locating ? <ActivityIndicator size="small" color={isDark ? '#FFDF00' : '#7B1113'} /> : <MaterialIcons name="my-location" size={17} color={isDark ? '#FFDF00' : '#7B1113'} />}<Text className="font-sans-bold text-[10px] text-maroon dark:text-golden">{locating ? 'Locating…' : 'Use mine'}</Text></Pressable></View>
        <View className="overflow-hidden rounded-2xl" onTouchStart={() => setMapFocus(true)} onTouchEnd={() => setMapFocus(false)} onTouchCancel={() => setMapFocus(false)}><MapView latitude={latitude} longitude={longitude} radius={radius} interactive recenterSignal={recenterKey} onLocationChange={(nextLatitude, nextLongitude) => { setLatitude(nextLatitude); setLongitude(nextLongitude) }} onRadiusChange={setRadius} /></View>
        <View className="mt-3 flex-row justify-between"><Text className="font-sans text-[10px] text-muted dark:text-zinc-500">{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text><Text className="font-sans-bold text-[10px] text-maroon dark:text-golden">{radius} m radius</Text></View>
      </CampusCard>

      <CampusButton label={submitting ? 'Creating…' : bulkMode ? `Create ${bulkCount} sessions` : 'Create session'} icon="add" disabled={disabled} onPress={() => void create()} />
    </ScrollView>

    <ChoiceSheet visible={showSubjectPicker} title="Select subject" options={subjects.map((subject) => ({ value: subject.id, label: `${subject.name} (${subject.code})` }))} value={selectedSubjectId} onSelect={setSelectedSubjectId} onClose={() => setShowSubjectPicker(false)} />
    <ChoiceSheet visible={showSectionPicker} title="Select section" options={sections.map((section) => ({ value: section.id, label: `Section ${section.section}${section.room ? ` · ${section.room}` : ''}` }))} value={sectionId} onSelect={setSectionId} onClose={() => setShowSectionPicker(false)} />
    <ChoiceSheet visible={showReplaceDatePicker} title="Select standard slot" options={replaceDates.map((item) => ({ value: item.dateStr, label: item.label }))} value={rescheduledFromDate} onSelect={setRescheduledFromDate} onClose={() => setShowReplaceDatePicker(false)} />
    <TimePickerSheet visible={showStartTime} title="Select start time" value={startTime} onChange={setStartTime} onClose={() => setShowStartTime(false)} />
    <TimePickerSheet visible={showEndTime} title="Select end time" value={endTime} onChange={setEndTime} onClose={() => setShowEndTime(false)} />
  </SafeAreaView>
}
