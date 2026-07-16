import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/api-client'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, Subject, Teacher, AttendanceSummary, Section } from '@polycheck/shared'

export default function FacultyReportsScreen() {
  const { isDark, toggle } = useTheme()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([])
  const [sections, setSections] = useState<Section[]>([])
  
  // Filters
  const [selectedSubject, setSelectedSubject] = useState('')
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu && cu.role === 'super_admin') {
      setCurrentUser(cu)
      void Promise.all([api.getSubjects(), api.getTeachers(), api.getAttendanceSummaries(), api.getSections()]).then(([nextSubjects, nextTeachers, nextSummaries, nextSections]) => {
        setSubjects(nextSubjects)
        setTeachers(nextTeachers)
        setSummaries(nextSummaries)
        setSections(nextSections)
      })
    } else {
      router.replace('/(faculty)/dashboard')
    }
  }, [])

  if (!currentUser) return null

  const filteredSummaries = summaries.filter((s) => {
    if (selectedSubject) {
      const sectionIds = sections.filter((section) => section.subjectId === selectedSubject).map((section) => section.id)
      if (!sectionIds.includes(s.sectionId)) return false
    }
    return true
  })

  const total = filteredSummaries.reduce(
    (acc, s) => ({
      total: acc.total + s.present + s.late + s.absent,
      present: acc.present + s.present,
      late: acc.late + s.late,
      absent: acc.absent + s.absent,
    }),
    { total: 0, present: 0, late: 0, absent: 0 }
  )

  const presentPct = total.total > 0 ? Math.round((total.present / total.total) * 100) : 0
  const latePct = total.total > 0 ? Math.round((total.late / total.total) * 100) : 0
  const absentPct = total.total > 0 ? Math.round((total.absent / total.total) * 100) : 0

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  const selectedSubjectObj = subjects.find(s => s.id === selectedSubject)

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>Reports</Text>
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
        {/* Filters Card */}
        <View style={[styles.filterCard, isDark && styles.cardDark]}>
          <View style={styles.filterHeader}>
            <MaterialIcons name="filter-list" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />
            <Text style={[styles.filterTitle, isDark && styles.textWhite]}>Filters</Text>
          </View>

          <View style={styles.filterItem}>
            <Text style={[styles.filterLabel, isDark && styles.textWhite50]}>Filter by Subject</Text>
            <TouchableOpacity 
              style={[styles.dropdownSelector, isDark && styles.dropdownSelectorDark]} 
              onPress={() => setShowSubjectDropdown(!showSubjectDropdown)}
            >
              <Text style={[styles.dropdownSelectorText, isDark && styles.textWhite]}>
                {selectedSubjectObj ? `${selectedSubjectObj.name} (${selectedSubjectObj.code})` : 'All Subjects'}
              </Text>
              <MaterialIcons name={showSubjectDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color={isDark ? '#FFDF00' : '#888'} />
            </TouchableOpacity>
            
            {showSubjectDropdown && (
              <View style={[styles.dropdownOptions, isDark && styles.dropdownOptionsDark]}>
                <TouchableOpacity 
                  style={[styles.dropdownOption, isDark && styles.dropdownOptionDarkBorder]} 
                  onPress={() => { setSelectedSubject(''); setShowSubjectDropdown(false); }}
                >
                  <Text style={[styles.dropdownOptionText, isDark && styles.textWhite]}>All Subjects</Text>
                </TouchableOpacity>
                {subjects.map((s) => (
                  <TouchableOpacity 
                    key={s.id} 
                    style={[styles.dropdownOption, isDark && styles.dropdownOptionDarkBorder]} 
                    onPress={() => { setSelectedSubject(s.id); setShowSubjectDropdown(false); }}
                  >
                    <Text style={[styles.dropdownOptionText, isDark && styles.textWhite]}>
                      {s.name} ({s.code})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: isDark ? '#FFFFFF' : '#7B1113' }]}>{total.total}</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Total Attendance</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: '#FFDF00' }]}>{presentPct}%</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Present Rate</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: isDark ? '#FF6B6B' : '#7B1113' }]}>{latePct}%</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Late Rate</Text>
          </View>
          <View style={[styles.statCard, isDark && styles.cardDark]}>
            <Text style={[styles.statNumber, { color: isDark ? '#FF4F5A' : '#4A0A0B' }]}>{absentPct}%</Text>
            <Text style={[styles.statLabel, isDark && styles.textWhite50]}>Absent Rate</Text>
          </View>
        </View>

        {/* Charts */}
        <View style={styles.chartsRow}>
          {/* Donut Chart */}
          <View style={[styles.chartCard, isDark && styles.cardDark]}>
            <Text style={[styles.chartTitle, isDark && styles.textWhite]}>Distribution</Text>
            <View style={styles.donutContainer}>
              {total.total > 0 ? (
                <>
                  <View style={styles.donut}>
                    <View style={[styles.donutSlice, { backgroundColor: '#4A0A0B', zIndex: 1, flex: total.absent || 1 }]} />
                    <View style={[styles.donutSlice, { backgroundColor: '#7B1113', zIndex: 2, flex: total.late || 1 }]} />
                    <View style={[styles.donutSlice, { backgroundColor: '#FFDF00', zIndex: 3, flex: total.present || 1 }]} />
                    <View style={styles.donutHole}>
                      <Text style={styles.donutCount}>{total.total}</Text>
                      <Text style={styles.donutLabel}>total</Text>
                    </View>
                  </View>
                  <View style={styles.legend}>
                    {[
                      { label: 'Present', count: total.present, pct: presentPct, color: '#FFDF00' },
                      { label: 'Late', count: total.late, pct: latePct, color: '#7B1113' },
                      { label: 'Absent', count: total.absent, pct: absentPct, color: '#4A0A0B' },
                    ].map((item) => (
                      <View key={item.label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={[styles.legendText, isDark && styles.textWhite]}>{item.label}</Text>
                        <Text style={[styles.legendCount, { color: item.color }]}>{item.count} ({item.pct}%)</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={[styles.empty, isDark && styles.textWhite50]}>No data</Text>
              )}
            </View>
          </View>

          {/* Attendance Rate Bar */}
          <View style={[styles.chartCard, isDark && styles.cardDark]}>
            <Text style={[styles.chartTitle, isDark && styles.textWhite]}>Attendance Rate</Text>
            <Text style={styles.ratePercent}>{presentPct}%</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${presentPct}%` as any }]} />
            </View>
            <Text style={[styles.rateLabel, isDark && styles.textWhite50]}>
              {total.present} of {total.total} present
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, isDark && styles.textGolden]}>Summary by Subject</Text>

        {filteredSummaries.map((s) => (
          <View key={s.sectionId} style={[styles.subjectSummaryCard, isDark && styles.cardDark]}>
            <Text style={[styles.subjectName, isDark && styles.textWhite]}>{s.subjectName}</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.gridCell}>
                <Text style={[styles.gridLabel, isDark && styles.textWhite50]}>Sessions</Text>
                <Text style={[styles.gridValue, isDark && styles.textWhite]}>{s.totalSessions}</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={[styles.gridLabel, { color: '#FFDF00' }]}>Present</Text>
                <Text style={[styles.gridValue, isDark && styles.textWhite]}>{s.present}</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={[styles.gridLabel, { color: isDark ? '#FF6B6B' : '#7B1113' }]}>Late</Text>
                <Text style={[styles.gridValue, isDark && styles.textWhite]}>{s.late}</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={[styles.gridLabel, { color: isDark ? '#FF4F5A' : '#4A0A0B' }]}>Absent</Text>
                <Text style={[styles.gridValue, isDark && styles.textWhite]}>{s.absent}</Text>
              </View>
            </View>
          </View>
        ))}

        {filteredSummaries.length === 0 && (
          <Text style={[styles.empty, isDark && styles.textWhite50]}>No summaries matching filters.</Text>
        )}
      </ScrollView>
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
  filterCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  filterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  filterTitle: { fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  filterItem: { gap: 6 },
  filterLabel: { fontSize: 12, color: '#666', fontWeight: '500', fontFamily: fonts.bodyMedium },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 0, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FAFAFA' },
  dropdownSelectorDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  dropdownSelectorText: { fontSize: 14, fontFamily: fonts.body, color: '#333' },
  dropdownOptions: { marginTop: 4, borderWidth: 1, borderColor: '#DDD', borderRadius: 0, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  dropdownOptionsDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  dropdownOption: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  dropdownOptionDarkBorder: { borderBottomColor: 'rgba(255,255,255,0.05)' },
  dropdownOptionText: { fontSize: 14, fontFamily: fonts.body, color: '#333' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 0, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statNumber: { fontSize: 18, fontWeight: '700', fontFamily: fonts.bodyBold },
  statLabel: { fontSize: 9, fontFamily: fonts.body, color: '#AAA', marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B', marginBottom: 12 },
  subjectSummaryCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  subjectName: { fontSize: 15, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333', marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridCell: { alignItems: 'center' },
  gridLabel: { fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  gridValue: { fontSize: 14, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#333', marginTop: 2 },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 60, color: '#BBB' },

  chartsRow: { flexDirection: 'column', gap: 12, marginBottom: 20 },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  chartTitle: { fontSize: 13, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#333', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  donutContainer: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donut: {
    width: 100, height: 100, borderRadius: 50,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 3, borderColor: '#E4E4E7',
    position: 'relative', justifyContent: 'center', alignItems: 'center',
  },
  donutSlice: { height: '100%' },
  donutHole: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
  },
  donutCount: { fontSize: 18, fontWeight: '700', fontFamily: fonts.bodyBold, color: '#333' },
  donutLabel: { fontSize: 8, fontFamily: fonts.body, color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  legend: { flex: 1, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10 },
  legendText: { fontSize: 11, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333', flex: 1 },
  legendCount: { fontSize: 11, fontWeight: '700', fontFamily: fonts.bodyBold },
  ratePercent: { fontSize: 32, fontWeight: '700', fontFamily: fonts.heading, color: '#FFDF00', marginBottom: 8 },
  barTrack: { width: '100%', height: 10, backgroundColor: '#E4E4E7', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#FFDF00' },
  rateLabel: { fontSize: 11, fontFamily: fonts.body, color: '#999', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },
})
