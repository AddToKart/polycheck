import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import type { AttendanceRecord, AttendanceStatus, Session, Student } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useTheme } from '../../../theme/ThemeContext'
import { CampusHeader } from '../../../components/CampusHeader'
import { AttendanceStatusPill, CampusButton, CampusCard, CampusEmptyState, CampusIconButton, SectionHeading } from '../../../components/CampusPrimitives'
import { AttendanceMetricGrid } from '../../../components/AttendanceReportCards'
import QRCode from 'react-native-qrcode-svg'

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'late', 'absent']
const SESSION_PAGE_SIZE = 5

const IdLabel = ({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) => <View><Text className="font-sans-bold text-[7px] uppercase tracking-[1.4px] text-zinc-500 dark:text-white/45">{label}</Text><Text className={`mt-1 font-sans-bold uppercase text-ink dark:text-white ${prominent ? 'text-lg text-maroon dark:text-golden' : 'text-[10px]'}`} numberOfLines={2}>{value}</Text></View>

export default function StudentDetailScreen() {
  const { isDark, toggle } = useTheme()
  const { id: studentId, sectionId } = useLocalSearchParams<{ id: string; sectionId: string }>()
  const [student, setStudent] = useState<Student | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionPage, setSessionPage] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const flipAnimation = useRef(new Animated.Value(0)).current

  const loadData = useCallback(async () => {
    if (!studentId) return
    let activeSectionId: string | undefined = sectionId
    if (!activeSectionId) {
      const enrollments = await api.getEnrollments()
      activeSectionId = enrollments.find((enrollment) => enrollment.studentId === studentId)?.sectionId
    }
    if (!activeSectionId) { router.back(); return }
    try {
      const [nextStudent, nextSessions, nextRecords] = await Promise.all([api.getStudent(studentId), api.getSectionSessions(activeSectionId), api.getStudentAttendanceForSection(studentId, activeSectionId)])
      setStudent(nextStudent)
      setSessions(nextSessions)
      setRecords(nextRecords)
    } catch { router.back(); return }
    setLoading(false)
  }, [sectionId, studentId])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion) }, [])

  const flip = () => {
    Animated.timing(flipAnimation, { toValue: isFlipped ? 0 : 180, duration: reduceMotion ? 0 : 450, useNativeDriver: true }).start()
    setIsFlipped((value) => !value)
  }

  if (loading || !student) return <SafeAreaView className="flex-1 items-center justify-center bg-campus dark:bg-campus-dark"><ActivityIndicator size="large" color={isDark ? '#FFDF00' : '#7B1113'} /><Text className="mt-4 font-sans text-sm text-muted dark:text-zinc-400">Loading student profile…</Text></SafeAreaView>

  const isTeacher = api.getCurrentUser()?.role === 'teacher'
  const frontRotation = flipAnimation.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] })
  const backRotation = flipAnimation.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] })
  const totalPresent = records.filter((record) => record.status === 'present').length
  const totalLate = records.filter((record) => record.status === 'late').length
  const totalAbsent = records.filter((record) => record.status === 'absent').length
  const sessionPageCount = Math.max(1, Math.ceil(sessions.length / SESSION_PAGE_SIZE))
  const pagedSessions = sessions.slice(sessionPage * SESSION_PAGE_SIZE, (sessionPage + 1) * SESSION_PAGE_SIZE)

  const remove = () => {
    if (!sectionId || !studentId) return
    Alert.alert('Remove student?', `${student.fullName} will be removed from this section.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void api.removeStudentFromSection(sectionId, studentId).then(() => router.back()) } },
    ])
  }

  const cycleStatus = async (record: AttendanceRecord) => {
    const currentIndex = STATUS_CYCLE.indexOf(record.status)
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
    await api.updateAttendanceStatus(record.id, nextStatus)
    setRecords((previous) => previous.map((item) => item.id === record.id ? { ...item, status: nextStatus } : item))
  }

  const addAbsent = async (session: Session) => {
    if (records.some((record) => record.sessionId === session.id)) return
    const newRecord: AttendanceRecord = { id: `a-manual-${Date.now()}`, sessionId: session.id, sectionId: sectionId!, studentId: studentId!, studentName: student.fullName, studentProgram: student.program, timestamp: new Date().toISOString(), status: 'absent', coordinates: { latitude: 0, longitude: 0 }, isSynced: false, notes: 'Manually marked by teacher', manuallySet: true }
    await api.addAttendanceRecord(newRecord)
    setRecords((previous) => [...previous, newRecord])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader
        eyebrow="Student record"
        title={student.fullName}
        subtitle={`${student.studentId} · ${student.program}`}
        onBack={() => router.back()}
        actions={<CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
      <SectionHeading eyebrow="Digital credential" title="PUP student ID" />
      <Pressable accessibilityRole="button" accessibilityLabel={`Student ID card, showing ${isFlipped ? 'back' : 'front'}. Tap to flip.`} accessibilityHint="Shows identity and verification details" onPress={flip} className="mb-3 w-full self-center" style={{ maxWidth: 390, aspectRatio: 1.586 }}>
        <Animated.View pointerEvents={isFlipped ? 'none' : 'auto'} className="absolute h-full w-full overflow-hidden rounded-[26px] border-2 border-maroon/20 bg-[#FDFBF7] shadow-lg dark:border-golden/20 dark:bg-[#151013]" style={{ backfaceVisibility: 'hidden', transform: [{ rotateY: frontRotation }] }}>
          <View className="flex-row items-center gap-3 bg-maroon px-4 py-3"><Image source={require('../../../assets/pup-logo.png')} className="h-9 w-9" /><View className="flex-1"><Text className="font-sans-bold text-[8px] uppercase tracking-[1.5px] text-golden">Polytechnic University of the Philippines</Text><Text className="mt-1 font-sans-bold text-[10px] uppercase tracking-[1px] text-white">Student identification card</Text></View></View>
          <View className="flex-1 flex-row">
            <View className="w-[34%] items-center justify-center border-r-2 border-maroon/15 p-3 dark:border-golden/15"><View className="aspect-[3/4] w-full items-center justify-center rounded-xl border-2 border-maroon/15 bg-white dark:border-golden/15 dark:bg-zinc-900"><View className="h-12 w-12 items-center justify-center rounded-full bg-maroon dark:bg-golden"><Text className="font-heading text-xl text-white dark:text-maroon-dark">{student.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text></View></View><View className="mt-3 h-5 w-full justify-end border-b border-zinc-400"><Text className="text-center font-sans text-[6px] text-zinc-500 dark:text-zinc-400">SIGNATURE</Text></View></View>
            <View className="flex-1 justify-center gap-3 p-4"><IdLabel label="Student number" value={student.studentId} prominent /><IdLabel label="Full name" value={student.fullName} /><View className="flex-row gap-3"><View className="flex-1"><IdLabel label="Program" value={student.program} /></View><View className="flex-1"><IdLabel label="Validity" value="2026–2027" /></View></View></View>
          </View>
        </Animated.View>

        <Animated.View pointerEvents={isFlipped ? 'auto' : 'none'} className="absolute h-full w-full overflow-hidden rounded-[26px] border-2 border-maroon/20 bg-[#FDFBF7] shadow-lg dark:border-golden/20 dark:bg-[#151013]" style={{ backfaceVisibility: 'hidden', transform: [{ rotateY: backRotation }] }}>
          <View className="mt-4 h-12 w-full bg-zinc-900" />
          <View className="flex-1 flex-row p-4"><View className="flex-[2] justify-between pr-4"><View><Text className="font-sans-bold text-[8px] uppercase tracking-[1.5px] text-maroon dark:text-golden">Conditions of use</Text><Text className="mt-2 font-sans text-[8px] leading-3 text-zinc-600 dark:text-zinc-300">This card is non-transferable and remains the property of PUP. Report a lost card immediately.</Text></View><View><Text className="font-sans-bold text-[7px] uppercase tracking-[1px] text-zinc-500">In case of emergency</Text><View className="mt-2 h-4 border-b border-zinc-400" /><View className="mt-1 h-4 border-b border-zinc-400" /></View></View><View className="flex-1 items-center justify-center border-l-2 border-dashed border-maroon/15 pl-4 dark:border-golden/15"><View className="rounded-xl bg-white p-1"><QRCode value={student.studentId} size={70} backgroundColor="#FFFFFF" color="#0A0A0A" /></View><Text className="mt-2 text-center font-sans-bold text-[6px] tracking-[1.5px] text-zinc-500">SCAN TO VERIFY</Text></View></View>
        </Animated.View>
      </Pressable>
      <Text className="mb-7 text-center font-sans-bold text-[10px] uppercase tracking-[1.3px] text-muted dark:text-zinc-500">Tap the card to view the {isFlipped ? 'front' : 'back'}</Text>

      {isTeacher ? <CampusButton label="Remove from section" icon="person-remove" variant="secondary" onPress={remove} className="mb-7 border-red-300 dark:border-red-800" /> : null}

      <SectionHeading eyebrow="Attendance" title="Student performance" />
      <AttendanceMetricGrid metrics={[{ label: 'Present', value: totalPresent, tone: 'success' }, { label: 'Late', value: totalLate, tone: 'warning' }, { label: 'Absent', value: totalAbsent, tone: 'danger' }]} />
      <View className="mb-4"><Text className="font-sans-bold text-sm text-ink dark:text-white">Attendance per session</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{sessions.length} sessions · Tap a status to cycle it.</Text></View>
      <View className="gap-3">{pagedSessions.map((session) => {
        const record = records.find((item) => item.sessionId === session.id)
        return <CampusCard key={session.id} className="p-4"><View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10"><Text className="font-heading text-base text-maroon dark:text-golden">{new Date(session.date).getDate()}</Text></View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{new Date(session.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric' })}</Text><Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{session.startTime}–{session.endTime}{session.room ? ` · ${session.room}` : ''}</Text></View>{record ? <Pressable disabled={!isTeacher} accessibilityRole={isTeacher ? 'button' : undefined} accessibilityLabel={isTeacher ? `Change status, currently ${record.status}` : undefined} onPress={() => void cycleStatus(record)} className="min-h-11 justify-center"><AttendanceStatusPill status={record.status} /></Pressable> : <Pressable disabled={!isTeacher} accessibilityRole={isTeacher ? 'button' : undefined} accessibilityLabel={isTeacher ? 'Mark absent' : undefined} onPress={() => void addAbsent(session)} className="min-h-11 justify-center rounded-full border border-line px-3 dark:border-line-dark"><Text className="font-sans-bold text-[10px] text-muted dark:text-zinc-400">No record</Text></Pressable>}</View></CampusCard>
      })}{!sessions.length ? <CampusEmptyState icon="event-busy" title="No sessions yet" description="Attendance will appear after the first class meeting is created." /> : null}</View>
      {sessionPageCount > 1 ? <View className="mt-5 flex-row items-center gap-3"><CampusButton className="flex-1" label="Previous" variant="secondary" disabled={sessionPage === 0} onPress={() => setSessionPage((value) => Math.max(0, value - 1))} /><Text className="font-sans-bold text-xs text-muted dark:text-zinc-400">{sessionPage + 1}/{sessionPageCount}</Text><CampusButton className="flex-1" label="Next" variant="secondary" disabled={sessionPage === sessionPageCount - 1} onPress={() => setSessionPage((value) => Math.min(sessionPageCount - 1, value + 1))} /></View> : null}
    </ScrollView>
  </SafeAreaView>
)
}
