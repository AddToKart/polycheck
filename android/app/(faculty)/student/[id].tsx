import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Animated, TouchableOpacity, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../services/mock-api'
import { useTheme } from '../../../theme/ThemeContext'
import type { Student, Session, AttendanceRecord, AttendanceStatus } from '@polycheck/shared'

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent']

const statusLabel: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  pending: 'Pending',
  disputed: 'Disputed',
}

const SESSION_PAGE_SIZE = 5

export default function StudentDetailScreen() {
  const { isDark } = useTheme()
  const { id: studentId, subjectId } = useLocalSearchParams<{ id: string; subjectId: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionPage, setSessionPage] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const flipAnim = useRef(new Animated.Value(0)).current

  const loadData = useCallback(() => {
    if (!studentId || !subjectId) return
    const s = api.getStudent(studentId)
    if (!s) { router.back(); return }
    setStudent(s)
    setSessions(api.getSectionSessions(subjectId))
    setRecords(api.getStudentAttendanceForSection(studentId, subjectId))
    setLoading(false)
  }, [studentId, subjectId])

  useEffect(() => { loadData() }, [loadData])

  const handleFlip = () => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 0 : 180,
      duration: 500,
      useNativeDriver: true,
    }).start()
    setIsFlipped(!isFlipped)
  }

  const frontInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] })
  const backInterpolate = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] })

  const handleRemove = () => {
    if (!subjectId || !studentId) return
    Alert.alert(
      'Remove Student',
      `Remove ${student?.fullName} from this subject? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            api.removeStudentFromSection(subjectId, studentId)
            router.back()
          },
        },
      ],
    )
  }

  const handleCycleStatus = (record: AttendanceRecord) => {
    const currentIdx = STATUS_CYCLE.indexOf(record.status)
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length]
    api.updateAttendanceStatus(record.id, nextStatus)
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status: nextStatus } : r))
    )
  }

  const handleAddAbsent = (session: Session) => {
    const existing = records.find((r) => r.sessionId === session.id)
    if (existing) return
    const newRecord: AttendanceRecord = {
      id: `a-manual-${Date.now()}`,
      sessionId: session.id,
      sectionId: subjectId!,
      studentId: studentId!,
      studentName: student?.fullName ?? '',
      studentProgram: student?.program,
      timestamp: new Date().toISOString(),
      status: 'absent',
      coordinates: { latitude: 0, longitude: 0 },
      isSynced: false,
      notes: 'Manually marked by teacher',
    }
    api.addAttendanceRecord(newRecord)
    setRecords((prev) => [...prev, newRecord])
  }

  const getBadgeStyle = (status: AttendanceStatus) => {
    if (isDark) {
      switch (status) {
        case 'present':
          return { bg: 'rgba(245, 168, 0, 0.15)', text: '#FFDF00', border: 'rgba(245, 168, 0, 0.3)' }
        case 'late':
          return { bg: 'rgba(123, 17, 19, 0.3)', text: '#FFFFFF', border: 'rgba(123, 17, 19, 0.5)' }
        case 'absent':
          return { bg: 'rgba(74, 10, 11, 0.4)', text: '#FFDF00', border: '#FFDF00' }
        default:
          return { bg: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.7)' }
      }
    } else {
      switch (status) {
        case 'present':
          return { bg: '#FFF5E0', text: '#FFDF00' }
        case 'late':
          return { bg: '#FDE8E8', text: '#7B1113' }
        case 'absent':
          return { bg: '#F0F0F0', text: '#4A0A0B' }
        default:
          return { bg: '#F0F0F0', text: '#666' }
      }
    }
  }

  if (loading || !student) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: isDark ? '#0A0A0C' : '#F5F5F5' }}>
        <ActivityIndicator size="large" color={isDark ? '#FFDF00' : '#7B1113'} />
      </SafeAreaView>
    )
  }

  const getRecordForSession = (sessionId: string) =>
    records.find((r) => r.sessionId === sessionId)

  const bg = isDark ? '#0A0A0C' : '#F5F5F5'
  const surface = isDark ? '#121215' : '#FFFFFF'
  const surfaceDark = isDark ? '#0A0A0C' : '#FDFBF7'
  const border = isDark ? 'rgba(245, 168, 0, 0.15)' : '#EEE'
  const borderCard = isDark ? 'rgba(245, 168, 0, 0.2)' : '#D4D4D8'
  const textPrimary = isDark ? '#FFFFFF' : '#333'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888'
  const iconColor = isDark ? '#FFDF00' : '#7B1113'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => router.back()} className="p-1 mr-3 active:opacity-70" accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={iconColor} />
        </Pressable>
        <Text className="text-lg font-heading font-bold flex-1" style={{ color: isDark ? '#FFDF00' : '#4A0A0B' }} numberOfLines={1}>
          {student.fullName}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* Flippable ID Card */}
        <TouchableOpacity activeOpacity={1} onPress={handleFlip} style={{ width: '100%', maxWidth: 384, aspectRatio: 1.586, alignSelf: 'center', marginBottom: 20 }}>
          {/* Front Face */}
          <Animated.View
            style={{
              width: '100%', height: '100%', borderWidth: 2, borderColor: borderCard,
              backgroundColor: isDark ? '#121215' : '#FFFFFF', flexDirection: 'column', overflow: 'hidden',
              transform: [{ rotateY: frontInterpolate }], backfaceVisibility: 'hidden',
            }}
          >
            {/* Card Header */}
            <View style={{ backgroundColor: '#7B1113', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image source={require('../../../assets/pup-logo.png')} style={{ width: 32, height: 32 }} />
              <View>
                <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFDF00', textTransform: 'uppercase', letterSpacing: 1, lineHeight: 10, marginBottom: 2 }}>
                  Republic of the Philippines
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1, lineHeight: 12 }}>
                  Polytechnic University of the Philippines
                </Text>
              </View>
            </View>

            {/* Card Body */}
            <View style={{ flex: 1, flexDirection: 'row', backgroundColor: surfaceDark }}>
              {/* Left: Photo */}
              <View style={{ width: '33%', borderRightWidth: 2, borderRightColor: borderCard, padding: 12, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: '100%', aspectRatio: 3 / 4, backgroundColor: isDark ? '#121215' : '#FFFFFF', borderWidth: 2, borderColor: borderCard, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 48, height: 48, backgroundColor: isDark ? '#27272A' : '#CCC', alignItems: 'center', justifyContent: 'center' }}>
                    <Text className="font-heading font-bold" style={{ fontSize: 24, color: isDark ? '#FFDF00' : '#FFF' }}>
                      {student.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={{ width: '100%', marginTop: 'auto' }}>
                  <View style={{ borderBottomWidth: 2, borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#27272A', height: 20, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Text style={{ fontSize: 7, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)' }}>SIGNATURE</Text>
                  </View>
                </View>
              </View>

              {/* Right: Details */}
              <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 1.5, color: isDark ? 'rgba(255,255,255,0.5)' : '#71717A', fontWeight: '700', marginBottom: 2 }}>Student Number</Text>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: isDark ? '#FFDF00' : '#7B1113' }}>{student.studentId}</Text>
                </View>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 1.5, color: isDark ? 'rgba(255,255,255,0.5)' : '#71717A', fontWeight: '700', marginBottom: 2 }}>Full Name</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', textTransform: 'uppercase', lineHeight: 20, color: isDark ? '#FFFFFF' : '#18181B' }}>{student.fullName}</Text>
                </View>
                <View className="flex-row gap-4">
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 1.5, color: isDark ? 'rgba(255,255,255,0.5)' : '#71717A', fontWeight: '700', marginBottom: 2 }}>Program</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#FFFFFF' : '#18181B' }}>{student.program}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 1.5, color: isDark ? 'rgba(255,255,255,0.5)' : '#71717A', fontWeight: '700', marginBottom: 2 }}>Validity</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#FFFFFF' : '#18181B' }}>2026-2027</Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Back Face */}
          <Animated.View
            style={{
              width: '100%', height: '100%', borderWidth: 2, borderColor: borderCard,
              backgroundColor: isDark ? '#121215' : '#FFFFFF', flexDirection: 'column', overflow: 'hidden',
              transform: [{ rotateY: backInterpolate }], backfaceVisibility: 'hidden',
              position: 'absolute', top: 0,
            }}
          >
            <View style={{ backgroundColor: '#18181B', height: 48, width: '100%', marginTop: 16 }} />
            <View style={{ flex: 1, flexDirection: 'row', padding: 16 }}>
              <View style={{ flex: 2, paddingRight: 16, justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: isDark ? '#FFDF00' : '#7B1113', marginBottom: 4 }}>Conditions of Use</Text>
                  <Text style={{ fontSize: 8, lineHeight: 11, color: isDark ? 'rgba(255,255,255,0.7)' : '#52525B', textAlign: 'justify' }}>
                    This card is non-transferable and must be presented upon entry to the university premises. The finder of this lost card is requested to surrender it to the Office of Student Affairs.
                  </Text>
                </View>
                <View style={{ marginTop: 'auto' }}>
                  <Text style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: 1, color: isDark ? 'rgba(255,255,255,0.5)' : '#71717A', fontWeight: '700', marginBottom: 4 }}>
                    In case of emergency, contact:
                  </Text>
                  <View style={{ borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.2)' : '#A1A1AA', height: 20 }} />
                  <View style={{ borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.2)' : '#A1A1AA', height: 20, marginTop: 4 }} />
                </View>
              </View>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 2, borderLeftColor: isDark ? 'rgba(245, 168, 0, 0.15)' : '#D4D4D8', borderStyle: 'dashed', paddingLeft: 16 }}>
                <View style={{ width: '100%', aspectRatio: 1, backgroundColor: isDark ? '#0A0A0C' : '#F4F4F5', borderWidth: 2, borderColor: isDark ? 'rgba(245, 168, 0, 0.15)' : '#D4D4D8', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                  <MaterialIcons name="qr-code" size={48} color={isDark ? '#FFDF00' : '#000'} />
                </View>
                <Text style={{ fontSize: 6, marginTop: 8, color: isDark ? 'rgba(255,255,255,0.5)' : '#71717A', textAlign: 'center', letterSpacing: 2 }}>SCAN TO VERIFY</Text>
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <Text className="text-center text-[11px] font-bold uppercase tracking-wider mb-6" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#71717A' }}>
          Tap card to flip
        </Text>

        {/* Remove from Subject */}
        <Pressable
          className="flex-row items-center justify-center gap-2 border py-3 mb-6 active:opacity-70"
          style={{ borderColor: '#EF4444', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}
          onPress={handleRemove}
        >
          <MaterialIcons name="person-remove" size={18} color="#EF4444" />
          <Text className="text-red-500 text-sm font-sans-semibold">Remove from Subject</Text>
        </Pressable>

        {/* Attendance Manipulation */}
        <Text className="text-base font-sans-bold mb-1" style={{ color: textPrimary }}>Attendance per Session</Text>
        <Text className="text-[11px] mb-3" style={{ color: textSecondary }}>
          Tap a status badge to cycle between Present → Late → Absent
        </Text>

        {sessions.length === 0 ? (
          <Text className="text-center py-10" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#BBB' }}>No sessions created yet.</Text>
        ) : (
          <>
            {sessions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(sessionPage * SESSION_PAGE_SIZE, (sessionPage + 1) * SESSION_PAGE_SIZE)
              .map((session) => {
                const record = getRecordForSession(session.id)
                return (
                  <View key={session.id} className="flex-row justify-between items-center p-3.5 mb-2 border" style={{ backgroundColor: surface, borderColor: border }}>
                    <View className="flex-1">
                      <Text className="text-sm font-sans-semibold" style={{ color: textPrimary }}>
                        {new Date(session.date).toLocaleDateString('en-PH', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </Text>
                      <Text className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
                        {session.startTime} – {session.endTime}
                      </Text>
                    </View>

                    <View className="ml-3">
                      {record ? (
                        <Pressable
                          onPress={() => handleCycleStatus(record)}
                          className="flex-row items-center gap-1 px-2.5 py-1.5 active:opacity-70"
                          style={{
                            backgroundColor: getBadgeStyle(record.status).bg,
                            borderWidth: getBadgeStyle(record.status).border ? 1 : 0,
                            borderColor: getBadgeStyle(record.status).border,
                          }}
                        >
                          <Text
                            className="text-xs font-sans-semibold"
                            style={{ color: getBadgeStyle(record.status).text }}
                          >
                            {statusLabel[record.status]}
                          </Text>
                          <MaterialIcons name="sync" size={14} color={getBadgeStyle(record.status).text} />
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => handleAddAbsent(session)}
                          className="flex-row items-center gap-1 px-2.5 py-1.5 active:opacity-70"
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F0F0F0',
                            borderWidth: isDark ? 1 : 0,
                            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'transparent',
                          }}
                        >
                          <Text className="text-xs font-sans-semibold" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#4A0A0B' }}>No Record</Text>
                          <MaterialIcons name="add" size={14} color={isDark ? 'rgba(255,255,255,0.5)' : '#4A0A0B'} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                )
              })}
            {/* Session Pagination */}
            {(() => {
              const spc = Math.max(1, Math.ceil(sessions.length / SESSION_PAGE_SIZE))
              if (spc <= 1) return null
              return (
                <View className="flex-row justify-center items-center gap-1.5 mt-4 mb-6">
                  <TouchableOpacity
                    className="w-9 h-9 items-center justify-center border"
                    style={{ borderColor: border, backgroundColor: surface, opacity: sessionPage === 0 ? 0.4 : 1 }}
                    onPress={() => setSessionPage(Math.max(0, sessionPage - 1))}
                    disabled={sessionPage === 0}
                    accessibilityLabel="Previous session page"
                  >
                    <MaterialIcons name="chevron-left" size={20} color={sessionPage === 0 ? (isDark ? 'rgba(255,255,255,0.2)' : '#CCC') : iconColor} />
                  </TouchableOpacity>
                  {Array.from({ length: spc }, (_, i) => (
                    <TouchableOpacity
                      key={i}
                      className="w-9 h-9 items-center justify-center border"
                      style={{
                        borderColor: i === sessionPage ? (isDark ? '#FFDF00' : '#7B1113') : border,
                        backgroundColor: i === sessionPage ? (isDark ? '#FFDF00' : '#7B1113') : surface,
                      }}
                      onPress={() => setSessionPage(i)}
                    >
                      <Text className="text-sm font-sans-semibold" style={{ color: i === sessionPage ? (isDark ? '#4A0A0B' : '#FFF') : (isDark ? 'rgba(255,255,255,0.7)' : '#555') }}>{i + 1}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    className="w-9 h-9 items-center justify-center border"
                    style={{ borderColor: border, backgroundColor: surface, opacity: sessionPage === spc - 1 ? 0.4 : 1 }}
                    onPress={() => setSessionPage(Math.min(spc - 1, sessionPage + 1))}
                    disabled={sessionPage === spc - 1}
                    accessibilityLabel="Next session page"
                  >
                    <MaterialIcons name="chevron-right" size={20} color={sessionPage === spc - 1 ? (isDark ? 'rgba(255,255,255,0.2)' : '#CCC') : iconColor} />
                  </TouchableOpacity>
                </View>
              )
            })()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
