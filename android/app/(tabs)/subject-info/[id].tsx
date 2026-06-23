import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../services/mock-api'
import { useTheme } from '../../../theme/ThemeContext'
import type { Section } from '@polycheck/shared'

export default function StudentSubjectInfoScreen() {
  const { isDark } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [section, setSection] = useState<Section | null>(null)

  useEffect(() => {
    if (!id) return
    const s = api.getSection(id)
    setSection(s ?? null)
  }, [id])

  const parentSubject = section ? api.getSubject(section.subjectId) : undefined

  if (!section) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0A0A0C' : '#F5F5F5' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#999' }}>Subject not found</Text>
        </View>
      </SafeAreaView>
    )
  }

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
          <Text className="text-lg font-heading font-bold" style={{ color: isDark ? '#FFDF00' : '#4A0A0B' }} numberOfLines={1}>{parentSubject?.name ?? ''}</Text>
          <Text className="text-xs mt-0.5" style={{ color: textSecondary }}>{parentSubject?.code ?? ''} · Sec {section.section}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <Text className="text-sm font-sans-bold mb-4" style={{ color: textPrimary }}>Subject Information</Text>
          <View className="space-y-4">
            <View className="flex-row items-start gap-3">
              <MaterialIcons name="person" size={18} color="#888" style={{ marginTop: 2 }} />
              <View>
                <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px]" style={{ color: textSecondary }}>Instructor</Text>
                <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>{section.teacherName}</Text>
              </View>
            </View>
            <View className="flex-row items-start gap-3">
              <MaterialIcons name="room" size={18} color="#888" style={{ marginTop: 2 }} />
              <View>
                <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px]" style={{ color: textSecondary }}>Room</Text>
                <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>{section.room}</Text>
              </View>
            </View>
            <View className="flex-row items-start gap-3">
              <MaterialIcons name="school" size={18} color="#888" style={{ marginTop: 2 }} />
              <View>
                <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px]" style={{ color: textSecondary }}>Semester</Text>
                <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>{section.semester}</Text>
              </View>
            </View>
            <View className="flex-row items-start gap-3">
              <MaterialIcons name="calendar-today" size={18} color="#888" style={{ marginTop: 2 }} />
              <View>
                <Text className="text-[10px] font-sans-medium uppercase tracking-[0.5px]" style={{ color: textSecondary }}>Schedule</Text>
                <View className="flex-row flex-wrap gap-1.5 mt-1">
                  {section.schedule.map((sd, i) => (
                    <View key={i} className="flex-row items-center gap-1 px-2 py-1 border" style={{ borderColor: border, backgroundColor: bg }}>
                      <Text className="text-[10px] font-sans-semibold" style={{ color: isDark ? '#FFDF00' : '#7B1113' }}>{sd.day}</Text>
                      <Text className="text-[10px]" style={{ color: textSecondary }}>{sd.startTime}-{sd.endTime}</Text>
                      {sd.room ? <Text className="text-[9px]" style={{ color: textSecondary }}>({sd.room})</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
