import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, Subject, AttendanceRecord } from '@polycheck/shared'

export default function FacultyDashboardScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      setSubjects(api.getSubjects(cu.id))
      setRecords(api.getAttendanceRecords())
    }
  }, [])

  if (!user) return null

  const isSuper = user.role === 'super_admin'
  const totalStudents = api.getStudents().length
  const sessionsToday = api.getSessions().filter((s) => s.date === new Date().toISOString().slice(0, 10)).length
  const absentCount = records.filter((r) => r.status === 'absent').length

  const navItems = [
    { label: 'My Subjects', icon: 'menu-book' as const, onPress: () => router.push('/(faculty)/subjects') },
    { label: 'Sessions', icon: 'event' as const, onPress: () => router.push('/(faculty)/sessions') },
    { label: 'Attendance', icon: 'assignment' as const, onPress: () => router.push('/(faculty)/attendance') },
    ...(isSuper ? [
      { label: 'Users', icon: 'people' as const, onPress: () => router.push('/(faculty)/users') },
      { label: 'Reports', icon: 'assessment' as const, onPress: () => router.push('/(faculty)/reports') },
    ] : []),
  ]

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
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={22} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={22} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="menu-book" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
            <Text style={[styles.statNumber, isDark && styles.textGolden]}>{subjects.length}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Subjects</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="people" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
            <Text style={[styles.statNumber, isDark && styles.textGolden]}>{totalStudents}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Students</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="today" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
            <Text style={[styles.statNumber, isDark && styles.textGolden]}>{sessionsToday}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Today</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <MaterialIcons name="report" size={20} color={isDark ? '#EF4444' : '#4A0A0B'} />
            <Text style={[styles.statNumber, { color: isDark ? '#EF4444' : '#4A0A0B' }]}>{absentCount}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Absent</Text>
          </View>
        </View>

        <View style={[styles.navCard, isDark && styles.cardDark]}>
          {navItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.navItem, isDark && styles.navItemDark]}
              onPress={item.onPress}
              accessibilityRole="button"
            >
              <View style={styles.navItemLeft}>
                <MaterialIcons name={item.icon} size={20} color={isDark ? '#F5A800' : '#7B1113'} />
                <Text style={[styles.navLabel, isDark && styles.textWhite]}>{item.label}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={isDark ? '#F5A800' : '#7B1113'} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, isDark && styles.textGolden]}>My Subjects</Text>
        {subjects.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.subjectCard, isDark && styles.cardDark]}
            onPress={() => router.push('/(faculty)/sessions')}
          >
            <View style={styles.subjectLeft}>
              <Text style={[styles.subjectName, isDark && styles.textWhite]}>{s.name}</Text>
              <Text style={[styles.subjectMeta, isDark && styles.textWhite50]}>
                {s.code} · Section {s.section}
              </Text>
            </View>
            <Text style={[styles.subjectCount, isDark && styles.textWhite70]}>{s.studentCount} students</Text>
          </TouchableOpacity>
        ))}
        {subjects.length === 0 && (
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
  textGolden: { color: '#F5A800' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  statCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 14, alignItems: 'center', gap: 4, minWidth: '22%', flex: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  statNumber: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113' },
  statLabel: { fontSize: 10, fontFamily: fonts.body, color: '#AAA', marginTop: 2 },
  navCard: { backgroundColor: '#FFFFFF', borderRadius: 0, overflow: 'hidden', marginBottom: 20 },
  navItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  navItemDark: { borderBottomColor: '#1C1C21' },
  navItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navLabel: { fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B', marginBottom: 12 },
  subjectCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  subjectLeft: { flex: 1 },
  subjectName: { fontSize: 15, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  subjectMeta: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  subjectCount: { fontSize: 12, fontFamily: fonts.body, color: '#AAA', marginLeft: 8 },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 40, color: '#BBB' },
})
