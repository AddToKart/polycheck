import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import type { Section, Student, Subject } from '@polycheck/shared'
import * as Location from 'expo-location'
import { api } from '../../../../../services/api-client'
import { useTheme } from '../../../../../theme/ThemeContext'
import MapView from '../../../../../components/MapView'
import { CampusHeader } from '../../../../../components/CampusHeader'
import { CampusButton, CampusCard, SectionHeading } from '../../../../../components/CampusPrimitives'
import { CampusFormField } from '../../../../../components/CampusFormField'

export default function StudentCreateSessionScreen() {
  const { isDark } = useTheme()
  const { id: sectionId } = useLocalSearchParams<{ id: string }>()
  const [user, setUser] = useState<Student | null>(null)
  const [section, setSection] = useState<Section | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [room, setRoom] = useState('')
  const [latitude, setLatitude] = useState(14.8697)
  const [longitude, setLongitude] = useState(120.9991)
  const [radius, setRadius] = useState(40)
  const [recenterSignal, setRecenterSignal] = useState(0)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [mapFocus, setMapFocus] = useState(false)

  useEffect(() => {
    const currentUser = api.getCurrentUser()
    if (!currentUser || currentUser.role !== 'student') {
      router.replace('/')
      return
    }
    setUser(currentUser as Student)
  }, [])

  useEffect(() => {
    if (!sectionId) return
    void api.getSection(sectionId).then(async (nextSection) => {
      setSection(nextSection)
      setSubject(await api.getSubject(nextSection.subjectId))
      setRoom(nextSection.room || '')
    }).catch(() => router.back())
  }, [sectionId])

  const useMyLocation = async () => {
    setLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Allow location access to position the attendance geofence.')
        return
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLatitude(location.coords.latitude)
      setLongitude(location.coords.longitude)
      setRecenterSignal((value) => value + 1)
    } catch {
      Alert.alert('Location unavailable', 'Turn on GPS and try again.')
    } finally {
      setLocating(false)
    }
  }

  const createSession = async () => {
    if (!section || !subject || !user) return
    if (!date.trim() || !startTime.trim() || !endTime.trim()) {
      Alert.alert('Missing session details', 'Enter the date, start time, and end time.')
      return
    }
    if (!await api.checkSessionPermission(sectionId, user.id)) {
      Alert.alert('Permission expired', 'Ask your instructor to renew your session creation permission.')
      return
    }
    setSubmitting(true)
    try {
      await api.createSession({
        sectionId: section.id,
        subjectName: subject.name,
        date,
        startTime,
        endTime,
        room: room.trim() || undefined,
        geofence: { latitude, longitude, radiusMeters: radius },
        teacherId: section.teacherId,
      })
      Alert.alert('Session created', 'The class session is ready for activation.', [{ text: 'Done', onPress: () => router.back() }])
    } catch (error) {
      Alert.alert('Unable to create session', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!section) return null

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Authorized officer action"
        title="Create class session"
        subtitle={`${subject?.name ?? 'Class'} · Section ${section.section}`}
        onBack={() => router.back()}
      />

      <ScrollView scrollEnabled={!mapFocus} className="flex-1" contentContainerClassName="px-4 pb-12" keyboardShouldPersistTaps="handled">
        <SectionHeading eyebrow="Step 1" title="Session details" />
        <CampusCard className="mb-7 gap-4">
          <CampusFormField label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" icon="today" autoCapitalize="none" />
          <View className="flex-row gap-3">
            <CampusFormField label="Start time" value={startTime} onChangeText={setStartTime} placeholder="HH:MM" icon="schedule" className="flex-1" />
            <CampusFormField label="End time" value={endTime} onChangeText={setEndTime} placeholder="HH:MM" icon="schedule" className="flex-1" />
          </View>
          <CampusFormField label="Room" value={room} onChangeText={setRoom} placeholder="Optional room" icon="room" />
        </CampusCard>

        <SectionHeading eyebrow="Step 2" title="Attendance geofence" />
        <CampusCard className="mb-7 p-4">
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-sans-bold text-sm text-ink dark:text-white">Class location</Text>
              <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">Drag the pin or tap the map. Students must be within {radius} meters.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
              disabled={locating}
              onPress={() => void useMyLocation()}
              className="min-h-11 flex-row items-center gap-2 rounded-2xl bg-maroon/5 px-3 dark:bg-golden/10"
            >
              {locating ? <ActivityIndicator size="small" color={isDark ? '#FFDF00' : '#7B1113'} /> : <MaterialIcons name="my-location" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />}
              <Text className="font-sans-bold text-[10px] text-maroon dark:text-golden">{locating ? 'Locating…' : 'My location'}</Text>
            </Pressable>
          </View>
          <View className="overflow-hidden rounded-3xl" onTouchStart={() => setMapFocus(true)} onTouchEnd={() => setMapFocus(false)} onTouchCancel={() => setMapFocus(false)}>
            <MapView
              latitude={latitude}
              longitude={longitude}
              radius={radius}
              interactive
              recenterSignal={recenterSignal}
              onLocationChange={(nextLatitude, nextLongitude) => { setLatitude(nextLatitude); setLongitude(nextLongitude) }}
              onRadiusChange={setRadius}
            />
          </View>
        </CampusCard>

        <CampusButton label={submitting ? 'Creating session…' : 'Create session'} icon="add" disabled={submitting} onPress={() => void createSession()} />
      </ScrollView>
    </SafeAreaView>
  )
}
