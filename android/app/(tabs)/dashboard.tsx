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
  const mySections = student ? api.getStudentSections(student.id) : []
  const myAttendance = student ? api.getMyAttendance(student.id) : []

  const present = myAttendance.filter((r) => r.status === 'present').length
  const late = myAttendance.filter((r) => r.status === 'late').length
  const absent = myAttendance.filter((r) => r.status === 'absent').length
  const disputed = myAttendance.filter((r) => r.status === 'disputed').length
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
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#FFDF00' : '#7B1113'} />}
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
            <MaterialIcons name="book" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.statNum, isDark && styles.textGolden]}>{mySections.length}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Subjects</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="trending-up" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
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
            <Text style={[styles.attendanceNum, { color: isDark ? '#FFDF00' : '#7B1113' }]}>{late}</Text>
            <Text style={[styles.attendanceLabel, isDark && styles.textWhite50]}>Late</Text>
          </View>
          <View style={styles.attendanceItem}>
            <Text style={[styles.attendanceNum, { color: isDark ? '#EF4444' : '#4A0A0B' }]}>{absent}</Text>
            <Text style={[styles.attendanceLabel, isDark && styles.textWhite50]}>Absent</Text>
          </View>
          <View style={styles.attendanceItem}>
            <Text style={[styles.attendanceNum, { color: isDark ? '#FFDF00' : '#4A0A0B' }]}>{disputed}</Text>
            <Text style={[styles.attendanceLabel, isDark && styles.textWhite50]}>Disputed</Text>
          </View>
        </View>

        {/* Today's schedule */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, isDark && styles.textGolden, { marginBottom: 0 }]}>Today's Schedule</Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/schedule')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: isDark ? '#FFDF00' : '#7B1113' }}
          >
            <MaterialIcons name="calendar-today" size={14} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={{ fontSize: 10, fontWeight: '700', fontFamily: 'DMSans_700Bold', color: isDark ? '#FFDF00' : '#7B1113', textTransform: 'uppercase', letterSpacing: 0.5 }}>View Schedule</Text>
          </TouchableOpacity>
        </View>

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
            
            const STATUS_BORDER_COLORS: Record<string, string> = {
              present: '#10B981', // green
              late: '#FBBF24',    // yellow
              absent: '#EF4444',  // red
              pending: isDark ? '#FFDF00' : '#7B1113',
              disputed: '#FFDF00',
            }

            return (
              <TouchableOpacity
                key={section.id}
                style={[styles.schedCard, isDark && styles.cardDark, { borderLeftColor: STATUS_BORDER_COLORS[status] || '#7B1113' }]}
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

        {/* Enroll CTA */}
        <TouchableOpacity
          style={[styles.enrollCta, isDark && styles.enrollCtaDark]}
          onPress={() => router.push('/(tabs)/enroll')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="school" size={20} color={isDark ? '#4A0A0B' : '#FFF'} />
          <Text style={[styles.enrollCtaText, isDark && styles.enrollCtaTextDark]}>Enroll in Subject</Text>
          <MaterialIcons name="chevron-right" size={20} color={isDark ? '#4A0A0B' : '#FFF'} />
        </TouchableOpacity>

        {/* My Subjects */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, isDark && styles.textGolden, { marginBottom: 0 }]}>My Subjects</Text>
        </View>
        {mySections.length === 0 ? (
          <View style={[styles.emptyCard, isDark && styles.cardDark]}>
            <MaterialIcons name="book" size={32} color="#CCC" />
            <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No enrollments yet</Text>
          </View>
        ) : (
          mySections.slice(0, 4).map((section) => {
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

        {/* View All Subjects — full-width when > 4 subjects */}
        {mySections.length > 4 && (
          <TouchableOpacity
            style={[styles.viewAllBtn, isDark && styles.viewAllBtnDark]}
            onPress={() => router.push('/(tabs)/subjects')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="book" size={16} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
            <Text style={[styles.viewAllText, isDark && styles.viewAllTextDark]}>View All Subjects ({mySections.length})</Text>
            <MaterialIcons name="chevron-right" size={16} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme()
  const configs: Record<string, { bg: string; text: string }> = {
    present: { bg: '#FFDF00', text: '#4A0A0B' },
    late: { bg: isDark ? 'rgba(245, 168, 0, 0.15)' : '#7B1113', text: isDark ? '#FFDF00' : '#FFFFFF' },
    absent: { bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#4A0A0B', text: isDark ? '#EF4444' : '#FFDF00' },
    pending: { bg: 'transparent', text: isDark ? '#FFDF00' : '#7B1113' },
    disputed: { bg: '#4A0A0B', text: '#FFDF00' },
  }
  const c = configs[status] || configs.pending
  return (
    <View style={[
      styles.badge,
      { backgroundColor: c.bg },
      status === 'pending' && (isDark ? styles.badgeBorderGolden : styles.badgeBorder),
      status === 'disputed' && { borderWidth: 1.5, borderColor: '#FFDF00' },
      status === 'late' && isDark && { borderWidth: 1, borderColor: '#FFDF00' },
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
    borderWidth: 1, borderColor: '#E4E4E7', backgroundColor: '#FFFFFF',
    borderLeftWidth: 4, borderLeftColor: '#7B1113',
    padding: 20, marginBottom: 16, borderRadius: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  cardDark: { borderColor: 'rgba(255, 223, 0, 0.15)', backgroundColor: '#121215', borderLeftColor: '#FFDF00', borderRadius: 0 },
  programText: { fontSize: 20, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113', marginBottom: 16 },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E4E4E7', paddingBottom: 8, marginBottom: 8 },
  cardRowDark: { borderBottomColor: '#27272A' },
  cardRowLast: { flexDirection: 'row', justifyContent: 'space-between' },
  cardRowLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#71717A' },
  cardRowValue: { fontSize: 14, fontWeight: '700', color: '#000000' },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, borderWidth: 1, borderColor: '#E4E4E7', backgroundColor: '#FFFFFF',
    padding: 16, alignItems: 'center', gap: 8, borderRadius: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  statNum: { fontSize: 24, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#71717A' },

  attendanceCard: {
    flexDirection: 'row', justifyContent: 'space-around',
    borderWidth: 1, borderColor: '#E4E4E7', backgroundColor: '#FFFFFF',
    padding: 20, marginBottom: 24, borderRadius: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  attendanceItem: { alignItems: 'center' },
  attendanceNum: { fontSize: 24, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#FFDF00' },
  attendanceLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#71717A', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#000000', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 },

  emptyCard: {
    borderWidth: 1, borderColor: '#E4E4E7', borderStyle: 'dashed',
    backgroundColor: '#FAFAFA', padding: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 40, borderRadius: 0,
  },
  emptyText: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#71717A', marginTop: 16 },

  schedCard: {
    borderWidth: 1, borderColor: '#E4E4E7', backgroundColor: '#FFFFFF',
    borderLeftWidth: 4, borderLeftColor: '#7B1113',
    padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', borderRadius: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
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

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 0 },
  badgeBorder: { borderWidth: 2, borderColor: '#7B1113' },
  badgeBorderGolden: { borderWidth: 2, borderColor: '#FFDF00' },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },

  allSubjCard: { backgroundColor: '#FFFFFF', borderRadius: 0, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, flexDirection: 'row' },
  allSubjAccent: { width: 4, backgroundColor: '#7B1113' },
  allSubjAccentDark: { backgroundColor: '#FFDF00' },
  allSubjBody: { padding: 14, flex: 1 },
  allSubjName: { fontSize: 15, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#333' },
  allSubjMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  allSubjDetails: { marginTop: 8, gap: 4 },
  allSubjDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allSubjDetailText: { fontSize: 11, color: '#888', flex: 1 },
  allSubjFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  allSubjRateBg: { flex: 1, height: 4, backgroundColor: '#EEE', borderRadius: 0 },
  allSubjRateBgDark: { backgroundColor: '#333' },
  allSubjRateFill: { height: 4, backgroundColor: '#FFDF00', borderRadius: 0 },
  allSubjRateText: { fontSize: 10, fontWeight: '700', color: '#888', minWidth: 30, textAlign: 'right' },

  enrollCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#7B1113', padding: 16, marginBottom: 8,
    borderWidth: 0, borderRadius: 0,
  },
  enrollCtaDark: { backgroundColor: '#FFDF00' },
  enrollCtaText: {
    flex: 1, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1,
    color: '#FFFFFF',
  },
  enrollCtaTextDark: { color: '#4A0A0B' },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7B1113', padding: 14, marginTop: 8, marginBottom: 4,
  },
  viewAllBtnDark: { backgroundColor: '#FFDF00' },
  viewAllText: { flex: 1, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: '#FFFFFF', textAlign: 'center' },
  viewAllTextDark: { color: '#4A0A0B' },
})