import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, AttendanceRecord, AttendanceSummary, Session } from '@polycheck/shared'
import DatePickerModal from '../../components/DatePickerModal'

export default function FacultyAttendanceScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [fromPickerVisible, setFromPickerVisible] = useState(false)
  const [toPickerVisible, setToPickerVisible] = useState(false)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      void Promise.all([
        api.getAttendanceSummaries(cu.id),
        api.getAttendanceRecords(),
        api.getSessions(),
      ]).then(([nextSummaries, nextRecords, nextSessions]) => {
        setSummaries(nextSummaries)
        setRecords(nextRecords)
        setSessions(nextSessions)
      }).catch(() => Alert.alert('Unable to load attendance', 'Please check your connection and try again.'))
    }
  }, [])

  // Filter summaries by date range
  const filteredSummaries = useMemo(() => {
    if (!fromDate && !toDate) return summaries
    return summaries.map((s) => {
      const sectionSessionIds = sessions.filter((session) => session.sectionId === s.sectionId).map((session) => session.id)
      const filtered = records.filter((r) => {
        if (!sectionSessionIds.includes(r.sessionId)) return false
        const rDate = r.timestamp.slice(0, 10)
        if (fromDate && rDate < fromDate) return false
        if (toDate && rDate > toDate) return false
        return true
      })
      return {
        ...s,
        present: filtered.filter((r) => r.status === 'present').length,
        late: filtered.filter((r) => r.status === 'late').length,
        absent: filtered.filter((r) => r.status === 'absent').length,
      }
    })
  }, [summaries, records, sessions, fromDate, toDate])

  if (!user) return null

  const totals = filteredSummaries.reduce(
    (acc, s) => ({
      totalSessions: acc.totalSessions + s.totalSessions,
      present: acc.present + s.present,
      late: acc.late + s.late,
      absent: acc.absent + s.absent,
    }),
    { totalSessions: 0, present: 0, late: 0, absent: 0 }
  )

  const handleExport = async () => {
    const csv = await api.exportAttendanceCsv()
    await Clipboard.setStringAsync(csv)
    Alert.alert('Exported', 'Attendance data copied to clipboard. You can paste it into a spreadsheet.')
  }

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  const isFiltered = !!(fromDate || toDate)

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>Attendance</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleExport} style={styles.iconBtn} accessibilityLabel="Export CSV">
            <MaterialIcons name="file-download" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
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
        {/* Date Range Filter */}
        <View style={[styles.filterCard, isDark && styles.cardDark]}>
          <View style={styles.filterHeader}>
            <MaterialIcons name="date-range" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.filterTitle, isDark && styles.textGolden]}>Date Range</Text>
            {isFiltered && (
              <TouchableOpacity onPress={() => { setFromDate(''); setToDate('') }} style={styles.clearBtn}>
                <Text style={[styles.clearBtnText, { color: isDark ? '#FFDF00' : '#7B1113' }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterRow}>
            <View style={styles.filterHalf}>
              <Text style={[styles.filterLabel, isDark && styles.textWhite50]}>From</Text>
              <TouchableOpacity
                style={[styles.filterInputContainer, isDark && styles.filterInputDark]}
                onPress={() => setFromPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterInputValue, !fromDate && styles.placeholderText, isDark && styles.textWhite]}>
                  {fromDate || 'YYYY-MM-DD'}
                </Text>
                <MaterialIcons name="event" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterHalf}>
              <Text style={[styles.filterLabel, isDark && styles.textWhite50]}>To</Text>
              <TouchableOpacity
                style={[styles.filterInputContainer, isDark && styles.filterInputDark]}
                onPress={() => setToPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterInputValue, !toDate && styles.placeholderText, isDark && styles.textWhite]}>
                  {toDate || 'YYYY-MM-DD'}
                </Text>
                <MaterialIcons name="event" size={16} color={isDark ? '#FFDF00' : '#7B1113'} />
              </TouchableOpacity>
            </View>
          </View>
          {isFiltered && (
            <Text style={[styles.filterHint, isDark && styles.textWhite50]}>Showing filtered results</Text>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: isDark ? '#FFFFFF' : '#7B1113' }]}>{totals.totalSessions}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Sessions</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: '#FFDF00' }]}>{totals.present}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Present</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: isDark ? '#FF6B6B' : '#7B1113' }]}>{totals.late}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Late</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: isDark ? '#FF4F5A' : '#4A0A0B' }]}>{totals.absent}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Absent</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isDark && styles.textGolden]}>By Subject</Text>
          <Text style={[styles.sectionHint, isDark && styles.textWhite50]}>Tap to view students</Text>
        </View>

        {/* Subject cards — tappable, route to section detail */}
        {filteredSummaries.map((s) => (
          <TouchableOpacity
            key={s.sectionId}
            style={[styles.subjectCard, isDark && styles.cardDark]}
            onPress={() => router.push(`/(faculty)/sections/${s.sectionId}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.subjectCardTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subjectName, isDark && styles.textWhite]}>{s.subjectName}</Text>
                <Text style={[styles.subjectSessions, isDark && styles.textWhite50]}>
                  {s.totalSessions} session{s.totalSessions !== 1 ? 's' : ''}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.2)' : '#CCC'} />
            </View>

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
              {/* Attendance rate bar */}
              {(s.present + s.late + s.absent) > 0 && (
                <View style={styles.rateBar}>
                  <View style={[styles.rateFill, { width: `${Math.round((s.present / (s.present + s.late + s.absent)) * 100)}%` as any }]} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {filteredSummaries.length === 0 && (
          <Text style={[styles.empty, isDark && styles.textWhite50]}>No attendance data available.</Text>
        )}
      </ScrollView>

      <DatePickerModal
        visible={fromPickerVisible}
        onClose={() => setFromPickerVisible(false)}
        onSelectDate={setFromDate}
        value={fromDate}
        title="Select From Date"
        isDark={isDark}
      />

      <DatePickerModal
        visible={toPickerVisible}
        onClose={() => setToPickerVisible(false)}
        onSelectDate={setToDate}
        value={toDate}
        title="Select To Date"
        isDark={isDark}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  iconBtn: { padding: 6 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  headerRight: { flexDirection: 'row', gap: 8 },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  // Date filter
  filterCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEE', padding: 14, marginBottom: 16 },
  filterHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  filterTitle: { fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#7B1113', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#DDD' },
  clearBtnText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterHalf: { flex: 1 },
  filterLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginBottom: 4 },
  filterInputContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FAFAFA', paddingHorizontal: 10, paddingVertical: 8, height: 38 },
  filterInputValue: { fontSize: 13, fontFamily: fonts.body, color: '#333' },
  placeholderText: { color: '#AAA' },
  filterInputDark: { borderColor: 'rgba(245,168,0,0.2)', backgroundColor: '#0A0A0C' },
  filterHint: { fontSize: 10, color: '#888', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 0, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  statNumber: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bodyBold },
  statLabel: { fontSize: 10, fontFamily: fonts.body, color: '#AAA', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  sectionHint: { fontSize: 10, fontFamily: fonts.body, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  // Subject cards
  subjectCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  subjectCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  subjectName: { fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  subjectSessions: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  badge: { borderRadius: 0, paddingHorizontal: 10, paddingVertical: 4 },
  badgePresent: { backgroundColor: '#FFDF00' },
  badgeTextPresent: { color: '#4A0A0B', fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  badgeLate: { backgroundColor: '#7B1113' },
  badgeTextLate: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  badgeAbsent: { backgroundColor: '#4A0A0B', borderWidth: 1, borderColor: '#FFDF00' },
  badgeTextAbsent: { color: '#FFDF00', fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  rateBar: { flex: 1, height: 4, backgroundColor: '#EEE', marginLeft: 6, minWidth: 40 },
  rateFill: { height: 4, backgroundColor: '#FFDF00' },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 60, color: '#BBB' },
})
