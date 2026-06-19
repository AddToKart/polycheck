import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, Subject, Teacher, AttendanceSummary } from '@polycheck/shared'

export default function FacultyReportsScreen() {
  const { isDark, toggle } = useTheme()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([])
  
  // Filters
  const [selectedSubject, setSelectedSubject] = useState('')
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false)

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu && cu.role === 'super_admin') {
      setCurrentUser(cu)
      setSubjects(api.getSubjects())
      setTeachers(api.getTeachers())
      setSummaries(api.getAttendanceSummaries())
    } else {
      router.replace('/(faculty)/dashboard')
    }
  }, [])

  if (!currentUser) return null

  const filteredSummaries = summaries.filter((s) => {
    if (selectedSubject) {
      const sectionIds = api.getSections(selectedSubject).map(sec => sec.id)
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
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={22} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={22} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Filters Card */}
        <View style={[styles.filterCard, isDark && styles.cardDark]}>
          <View style={styles.filterHeader}>
            <MaterialIcons name="filter-list" size={18} color={isDark ? '#F5A800' : '#7B1113'} />
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
              <MaterialIcons name={showSubjectDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color={isDark ? '#F5A800' : '#888'} />
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
            <Text style={[styles.statNumber, { color: '#F5A800' }]}>{presentPct}%</Text>
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
                <Text style={[styles.gridLabel, { color: '#F5A800' }]}>Present</Text>
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
  textGolden: { color: '#F5A800' },
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
})
