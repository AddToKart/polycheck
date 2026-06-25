import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../services/mock-api'
import { useTheme } from '../../../theme/ThemeContext'
import type { Section, Session, SectionRole } from '@polycheck/shared'

export default function StudentSubjectInfoScreen() {
  const { isDark } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [section, setSection] = useState<Section | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [roles, setRoles] = useState<SectionRole[]>([])
  const [hasPermission, setHasPermission] = useState(false)

  useEffect(() => {
    if (!id) return
    const s = api.getSection(id)
    setSection(s ?? null)
    setSessions(api.getSectionSessions(id))
    const cu = api.getCurrentUser()
    if (cu) {
      const studentRoles = api.getStudentRoles(cu.id)
      setRoles(studentRoles)
      if (studentRoles.find(r => r.sectionId === id && r.role === 'president')) {
        setHasPermission(api.checkSessionPermission(id, cu.id))
      }
    }
  }, [id])

  const parentSubject = section ? api.getSubject(section.subjectId) : undefined
  const studentRoles = roles.filter(r => r.sectionId === id)
  const isPresident = studentRoles.some(r => r.role === 'president')
  const isQac = studentRoles.some(r => r.role === 'qac')

  const handleCreateSession = () => {
    const cu = api.getCurrentUser()
    if (!cu || !section) return
    if (!api.checkSessionPermission(id, cu.id)) {
      Alert.alert('Permission Expired', 'Your session creation permission has expired. Ask your teacher to grant a new one.')
      return
    }
    router.push({ pathname: '/(tabs)/subject-info/[id]/create-session', params: { id } })
  }

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
  const textTertiary = isDark ? 'rgba(255,255,255,0.5)' : '#999'
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
        {/* Role badges */}
        {studentRoles.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mb-3">
            {isPresident && (
              <View className="flex-row items-center gap-1 px-2.5 py-1" style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113' }}>
                <MaterialIcons name="star" size={14} color={isDark ? '#4A0A0B' : '#FFF'} />
                <Text className="text-[10px] font-sans-bold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>President</Text>
              </View>
            )}
            {isQac && (
              <View className="flex-row items-center gap-1 px-2.5 py-1" style={{ backgroundColor: '#4A0A0B', borderWidth: 1, borderColor: '#FFDF00' }}>
                <MaterialIcons name="camera-alt" size={14} color="#FFDF00" />
                <Text className="text-[10px] font-sans-bold text-golden">QAC</Text>
              </View>
            )}
          </View>
        )}

        {/* President - Create Session Button */}
        {isPresident && (
          <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
            <View className="flex-row items-center gap-2 mb-2">
              <MaterialIcons name="star" size={18} color={iconColor} />
              <Text className="text-sm font-sans-bold" style={{ color: textPrimary }}>Section President</Text>
            </View>
            <Text className="text-xs mb-2" style={{ color: textSecondary }}>
              {hasPermission ? 'You have permission to create sessions.' : 'No active permission. Ask your teacher.'}
            </Text>
            {hasPermission && (
              <TouchableOpacity
                className="flex-row items-center gap-1 px-4 py-2 self-start"
                style={{ backgroundColor: isDark ? '#FFDF00' : '#7B1113' }}
                onPress={handleCreateSession}
                accessibilityRole="button"
              >
                <MaterialIcons name="add" size={16} color={isDark ? '#4A0A0B' : '#FFF'} />
                <Text className="text-xs font-sans-semibold" style={{ color: isDark ? '#4A0A0B' : '#FFF' }}>Create Session</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

        {/* Sessions List */}
        <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
          <View className="flex-row items-center gap-1.5 mb-3">
            <MaterialIcons name="play-circle-outline" size={18} color={iconColor} />
            <Text className="text-sm font-sans-bold" style={{ color: textPrimary }}>Sessions</Text>
          </View>
          {sessions.length === 0 ? (
            <Text className="text-sm text-center py-4" style={{ color: textTertiary }}>No sessions yet.</Text>
          ) : (
            [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((session) => (
              <TouchableOpacity
                key={session.id}
                className="mb-1.5 p-3 border"
                style={{ backgroundColor: isDark ? '#0A0A0C' : '#F9F9F9', borderColor: border }}
                onPress={() => router.push({ pathname: '/(tabs)/subject-info/[id]/sessions/[sessionId]', params: { id, sessionId: session.id } })}
                accessibilityRole="button"
              >
                <View className="flex-row justify-between items-center">
                  <View className="flex-1">
                    <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>
                      {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text className="text-xs" style={{ color: textSecondary }}>
                      {session.startTime} - {session.endTime}{session.room ? ` · ${session.room}` : ''}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    {session.isActive && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' }} />}
                    {isQac && <MaterialIcons name="camera-alt" size={16} color={iconColor} />}
                    <MaterialIcons name="chevron-right" size={16} color={textTertiary} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
