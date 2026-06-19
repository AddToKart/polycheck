import { useCallback, useMemo, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'

export default function DashboardScreen() {
  const { isDark, toggle } = useTheme()
  const [refreshing, setRefreshing] = useState(false)
  const user = api.getCurrentUser()
  const student = user && 'studentId' in user
    ? (user as typeof user & { studentId: string; program: string; yearLevel: number })
    : null
  const mySections = student ? api.getStudentSections(student.studentId) : []
  const myAttendance = student ? api.getMyAttendance(student.studentId) : []

  const present = myAttendance.filter((r) => r.status === 'present').length
  const late = myAttendance.filter((r) => r.status === 'late').length
  const absent = myAttendance.filter((r) => r.status === 'absent').length
  const attendanceRate = myAttendance.length > 0 ? ((present / myAttendance.length) * 100).toFixed(0) : '0'

  const todaySchedule = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const todayName = dayNames[new Date().getDay()]
    return mySections.filter((s) => s.schedule.some((sd) => sd.day === todayName))
  }, [mySections])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1000)
  }, [])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  const handleSubjectTap = (sectionId: string) => {
    router.push(`/(tabs)/subject-info/${sectionId}`)
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View>
          <Text style={[styles.greeting, isDark && styles.textWhite50]}>{greeting()}</Text>
          <Text style={[styles.name, isDark && styles.textGolden]}>{student?.fullName.split(' ')[0] ?? 'Student'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggle} style={styles.iconBtn} accessibilityLabel="Toggle theme">
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={24} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={24} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#F5A800' : '#7B1113'} />}
      >
        {/* Student info card */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.programText, isDark && styles.textGolden]}>{student?.program ?? 'N/A'}</Text>
          <View style={[styles.cardRow, isDark && styles.cardRowDark]}>
            <Text style={[styles.cardRowLabel, isDark && styles.textWhite50]}>Year Level</Text>
            <Text style={[styles.cardRowValue, isDark && styles.textWhite]}>Year {student?.yearLevel ?? 'N/A'}</Text>
          </View>
          <View style={styles.cardRowLast}>
            <Text style={[styles.cardRowLabel, isDark && styles.textWhite50]}>Student ID</Text>
            <Text style={[styles.cardRowValue, isDark && styles.textWhite]}>{student?.studentId ?? 'N/A'}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="book" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
            <Text style={[styles.statNum, isDark && styles.textGolden]}>{mySections.length}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Subjects</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="trending-up" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
            <Text style={[styles.statNum, isDark && styles.textGolden]}>{attendanceRate}%</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Rate</Text>
          </View>
        </View>

        {/* Attendance breakdown */}
        <View style={[styles.attendanceCard, isDark && styles.cardDark]}>
          <View style={styles.attendanceItem}>
            <Text style={styles.attendanceNum}>{present}</Text>
            <Text style={[styles.attendanceLabel, isDark && styles.textWhite50]}>Present</Text>
          </View>
          <View style={styles.attendanceItem}>
            <Text style={[styles.attendanceNum, { color: isDark ? '#F5A800' : '#7B1113' }]}>{late}</Text>
            <Text style={[styles.attendanceLabel, isDark && styles.textWhite50]}>Late</Text>
          </View>
          <View style={styles.attendanceItem}>
            <Text style={[styles.attendanceNum, { color: isDark ? '#EF4444' : '#4A0A0B' }]}>{absent}</Text>
            <Text style={[styles.attendanceLabel, isDark && styles.textWhite50]}>Absent</Text>
          </View>
        </View>

        {/* Today's schedule */}
        <Text style={[styles.sectionTitle, isDark && styles.textGolden]}>Today's Schedule</Text>

        {todaySchedule.length === 0 ? (
          <View style={[styles.emptyCard, isDark && styles.cardDark]}>
            <MaterialIcons name="event-busy" size={32} color="#CCC" />
            <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No classes today</Text>
          </View>
        ) : (
          todaySchedule.map((section) => {
            const parent = api.getSubject(section.subjectId)
            const todaySD = section.schedule.find(
              (sd) => sd.day === ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()],
            )
            const status = myAttendance.find((r) => r.sectionId === section.id)?.status ?? 'pending'
            return (
              <TouchableOpacity
                key={section.id}
                style={[styles.schedCard, isDark && styles.cardDark]}
                onPress={() => handleSubjectTap(section.id)}
                activeOpacity={0.7}
              >
                <View style={styles.schedLeft}>
                  <Text style={[styles.schedTime, isDark && styles.textGolden]}>
                    {todaySD?.startTime} - {todaySD?.endTime}
                  </Text>
                  <Text style={[styles.schedName, isDark && styles.textWhite]}>{parent?.name ?? ''}</Text>
                  <Text style={[styles.schedRoom, isDark && styles.textWhite50]}>{section.room}</Text>
                </View>
                <View style={[styles.schedRight, isDark && styles.schedRightDark]}>
                  <View style={styles.schedMeta}>
                    <Text style={[styles.schedCode, isDark && styles.textWhite50]}>{parent?.code ?? ''}</Text>
                    <Text style={[styles.schedSection, isDark && styles.textWhite50]}>Sec {section.section}</Text>
                  </View>
                  <StatusBadge status={status} />
                </View>
              </TouchableOpacity>
            )
          })
        )}

        {/* My Subjects (all enrolled) */}
        <Text style={[styles.sectionTitle, isDark && styles.textGolden, { marginTop: 24 }]}>My Subjects</Text>
        {mySections.length === 0 ? (
          <View style={[styles.emptyCard, isDark && styles.cardDark]}>
            <MaterialIcons name="book" size={32} color="#CCC" />
            <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No enrollments yet</Text>
          </View>
        ) : (
          mySections.map((section) => {
            const parent = api.getSubject(section.subjectId)
            const presentCount = myAttendance.filter((r) => r.sectionId === section.id && r.status === 'present').length
            return (
              <TouchableOpacity
                key={section.id}
                style={[styles.allSubjCard, isDark && styles.cardDark]}
                onPress={() => handleSubjectTap(section.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.allSubjAccent, isDark && styles.allSubjAccentDark]} />
                <View style={styles.allSubjBody}>
                  <Text style={[styles.allSubjName, isDark && styles.textWhite]}>{parent?.name ?? ''}</Text>
                  <Text style={[styles.allSubjMeta, isDark && styles.textWhite50]}>
                    {parent?.code ?? ''} · Sec {section.section}
                  </Text>
                  <View style={styles.allSubjDetails}>
                    <View style={styles.allSubjDetailRow}>
                      <MaterialIcons name="person" size={12} color="#888" />
                      <Text style={[styles.allSubjDetailText, isDark && styles.textWhite50]}>{section.teacherName}</Text>
                    </View>
                    <View style={styles.allSubjDetailRow}>
                      <MaterialIcons name="room" size={12} color="#888" />
                      <Text style={[styles.allSubjDetailText, isDark && styles.textWhite50]}>{section.room}</Text>
                    </View>
                    <View style={styles.allSubjDetailRow}>
                      <MaterialIcons name="calendar-today" size={12} color="#888" />
                      <Text style={[styles.allSubjDetailText, isDark && styles.textWhite50]}>
                        {section.schedule.map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join(', ')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.allSubjFooter}>
                    <View style={[styles.allSubjRateBg, isDark && styles.allSubjRateBgDark]}>
                      <View style={[styles.allSubjRateFill, { width: `${myAttendance.filter((r) => r.sectionId === section.id).length > 0 ? Math.round((presentCount / myAttendance.filter((r) => r.sectionId === section.id).length) * 100) : 0}%` }]} />
                    </View>
                    <Text style={[styles.allSubjRateText, isDark && styles.textWhite50]}>
                      {myAttendance.filter((r) => r.sectionId === section.id).length > 0
                        ? `${Math.round((presentCount / myAttendance.filter((r) => r.sectionId === section.id).length) * 100)}%`
                        : '—'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme()
  const configs: Record<string, { bg: string; text: string }> = {
    present: { bg: '#F5A800', text: '#4A0A0B' },
    late: { bg: isDark ? 'rgba(245, 168, 0, 0.15)' : '#7B1113', text: isDark ? '#F5A800' : '#FFFFFF' },
    absent: { bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#4A0A0B', text: isDark ? '#EF4444' : '#F5A800' },
    pending: { bg: 'transparent', text: isDark ? '#F5A800' : '#7B1113' },
  }
  const c = configs[status] || configs.pending
  return (
    <View style={[
      styles.badge,
      { backgroundColor: c.bg },
      status === 'pending' && (isDark ? styles.badgeBorderGolden : styles.badgeBorder),
      status === 'late' && isDark && { borderWidth: 1, borderColor: '#F5A800' },
      status === 'absent' && isDark && { borderWidth: 1, borderColor: '#EF4444' }
    ]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  greeting: { fontSize: 10, fontWeight: '700', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 },
  name: { fontSize: 24, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },

  card: {
    borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FFFFFF',
    padding: 20, marginBottom: 16,
  },
  cardDark: { borderColor: 'rgba(245, 168, 0, 0.2)', backgroundColor: '#121215' },
  programText: { fontSize: 20, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113', marginBottom: 16 },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E4E4E7', paddingBottom: 8, marginBottom: 8 },
  cardRowDark: { borderBottomColor: '#27272A' },
  cardRowLast: { flexDirection: 'row', justifyContent: 'space-between' },
  cardRowLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#71717A' },
  cardRowValue: { fontSize: 14, fontWeight: '700', color: '#000000' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FFFFFF',
    padding: 16, alignItems: 'center', gap: 8,
  },
  statNum: { fontSize: 24, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#71717A' },

  attendanceCard: {
    flexDirection: 'row', justifyContent: 'space-around',
    borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FFFFFF',
    padding: 20, marginBottom: 24,
  },
  attendanceItem: { alignItems: 'center' },
  attendanceNum: { fontSize: 24, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#F5A800' },
  attendanceLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#71717A', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#000000', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 },

  emptyCard: {
    borderWidth: 2, borderColor: '#D4D4D8', borderStyle: 'dashed',
    backgroundColor: '#FAFAFA', padding: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 40,
  },
  emptyText: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#71717A', marginTop: 16 },

  schedCard: {
    borderWidth: 2, borderColor: '#D4D4D8', backgroundColor: '#FFFFFF',
    padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between',
  },
  schedLeft: { flex: 1, paddingRight: 16 },
  schedTime: { fontSize: 11, fontWeight: '700', color: '#7B1113', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  schedName: { fontSize: 16, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#000000', marginBottom: 8 },
  schedRoom: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#71717A' },
  schedRight: {
    alignItems: 'flex-end', justifyContent: 'space-between',
    borderLeftWidth: 2, borderLeftColor: '#E4E4E7', borderStyle: 'dashed', paddingLeft: 16,
  },
  schedRightDark: { borderLeftColor: '#27272A' },
  schedMeta: { alignItems: 'flex-end' },
  schedCode: { fontSize: 12, fontWeight: '700', color: '#52525B' },
  schedSection: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: '#A1A1AA' },

  badge: { paddingHorizontal: 8, paddingVertical: 4 },
  badgeBorder: { borderWidth: 2, borderColor: '#7B1113' },
  badgeBorderGolden: { borderWidth: 2, borderColor: '#F5A800' },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#F5A800' },

  allSubjCard: { backgroundColor: '#FFFFFF', borderRadius: 0, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, flexDirection: 'row' },
  allSubjAccent: { width: 4, backgroundColor: '#7B1113' },
  allSubjAccentDark: { backgroundColor: '#F5A800' },
  allSubjBody: { padding: 14, flex: 1 },
  allSubjName: { fontSize: 15, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#333' },
  allSubjMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  allSubjDetails: { marginTop: 8, gap: 4 },
  allSubjDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allSubjDetailText: { fontSize: 11, color: '#888', flex: 1 },
  allSubjFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  allSubjRateBg: { flex: 1, height: 4, backgroundColor: '#EEE', borderRadius: 2 },
  allSubjRateBgDark: { backgroundColor: '#333' },
  allSubjRateFill: { height: 4, backgroundColor: '#F5A800', borderRadius: 2 },
  allSubjRateText: { fontSize: 10, fontWeight: '700', color: '#888', minWidth: 30, textAlign: 'right' },
})