import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/api-client'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import { formatTime } from '@polycheck/shared/utils'
import type { User, Section, CalendarEvent, Session, Subject } from '@polycheck/shared'

export default function FacultyDashboardScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [subjects, setSubjects] = useState<Record<string, Subject>>({})
  const [studentCount, setStudentCount] = useState(0)
  const [disputeCount, setDisputeCount] = useState(0)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      const todayStr = new Date().toISOString().slice(0, 10)
      void Promise.all([
        api.getSections(),
        api.getCalendarEvents(cu.id, todayStr, todayStr),
        api.getSessions(),
        api.getSubjects(),
        api.getDisputedRecords(),
      ]).then(async ([nextSections, events, nextSessions, subjectList, disputes]) => {
        const ownSections = nextSections.filter((section) => section.teacherId === cu.id || cu.role === 'super_admin')
        const rosters = await Promise.all(ownSections.map((section) => api.getSectionStudents(section.id)))
        const studentIds = new Set(rosters.flat().map((student) => student.id))
        setSections(ownSections)
        setTodayEvents(events.sort((a, b) => a.startTime.localeCompare(b.startTime)))
        setSessions(nextSessions)
        setSubjects(Object.fromEntries(subjectList.map((subject) => [subject.id, subject])))
        setStudentCount(studentIds.size)
        setDisputeCount(disputes.filter((record) => ownSections.some((section) => section.id === record.sectionId)).length)
      })
    }
  }, [])

  if (!user) return null

  const isSuper = user.role === 'super_admin'
  const teacherSectionIds = sections.map((s) => s.id)

  const sessionsToday = sessions.filter((s) =>
    s.date === new Date().toISOString().slice(0, 10) && teacherSectionIds.includes(s.sectionId)
  ).length

  const pendingDisputes = disputeCount

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View>
          <Text style={[styles.greeting, isDark && styles.textGolden]}>Welcome back</Text>
          <Text style={[styles.name, isDark && styles.textWhite]}>{user.fullName}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push('/(faculty)/search')} style={styles.iconBtn} accessibilityLabel="Search">
            <MaterialIcons name="search" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggle} style={styles.iconBtn} accessibilityLabel="Toggle theme">
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {pendingDisputes > 0 && (
          <TouchableOpacity 
            style={[styles.alertBanner, isDark && styles.alertBannerDark]} 
            onPress={() => router.push('/(faculty)/disputes')}
          >
            <MaterialIcons name="gavel" size={20} color={isDark ? '#FCA5A5' : '#991B1B'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, isDark && styles.alertTitleDark]}>Disputes Pending Review</Text>
              <Text style={[styles.alertDesc, isDark && styles.alertDescDark]}>
                You have {pendingDisputes} dispute{pendingDisputes > 1 ? 's' : ''} waiting for resolution.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={isDark ? '#FCA5A5' : '#991B1B'} />
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="menu-book" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.statNumber, isDark && styles.textGolden]}>{sections.length}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Subjects</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="people" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.statNumber, isDark && styles.textGolden]}>{studentCount}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Students</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="today" size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.statNumber, isDark && styles.textGolden]}>{sessionsToday}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Today</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="gavel" size={20} color={pendingDisputes > 0 ? '#EF4444' : (isDark ? '#FFDF00' : '#7B1113')} />
            <Text style={[styles.statNumber, pendingDisputes > 0 ? { color: '#EF4444' } : (isDark && styles.textGolden)]}>
              {pendingDisputes}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Disputes</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, isDark && styles.textGolden, { marginTop: 8 }]}>Today's Schedule</Text>
        {todayEvents.map((ev) => {
          const isActive = ev.status === 'active'
          const isCompleted = ev.status === 'completed'
          const isMoved = ev.status === 'moved'
          const todayStr = new Date().toISOString().slice(0, 10)

          return (
            <View 
              key={ev.id} 
              style={[
                styles.scheduleCard, 
                isDark && styles.cardDark,
                isDark && styles.scheduleCardDark,
                isActive && styles.scheduleCardActive, 
                isCompleted && styles.scheduleCardCompleted, 
                isMoved && styles.scheduleCardMoved
              ]}
            >
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleTime, isDark && styles.textGolden]}>
                  {formatTime(ev.startTime)} - {formatTime(ev.endTime)}
                </Text>
                <Text style={[styles.scheduleName, isDark && styles.textWhite]}>{ev.subjectName}</Text>
                <Text style={[styles.scheduleMeta, isDark && styles.textWhite50]}>
                  Sec {ev.sectionName} {ev.room ? `· ${ev.room}` : ''}
                </Text>
              </View>
              <View style={styles.scheduleAction}>
                {isActive ? (
                  <TouchableOpacity
                    style={styles.activeBtn}
                    onPress={() => {
                      const activeSession = sessions.find(
                        (sess) => sess.sectionId === ev.sectionId && sess.date === todayStr && sess.isActive
                      )
                      if (activeSession) {
                        router.push(`/(faculty)/sessions/${activeSession.id}`)
                      }
                    }}
                  >
                    <Text style={styles.activeBtnText}>Active</Text>
                  </TouchableOpacity>
                ) : isCompleted ? (
                  <Text style={[styles.badgeText, isDark ? styles.textWhite50 : { color: '#888' }]}>Completed</Text>
                ) : isMoved ? (
                  <Text style={[styles.badgeText, { color: '#EF4444' }]}>Moved</Text>
                ) : (
                  <TouchableOpacity
                    style={[styles.activateBtn, isDark && styles.activateBtnDark]}
                    onPress={() => router.push({
                      pathname: '/(faculty)/sessions/create',
                      params: { sectionId: ev.sectionId }
                    })}
                  >
                    <Text style={[styles.activateBtnText, isDark && styles.activateBtnTextDark]}>Activate</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )
        })}
        {todayEvents.length === 0 && (
          <View style={[styles.emptySchedule, isDark && styles.cardDark]}>
            <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No classes scheduled for today.</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, isDark && styles.textGolden, { marginTop: 12 }]}>My Subjects</Text>
        {sections.map((s) => {
          const parent = subjects[s.subjectId]
          return (
          <TouchableOpacity
            key={s.id}
            style={[styles.subjectCard, isDark && styles.cardDark, isDark && styles.subjectCardDark]}
            onPress={() => router.push(`/(faculty)/sections/${s.id}`)}
          >
            <View style={styles.subjectLeft}>
              <Text style={[styles.subjectName, isDark && styles.textWhite]}>{parent?.name ?? s.id}</Text>
              <Text style={[styles.subjectMeta, isDark && styles.textWhite50]}>
                {parent?.code ?? ''} · Section {s.section}
              </Text>
            </View>
            <Text style={[styles.subjectCount, isDark && styles.textWhite70]}>{s.studentCount} students</Text>
          </TouchableOpacity>
          )
        })}
        {sections.length === 0 && (
          <Text style={[styles.empty, isDark && styles.textWhite50]}>No subjects yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  greeting: { fontSize: 14, fontFamily: fonts.body, color: '#7B1113' },
  name: { fontSize: 20, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B', marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
  textWhite: { color: '#FFFFFF' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  statCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEE', borderRadius: 0, padding: 14, alignItems: 'center', gap: 4, minWidth: '22%', flex: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)', borderRadius: 0 },
  statNumber: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113' },
  statLabel: { fontSize: 10, fontFamily: fonts.body, color: '#AAA', marginTop: 2 },
  
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderLeftWidth: 4, borderLeftColor: '#EF4444', borderRadius: 0, padding: 16, marginBottom: 16 },
  alertBannerDark: { backgroundColor: '#1E1B1B', borderColor: '#7F1D1D', borderLeftColor: '#EF4444' },
  alertTitle: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#991B1B' },
  alertTitleDark: { color: '#FCA5A5' },
  alertDesc: { fontSize: 12, fontFamily: fonts.body, color: '#B91C1C', marginTop: 2 },
  alertDescDark: { color: '#FEE2E2' },

  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B', marginBottom: 12 },
  subjectCard: { backgroundColor: '#FFFFFF', borderRadius: 0, borderWidth: 1, borderColor: '#EEE', borderLeftWidth: 4, borderLeftColor: '#7B1113', padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  subjectCardDark: { borderLeftColor: '#FFDF00' },
  subjectLeft: { flex: 1 },
  subjectName: { fontSize: 15, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  subjectMeta: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  subjectCount: { fontSize: 12, fontFamily: fonts.body, color: '#AAA', marginLeft: 8 },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 40, color: '#BBB' },

  // Schedule styles
  scheduleCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEE', borderLeftWidth: 4, borderLeftColor: '#7B1113', borderRadius: 0, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  scheduleCardDark: { borderLeftColor: '#FFDF00' },
  scheduleCardActive: { borderLeftColor: '#FFDF00', backgroundColor: 'rgba(255, 223, 0, 0.05)' },
  scheduleCardCompleted: { borderLeftColor: '#888888' },
  scheduleCardMoved: { borderLeftColor: '#EF4444' },
  scheduleInfo: { flex: 1 },
  scheduleTime: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113', marginBottom: 2 },
  scheduleName: { fontSize: 16, fontWeight: '700', fontFamily: fonts.heading, color: '#000000' },
  scheduleMeta: { fontSize: 12, fontFamily: fonts.body, color: '#666', marginTop: 2 },
  scheduleAction: { justifyContent: 'center', alignItems: 'flex-end', marginLeft: 12 },
  activeBtn: { backgroundColor: '#FFDF00', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 0 },
  activeBtnText: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#4A0A0B' },
  activateBtn: { borderWidth: 1, borderColor: '#7B1113', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 0 },
  activateBtnDark: { borderColor: '#FFDF00' },
  activateBtnText: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113' },
  activateBtnTextDark: { color: '#FFDF00' },
  badgeText: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#888' },
  emptySchedule: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEE', borderRadius: 0, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyText: { fontSize: 14, fontFamily: fonts.body, color: '#888' },
})
