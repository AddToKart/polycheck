import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../../services/mock-api'
import { fonts } from '../../../../theme/typography'
import { useTheme } from '../../../../theme/ThemeContext'
import type { Subject, Section, Session } from '@polycheck/shared'

const DAYS = ['All', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function SubjectSessionsScreen() {
  const { isDark } = useTheme()
  const { id, sectionId: paramSectionId } = useLocalSearchParams<{ id: string; sectionId?: string }>()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState(paramSectionId ?? '')
  const [selectedDayFilter, setSelectedDayFilter] = useState('')
  const [showSectionPicker, setShowSectionPicker] = useState(false)

  useEffect(() => {
    if (!id) return
    void Promise.all([api.getSubject(id), api.getSections(id)]).then(async ([nextSubject, subjectSections]) => {
      const sessionGroups = await Promise.all(subjectSections.map((section) => api.getSectionSessions(section.id)))
      setSubject(nextSubject)
      setSections(subjectSections)
      setSessions(sessionGroups.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    }).catch(() => router.back())
  }, [id])

  useEffect(() => {
    if (paramSectionId) {
      setSelectedSectionId(paramSectionId)
    }
  }, [paramSectionId])

  const filtered = useMemo(() => {
    let result = sessions
    if (selectedSectionId) {
      result = result.filter(s => s.sectionId === selectedSectionId)
    }
    if (selectedDayFilter !== '') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      result = result.filter(s => days[new Date(s.date).getDay()] === selectedDayFilter)
    }
    return result
  }, [sessions, selectedSectionId, selectedDayFilter])

  if (!subject) return null

  const groupedBySection: Record<string, Session[]> = {}
  for (const session of filtered) {
    if (!groupedBySection[session.sectionId]) groupedBySection[session.sectionId] = []
    groupedBySection[session.sectionId].push(session)
  }

  const handleActivate = (sessionId: string) => {
    router.push(`/(faculty)/sessions/${sessionId}`)
  }

  const selectedSection = sections.find(s => s.id === selectedSectionId)
  const filteredSections = sections
  const filterCount = (selectedSectionId ? 1 : 0) + (selectedDayFilter !== '' ? 1 : 0)

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={() => router.push(`/(faculty)/subjects/${id}`)} style={styles.backBtn} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.heading, isDark && styles.textGolden]} numberOfLines={1}>{subject.name}</Text>
          <Text style={[styles.subheading, isDark && styles.textWhite50]}>{subject.code}</Text>
        </View>
      </View>

      <View style={[styles.filterBar, isDark && styles.filterBarDark]}>
        <TouchableOpacity
          style={[styles.sectionFilterChip, isDark && styles.filterChipDark, selectedSectionId && (isDark ? styles.filterChipActiveDark : styles.filterChipActive)]}
          onPress={() => setShowSectionPicker(true)}
        >
          <MaterialIcons name="filter-list" size={16} color={selectedSectionId ? '#FFF' : (isDark ? '#FFDF00' : '#888')} />
          <Text style={[styles.sectionFilterText, isDark && styles.filterChipTextDark, selectedSectionId && styles.filterChipTextActive]} numberOfLines={1}>
            {selectedSection ? `Sec ${selectedSection.section}` : 'All Sections'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={18} color={selectedSectionId ? '#FFF' : (isDark ? '#FFDF00' : '#888')} />
        </TouchableOpacity>
        {filterCount > 0 && (
          <View style={[styles.filterCountBadge, isDark && styles.filterCountBadgeDark]}>
            <Text style={styles.filterCountText}>{filterCount}</Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.dayFilterRow, isDark && styles.dayFilterRowDark]} contentContainerStyle={styles.dayFilterContent}>
        {DAYS.map((day) => {
          const isSelected = day === 'All' ? selectedDayFilter === '' : selectedDayFilter === day
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayChip, isDark && styles.dayChipDark, isSelected && (isDark ? styles.dayChipActiveDark : styles.dayChipActive)]}
              onPress={() => setSelectedDayFilter(day === 'All' ? '' : day)}
            >
              <Text style={[styles.dayChipText, isDark && styles.dayChipTextDark, isSelected && styles.dayChipTextActive]}>{day}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <Modal visible={showSectionPicker} transparent animationType="fade" onRequestClose={() => setShowSectionPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowSectionPicker(false)}>
          <View style={[styles.sheet, isDark && styles.sheetDark]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.sheetTitle, isDark && styles.sheetTitleDark]}>Select Section</Text>
            <ScrollView>
              <TouchableOpacity
                style={[styles.sheetOption, isDark && styles.sheetOptionDarkBorder, !selectedSectionId && (isDark ? styles.sheetOptionSelectedDark : styles.sheetOptionSelected)]}
                onPress={() => { setSelectedSectionId(''); setShowSectionPicker(false) }}
              >
                <Text style={[styles.sheetOptionText, isDark && styles.sheetOptionTextDark, !selectedSectionId && (isDark ? styles.sheetOptionTextActiveDark : styles.sheetOptionTextActive)]}>
                  All Sections
                </Text>
                {!selectedSectionId && <MaterialIcons name="check" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />}
              </TouchableOpacity>
              {filteredSections.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sheetOption, isDark && styles.sheetOptionDarkBorder, s.id === selectedSectionId && (isDark ? styles.sheetOptionSelectedDark : styles.sheetOptionSelected)]}
                  onPress={() => { setSelectedSectionId(s.id); setShowSectionPicker(false) }}
                >
                  <Text style={[styles.sheetOptionText, isDark && styles.sheetOptionTextDark, s.id === selectedSectionId && (isDark ? styles.sheetOptionTextActiveDark : styles.sheetOptionTextActive)]}>
                    Section {s.section} — {s.room}
                  </Text>
                  {s.id === selectedSectionId && <MaterialIcons name="check" size={18} color={isDark ? '#FFDF00' : '#7B1113'} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView contentContainerStyle={styles.content}>
        {Object.entries(groupedBySection).map(([sectionId, sectionSessions]) => {
          const section = sections.find(s => s.id === sectionId)
          return (
            <View key={sectionId} style={styles.group}>
              <Text style={[styles.sectionLabel, isDark && styles.textGolden]}>
                Section {section?.section ?? 'Unknown'} {section?.room ? `— ${section.room}` : ''}
              </Text>
              {sectionSessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.sessionCard, isDark && styles.cardDark]}
                  onPress={() => router.push(`/(faculty)/sessions/${session.id}`)}
                >
                  <View style={styles.sessionLeft}>
                    <Text style={[styles.sessionDate, isDark && styles.textWhite]}>
                      {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={[styles.sessionTime, isDark && styles.textWhite70]}>
                      <MaterialIcons name="access-time" size={12} color={isDark ? 'rgba(255,255,255,0.5)' : '#888'} /> {session.startTime} - {session.endTime}
                    </Text>
                    {session.room ? (
                      <Text style={[styles.sessionRoom, isDark && styles.textWhite50]}>
                        <MaterialIcons name="room" size={12} color={isDark ? 'rgba(255,255,255,0.5)' : '#888'} /> {session.room}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.sessionRight}>
                    <View style={[styles.badge, session.isActive ? styles.badgeActive : (isDark ? styles.badgeInactiveDark : styles.badgeInactive)]}>
                      <Text style={[styles.badgeText, session.isActive ? styles.badgeTextActive : (isDark ? styles.badgeTextInactiveDark : styles.badgeTextInactive)]}>
                        {session.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    {!session.isActive && (
                      <TouchableOpacity
                        style={[styles.activateBtn, isDark && styles.activateBtnDark]}
                        onPress={() => handleActivate(session.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Activate session"
                      >
                        <MaterialIcons name="play-arrow" size={14} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
                        <Text style={[styles.activateText, isDark && styles.activateTextDark]}>Activate</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        })}
        {filtered.length === 0 && (
          <Text style={[styles.empty, isDark && styles.textWhite50]}>No sessions found.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  containerDark: { backgroundColor: '#0A0A0C' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  backBtn: { padding: 4, marginRight: 12 },
  headerText: { flex: 1 },
  heading: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  subheading: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 1 },
  textGolden: { color: '#FFDF00' },
  textWhite: { color: '#FFFFFF' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  filterBarDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  sectionFilterChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#DDD', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  filterChipDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  filterChipActive: { borderColor: '#7B1113', backgroundColor: '#7B1113' },
  filterChipActiveDark: { borderColor: '#FFDF00', backgroundColor: '#FFDF00' },
  sectionFilterText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#666', flex: 1 },
  filterChipTextDark: { color: 'rgba(255,255,255,0.7)' },
  filterChipTextActive: { color: '#FFFFFF' },
  filterCountBadge: { backgroundColor: '#7B1113', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  filterCountBadgeDark: { backgroundColor: '#FFDF00' },
  filterCountText: { fontSize: 10, fontWeight: '700', fontFamily: fonts.bodySemiBold, color: '#FFFFFF' },
  dayFilterRow: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  dayFilterRowDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  dayFilterContent: { paddingHorizontal: 20, paddingVertical: 10, gap: 6 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#DDD', backgroundColor: '#FFFFFF' },
  dayChipDark: { borderColor: 'rgba(245, 168, 0, 0.15)', backgroundColor: '#121215' },
  dayChipActive: { borderColor: '#7B1113', backgroundColor: '#7B1113' },
  dayChipActiveDark: { borderColor: '#FFDF00', backgroundColor: '#FFDF00' },
  dayChipText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#666' },
  dayChipTextDark: { color: 'rgba(255,255,255,0.7)' },
  dayChipTextActive: { color: '#FFFFFF' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', paddingTop: 20, paddingBottom: 40, maxHeight: '70%' },
  sheetDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  sheetTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A', paddingHorizontal: 20, marginBottom: 12 },
  sheetTitleDark: { color: '#FFFFFF' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetOptionDarkBorder: { borderBottomColor: 'rgba(255,255,255,0.05)' },
  sheetOptionSelected: { backgroundColor: 'rgba(123,17,19,0.04)' },
  sheetOptionSelectedDark: { backgroundColor: 'rgba(245, 168, 0, 0.1)' },
  sheetOptionText: { fontSize: 15, fontFamily: fonts.body, color: '#333', flex: 1 },
  sheetOptionTextDark: { color: '#FFF' },
  sheetOptionTextActive: { fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  sheetOptionTextActiveDark: { fontFamily: fonts.bodySemiBold, color: '#FFDF00' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  group: { marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#4A0A0B', marginBottom: 8 },
  sessionCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  sessionLeft: { flex: 1 },
  sessionDate: { fontSize: 15, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  sessionTime: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionRoom: { fontSize: 11, fontFamily: fonts.body, color: '#999', marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionRight: { alignItems: 'flex-end', gap: 8 },
  badge: { borderRadius: 0, paddingHorizontal: 10, paddingVertical: 4 },
  badgeActive: { backgroundColor: '#4CAF50' },
  badgeInactive: { backgroundColor: '#E0E0E0' },
  badgeInactiveDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  badgeText: { fontSize: 12, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  badgeTextActive: { color: '#FFFFFF' },
  badgeTextInactive: { color: '#666' },
  badgeTextInactiveDark: { color: 'rgba(255,255,255,0.5)' },
  activateBtn: { backgroundColor: '#7B1113', borderRadius: 0, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  activateBtnDark: { backgroundColor: '#FFDF00' },
  activateText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  activateTextDark: { color: '#4A0A0B' },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 60, color: '#BBB' },
})
