import { useState, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { useTheme } from '../../theme/ThemeContext'
import type { Section } from '@polycheck/shared'

export default function StudentSubjectsListScreen() {
  const { isDark } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')

  const user = api.getCurrentUser()
  const student = user && 'studentId' in user
    ? (user as typeof user & { studentId: string })
    : null

  const mySections = student ? api.getStudentSections(student.id) : []
  const myAttendance = student ? api.getMyAttendance(student.id) : []

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return mySections
    const q = searchQuery.toLowerCase()
    return mySections.filter((section) => {
      const parent = api.getSubject(section.subjectId)
      return (
        parent?.name.toLowerCase().includes(q) ||
        parent?.code.toLowerCase().includes(q) ||
        section.teacherName.toLowerCase().includes(q) ||
        section.room.toLowerCase().includes(q)
      )
    })
  }, [mySections, searchQuery])

  const handleSubjectTap = (sectionId: string) => {
    router.push(`/(tabs)/subject-info/${sectionId}`)
  }

  const bg = isDark ? '#0A0A0C' : '#F5F5F5'
  const surface = isDark ? '#121215' : '#FFFFFF'
  const border = isDark ? 'rgba(245, 168, 0, 0.15)' : '#DDD'
  const textPrimary = isDark ? '#FFFFFF' : '#333'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888'
  const iconColor = isDark ? '#FFDF00' : '#7B1113'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={iconColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFDF00' : '#4A0A0B' }]}>All Subjects</Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: surface, borderBottomColor: border }]}>
        <View style={[styles.searchWrapper, { backgroundColor: isDark ? '#0A0A0C' : '#F3F4F6', borderColor: border }]}>
          <MaterialIcons name="search" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: textPrimary }]}
            placeholder="Search subjects, codes, instructors..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <MaterialIcons name="cancel" size={16} color={isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF'} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Subjects List */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {filteredSections.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: border, backgroundColor: isDark ? '#121215' : '#FAFAFA' }]}>
            <MaterialIcons name="book" size={32} color={isDark ? 'rgba(255,255,255,0.2)' : '#CCC'} />
            <Text style={[styles.emptyText, { color: textSecondary }]}>No subjects found</Text>
          </View>
        ) : (
          filteredSections.map((section) => {
            const parent = api.getSubject(section.subjectId)
            const presentCount = myAttendance.filter((r) => r.sectionId === section.id && r.status === 'present').length
            return (
              <TouchableOpacity
                key={section.id}
                style={[styles.allSubjCard, { backgroundColor: surface }]}
                onPress={() => handleSubjectTap(section.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.allSubjAccent, { backgroundColor: isDark ? '#FFDF00' : '#7B1113' }]} />
                <View style={styles.allSubjBody}>
                  <Text style={[styles.allSubjName, { color: textPrimary }]}>{parent?.name ?? ''}</Text>
                  <Text style={[styles.allSubjMeta, { color: textSecondary }]}>
                    {parent?.code ?? ''} · Sec {section.section}
                  </Text>
                  <View style={styles.allSubjDetails}>
                    <View style={styles.allSubjDetailRow}>
                      <MaterialIcons name="person" size={12} color={isDark ? 'rgba(255,255,255,0.4)' : '#888'} />
                      <Text style={[styles.allSubjDetailText, { color: textSecondary }]}>{section.teacherName}</Text>
                    </View>
                    <View style={styles.allSubjDetailRow}>
                      <MaterialIcons name="room" size={12} color={isDark ? 'rgba(255,255,255,0.4)' : '#888'} />
                      <Text style={[styles.allSubjDetailText, { color: textSecondary }]}>{section.room}</Text>
                    </View>
                    <View style={styles.allSubjDetailRow}>
                      <MaterialIcons name="calendar-today" size={12} color={isDark ? 'rgba(255,255,255,0.4)' : '#888'} />
                      <Text style={[styles.allSubjDetailText, { color: textSecondary }]}>
                        {section.schedule.map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join(', ')}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.allSubjFooter, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F0' }]}>
                    <View style={[styles.allSubjRateBg, { backgroundColor: isDark ? '#27272A' : '#EEE' }]}>
                      <View
                        style={[
                          styles.allSubjRateFill,
                          {
                            width: `${myAttendance.filter((r) => r.sectionId === section.id).length > 0
                              ? Math.round((presentCount / myAttendance.filter((r) => r.sectionId === section.id).length) * 100)
                              : 0}%`
                          }
                        ]}
                      />
                    </View>
                    <Text style={[styles.allSubjRateText, { color: textSecondary }]}>
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
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Lora_400Regular' },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  clearBtn: { padding: 4 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  emptyCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyText: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700', marginTop: 16 },
  allSubjCard: { borderRadius: 0, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, flexDirection: 'row' },
  allSubjAccent: { width: 4 },
  allSubjBody: { padding: 14, flex: 1 },
  allSubjName: { fontSize: 15, fontWeight: '700', fontFamily: 'Lora_400Regular' },
  allSubjMeta: { fontSize: 11, marginTop: 2 },
  allSubjDetails: { marginTop: 8, gap: 4 },
  allSubjDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allSubjDetailText: { fontSize: 11, flex: 1 },
  allSubjFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  allSubjRateBg: { flex: 1, height: 4, borderRadius: 2 },
  allSubjRateFill: { height: 4, backgroundColor: '#FFDF00', borderRadius: 2 },
  allSubjRateText: { fontSize: 10, fontWeight: '700', minWidth: 30, textAlign: 'right' },
})
