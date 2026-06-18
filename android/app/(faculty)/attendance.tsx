import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, AttendanceSummary } from '@polycheck/shared'

export default function FacultyAttendanceScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      setSummaries(api.getAttendanceSummaries(cu.id))
    }
  }, [])

  if (!user) return null

  const totals = summaries.reduce(
    (acc, s) => ({
      totalSessions: acc.totalSessions + s.totalSessions,
      present: acc.present + s.present,
      late: acc.late + s.late,
      absent: acc.absent + s.absent,
    }),
    { totalSessions: 0, present: 0, late: 0, absent: 0 }
  )

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textWhite]}>Attendance</Text>
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
            <Text style={[styles.statNumber, { color: '#7B1113' }]}>{totals.totalSessions}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Sessions</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: '#F5A800' }]}>{totals.present}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Present</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: '#7B1113' }]}>{totals.late}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Late</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: '#4A0A0B' }]}>{totals.absent}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Absent</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, isDark && styles.textWhite]}>By Subject</Text>

        {summaries.map((s) => (
          <View key={s.subjectId} style={[styles.subjectCard, isDark && styles.cardDark]}>
            <Text style={[styles.subjectName, isDark && styles.textWhite]}>{s.subjectName}</Text>
            <Text style={[styles.subjectSessions, isDark && styles.textWhite50]}>
              Total sessions: {s.totalSessions}
            </Text>

            <View style={styles.badgeRow}>
              <View style={[styles.badge, styles.badgePresent]}>
                <Text style={styles.badgeTextPresent}>{s.present} Pres</Text>
              </View>
              <View style={[styles.badge, styles.badgeLate]}>
                <Text style={styles.badgeTextLate}>{s.late} Late</Text>
              </View>
              <View style={[styles.badge, styles.badgeAbsent]}>
                <Text style={styles.badgeTextAbsent}>{s.absent} Abs</Text>
              </View>
              <View style={[styles.badge, styles.badgeAbsent]}>
                <Text style={styles.badgeTextAbsent}>{s.absent} Abs</Text>
              </View>
            </View>
          </View>
        ))}

        {summaries.length === 0 && (
          <Text style={[styles.empty, isDark && styles.textWhite50]}>No attendance data available.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#1A1A1A', borderBottomColor: '#222' },
  iconBtn: { padding: 6 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  headerRight: { flexDirection: 'row', gap: 8 },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 0, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#1A1A1A' },
  statNumber: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bodyBold },
  statLabel: { fontSize: 10, fontFamily: fonts.body, color: '#AAA', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B', marginBottom: 12 },
  subjectCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  subjectName: { fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  subjectSessions: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  badge: { borderRadius: 0, paddingHorizontal: 10, paddingVertical: 4 },
  badgePresent: { backgroundColor: '#F5A800' },
  badgeTextPresent: { color: '#4A0A0B', fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  badgeLate: { backgroundColor: '#7B1113' },
  badgeTextLate: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  badgeAbsent: { backgroundColor: '#4A0A0B', borderWidth: 1, borderColor: '#F5A800' },
  badgeTextAbsent: { color: '#F5A800', fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 60, color: '#BBB' },
})
