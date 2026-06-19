import { useState, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'
import type { AttendanceStatus } from '@polycheck/shared'

type FilterTab = 'all' | AttendanceStatus

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
]

const sectionsMap = new Map(api.getSections().map((s) => [s.id, s]))

export default function HistoryScreen() {
  const { isDark, toggle } = useTheme()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const user = api.getCurrentUser()
  const student = user && 'studentId' in user
    ? (user as typeof user & { studentId: string })
    : null

  const allRecords = useMemo(
    () => (student ? api.getMyAttendance(student.studentId) : []),
    [student],
  )

  const filteredRecords = useMemo(
    () => activeFilter === 'all' ? allRecords : allRecords.filter((r) => r.status === activeFilter),
    [allRecords, activeFilter],
  )

  const handleLogout = () => {
    api.logout()
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, isDark && styles.textGolden]}>Audit Log</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggle} style={styles.iconBtn} accessibilityLabel="Toggle theme">
            <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={24} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={24} color={isDark ? '#F5A800' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterBar, isDark && styles.filterBarDark]}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveFilter(tab.key)}
            style={[
              styles.filterTab,
              isDark ? styles.filterTabInactiveDark : styles.filterTabInactive,
              activeFilter === tab.key && (isDark ? styles.filterTabActiveDark : styles.filterTabActive),
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${tab.label}`}
          >
            <Text style={[
              styles.filterText,
              isDark ? styles.filterTextInactiveDark : styles.filterTextInactive,
              activeFilter === tab.key && (isDark ? styles.filterTextActiveDark : styles.filterTextActive),
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {filteredRecords.length === 0 ? (
          <View style={[styles.emptyState, isDark && styles.emptyStateDark]}>
            <MaterialIcons name="search-off" size={48} color={isDark ? '#555' : '#CCC'} />
            <Text style={[styles.emptyText, isDark && styles.textWhite50]}>No records found</Text>
          </View>
        ) : (
          filteredRecords.map((record) => {
            const section = sectionsMap.get(record.sectionId)
            const subject = section ? api.getSubject(section.subjectId) : undefined
            const statusIcon = record.status === 'present' ? 'check-circle' : record.status === 'late' ? 'warning' : record.status === 'absent' ? 'cancel' : 'help'
            const iconColor = record.status === 'present' ? '#F5A800' : record.status === 'late' ? (isDark ? '#F5A800' : '#7B1113') : (isDark ? '#EF4444' : '#4A0A0B')
            return (
              <View key={record.id} style={[styles.recordRow, isDark && styles.recordRowDark]}>
                <View style={styles.recordIcon}>
                  <MaterialIcons name={statusIcon as any} size={24} color={iconColor} />
                </View>
                <View style={styles.recordInfo}>
                  <Text style={[styles.recordSubject, isDark && styles.textWhite]}>
                    {subject?.name ?? record.sectionId}
                  </Text>
                  <View style={styles.recordMeta}>
                    <Text style={[styles.recordDate, isDark && styles.textWhite50]}>
                      {new Date(record.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text style={[styles.recordTime, isDark && styles.textWhite50]}>
                      {new Date(record.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <View style={[styles.badgeCol, isDark && styles.badgeColDark]}>
                  <StatusBadge status={record.status} />
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme()
  const configs: Record<string, { bg: string; text: string; border?: string }> = {
    present: { bg: '#F5A800', text: '#4A0A0B' },
    late: { bg: isDark ? 'rgba(245, 168, 0, 0.15)' : '#7B1113', text: isDark ? '#F5A800' : '#FFFFFF', border: isDark ? '#F5A800' : undefined },
    absent: { bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#4A0A0B', text: isDark ? '#EF4444' : '#F5A800', border: isDark ? '#EF4444' : undefined },
    pending: { bg: 'transparent', text: isDark ? '#F5A800' : '#7B1113', border: isDark ? '#F5A800' : '#7B1113' },
  }
  const c = configs[status] || configs.pending
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.bg }, c.border && { borderWidth: 2, borderColor: c.border }]}>
      <Text style={[badgeStyles.text, { color: c.text }]}>{status}</Text>
    </View>
  )
}

const badgeStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4 },
  text: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  headerTitle: { fontSize: 24, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#7B1113' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8 },

  filterBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: '#FAFAFA', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  filterBarDark: { backgroundColor: '#0D0D10', borderBottomColor: '#1C1C21' },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 2 },
  filterTabInactive: { backgroundColor: '#FFFFFF', borderColor: '#D4D4D8' },
  filterTabInactiveDark: { backgroundColor: '#121215', borderColor: 'rgba(245, 168, 0, 0.2)' },
  filterTabActive: { backgroundColor: '#7B1113', borderColor: '#7B1113' },
  filterTabActiveDark: { backgroundColor: '#F5A800', borderColor: '#F5A800' },
  filterText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },
  filterTextInactive: { color: '#71717A' },
  filterTextInactiveDark: { color: '#A1A1AA' },
  filterTextActive: { color: '#FFFFFF' },
  filterTextActiveDark: { color: '#4A0A0B' },

  scroll: { flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 80, borderBottomWidth: 2, borderBottomColor: '#D4D4D8' },
  emptyStateDark: { borderBottomColor: '#1C1C21' },
  emptyText: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', color: '#A1A1AA', marginTop: 16 },

  recordRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: '#D4D4D8',
  },
  recordRowDark: { backgroundColor: '#121215', borderBottomColor: '#1C1C21' },
  recordIcon: { marginRight: 16 },
  recordInfo: { flex: 1, paddingRight: 16 },
  recordSubject: { fontSize: 14, fontWeight: '700', fontFamily: 'Lora_400Regular', color: '#000000', marginBottom: 4 },
  recordMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDate: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#71717A' },
  recordTime: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: '#A1A1AA' },
  badgeCol: { borderLeftWidth: 2, borderLeftColor: '#E4E4E7', borderStyle: 'dashed', paddingLeft: 16, paddingVertical: 8 },
  badgeColDark: { borderLeftColor: '#1C1C21' },

  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#F5A800' },
})