import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, Section, AttendanceRecord } from '@polycheck/shared'

export default function FacultyDashboardScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      setSections(api.getSections().filter((s) => s.teacherId === cu.id))
      setRecords(api.getAttendanceRecords())
    }
  }, [])

  if (!user) return null

  const isSuper = user.role === 'super_admin'
  const teacherSectionIds = sections.map((s) => s.id)

  const teacherStudentCount = (() => {
    const studentIds = new Set<string>()
    sections.forEach((sec) => {
      const roster = api.getSectionStudents(sec.id)
      roster.forEach((st) => studentIds.add(st.id))
    })
    return studentIds.size
  })()

  const sessionsToday = api.getSessions().filter((s) => 
    s.date === new Date().toISOString().slice(0, 10) && teacherSectionIds.includes(s.sectionId)
  ).length

  const pendingDisputes = api.getDisputedRecords().filter((r) => 
    teacherSectionIds.includes(r.sectionId)
  ).length

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
            <Text style={[styles.statNumber, isDark && styles.textGolden]}>{teacherStudentCount}</Text>
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

        <Text style={[styles.sectionTitle, isDark && styles.textGolden]}>My Subjects</Text>
        {sections.map((s) => {
          const parent = api.getSubject(s.subjectId)
          return (
          <TouchableOpacity
            key={s.id}
            style={[styles.subjectCard, isDark && styles.cardDark]}
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
  statCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, alignItems: 'center', gap: 4, minWidth: '22%', flex: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)', borderRadius: 12 },
  statNumber: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113' },
  statLabel: { fontSize: 10, fontFamily: fonts.body, color: '#AAA', marginTop: 2 },
  
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 16 },
  alertBannerDark: { backgroundColor: '#1E1B1B', borderColor: '#7F1D1D' },
  alertTitle: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#991B1B' },
  alertTitleDark: { color: '#FCA5A5' },
  alertDesc: { fontSize: 12, fontFamily: fonts.body, color: '#B91C1C', marginTop: 2 },
  alertDescDark: { color: '#FEE2E2' },

  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B', marginBottom: 12 },
  subjectCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  subjectLeft: { flex: 1 },
  subjectName: { fontSize: 15, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  subjectMeta: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  subjectCount: { fontSize: 12, fontFamily: fonts.body, color: '#AAA', marginLeft: 8 },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 40, color: '#BBB' },
})
