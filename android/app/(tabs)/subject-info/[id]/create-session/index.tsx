import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../../../services/api-client'
import { useTheme } from '../../../../../theme/ThemeContext'
import MapView from '../../../../../components/MapView'
import type { Student, Section, Subject } from '@polycheck/shared'
import * as Location from 'expo-location'

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
  const [mapFocus, setMapFocus] = useState(false)

  const handleUseMyLocation = async () => {
    setLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set the attendance location.')
        return
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setLatitude(location.coords.latitude)
      setLongitude(location.coords.longitude)
      setRecenterSignal((value) => value + 1)
    } catch {
      Alert.alert('Location Error', 'Unable to retrieve your location. Make sure GPS is enabled.')
    } finally {
      setLocating(false)
    }
  }

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (!cu || cu.role !== 'student') { router.replace('/'); return }
    setUser(cu as Student)
  }, [])

  useEffect(() => {
    if (!sectionId) return
    void api.getSection(sectionId).then(async (nextSection) => {
      setSection(nextSection)
      setSubject(await api.getSubject(nextSection.subjectId))
      setRoom(nextSection.room || '')
    })
  }, [sectionId])

  const handleSubmit = async () => {
    if (!section || !subject || !user) return
    if (!await api.checkSessionPermission(sectionId, user.id)) {
      Alert.alert('Permission Expired', 'Your session creation permission has expired. Ask your teacher to grant a new one.')
      return
    }
    try {
      await api.createSession({
        sectionId: section.id,
        subjectName: subject.name,
        date,
        startTime,
        endTime,
        room: room || undefined,
        geofence: { latitude, longitude, radiusMeters: radius },
        teacherId: section.teacherId,
      })
      Alert.alert('Session Created', 'Session created successfully!')
      router.back()
    } catch (error) {
      Alert.alert('Unable to create session', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  if (!section) return null

  const bg = isDark ? '#0A0A0C' : '#F5F5F5'
  const surface = isDark ? '#121215' : '#FFFFFF'
  const border = isDark ? 'rgba(245, 168, 0, 0.15)' : '#DDD'
  const textPrimary = isDark ? '#FFFFFF' : '#333'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888'
  const iconColor = isDark ? '#FFDF00' : '#7B1113'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }}>
          <MaterialIcons name="arrow-back" size={22} color={iconColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text className="text-lg font-heading font-bold" style={{ color: isDark ? '#FFDF00' : '#4A0A0B' }} numberOfLines={1}>Create Session</Text>
          <Text className="text-xs mt-0.5" style={{ color: textSecondary }}>{subject?.name} · Sec {section.section}</Text>
        </View>
      </View>

      <ScrollView scrollEnabled={!mapFocus} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <Text className="text-sm font-sans-bold mb-4" style={{ color: textPrimary }}>Session Details</Text>

          <View className="mb-3">
            <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mb-1" style={{ color: textSecondary }}>Date</Text>
            <TextInput
              className="h-10 px-3 text-sm border"
              style={{ color: textPrimary, borderColor: border, backgroundColor: isDark ? '#0A0A0C' : '#FFF' }}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
          </View>

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mb-1" style={{ color: textSecondary }}>Start Time</Text>
              <TextInput
                className="h-10 px-3 text-sm border"
                style={{ color: textPrimary, borderColor: border, backgroundColor: isDark ? '#0A0A0C' : '#FFF' }}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="HH:MM"
                placeholderTextColor="#999"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mb-1" style={{ color: textSecondary }}>End Time</Text>
              <TextInput
                className="h-10 px-3 text-sm border"
                style={{ color: textPrimary, borderColor: border, backgroundColor: isDark ? '#0A0A0C' : '#FFF' }}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="HH:MM"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <View className="mb-3">
            <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px] mb-1" style={{ color: textSecondary }}>Room</Text>
            <TextInput
              className="h-10 px-3 text-sm border"
              style={{ color: textPrimary, borderColor: border, backgroundColor: isDark ? '#0A0A0C' : '#FFF' }}
              value={room}
              onChangeText={setRoom}
              placeholder="Room (optional)"
              placeholderTextColor="#999"
            />
          </View>

        </View>

        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text className="text-sm font-sans-bold" style={{ color: textPrimary }}>Geofence</Text>
            <TouchableOpacity onPress={handleUseMyLocation} disabled={locating} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: locating ? 0.6 : 1 }}>
              {locating ? <ActivityIndicator size="small" color={iconColor} /> : <MaterialIcons name="my-location" size={16} color={iconColor} />}
              <Text className="text-xs font-sans-bold" style={{ color: iconColor }}>{locating ? 'Locating...' : 'Use My Location'}</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-xs mb-3" style={{ color: textSecondary }}>Drag the pin or tap the map to set the attendance location.</Text>
          <View onTouchStart={() => setMapFocus(true)} onTouchEnd={() => setMapFocus(false)} onTouchCancel={() => setMapFocus(false)}>
            <MapView
              latitude={latitude}
              longitude={longitude}
              radius={radius}
              interactive
              recenterSignal={recenterSignal}
              onLocationChange={(lat, lng) => { setLatitude(lat); setLongitude(lng) }}
              onRadiusChange={setRadius}
            />
          </View>
        </View>

        <TouchableOpacity
          className="py-3 items-center"
          style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113' }}
          onPress={handleSubmit}
          accessibilityRole="button"
        >
          <Text className="text-sm font-sans-bold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>Create Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
