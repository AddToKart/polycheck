import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { api } from '../../../services/mock-api'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import type { Subject, Section } from '@polycheck/shared'

export default function SubjectDetailScreen() {
  const { isDark } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [sections, setSections] = useState<Section[]>([])

  useEffect(() => {
    if (!id) return
    void Promise.all([api.getSubject(id), api.getSections(id)]).then(([nextSubject, nextSections]) => {
      setSubject(nextSubject)
      setSections(nextSections)
    }).catch(() => router.back())
  }, [id])

  if (!subject) return null

  const bg = isDark ? '#0A0A0C' : '#F5F5F5'
  const surface = isDark ? '#121215' : '#FFFFFF'
  const border = isDark ? 'rgba(245, 168, 0, 0.15)' : '#EEE'
  const textPrimary = isDark ? '#FFFFFF' : '#333'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : '#888'
  const iconColor = isDark ? '#FFDF00' : '#7B1113'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: surface, borderBottomWidth: 1, borderBottomColor: border }}>
        <TouchableOpacity onPress={() => router.push('/(faculty)/subjects')} style={{ padding: 4, marginRight: 12 }} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={22} color={iconColor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text className="text-lg font-heading font-bold" style={{ color: isDark ? '#FFDF00' : '#4A0A0B' }} numberOfLines={1}>{subject.name}</Text>
          <Text className="text-xs mt-0.5" style={{ color: textSecondary }}>{subject.code}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {subject.description ? (
          <View style={{ backgroundColor: surface, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border }}>
            <Text className="text-sm font-sans" style={{ color: textPrimary }}>{subject.description}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, isDark && styles.textGolden]}>
            Sections ({sections.length})
          </Text>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(faculty)/sections/create', params: { subjectId: id } })}
            style={[styles.addSectionBtn, isDark && styles.addSectionBtnDark]}
            accessibilityRole="button"
            accessibilityLabel="Add section"
          >
            <MaterialIcons name="add" size={16} color={isDark ? '#4A0A0B' : '#FFFFFF'} />
            <Text style={[styles.addSectionBtnText, isDark && styles.addSectionBtnTextDark]}>Add Section</Text>
          </TouchableOpacity>
        </View>

        {sections.map((section) => (
          <Pressable
            key={section.id}
            onPress={() => router.push(`/(faculty)/sections/${section.id}`)}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.card, isDark && styles.cardDark]}>
              <View style={[styles.cardAccent, isDark && styles.cardAccentDark]} />
              <View style={styles.cardBody}>
                <Text style={[styles.sectionName, isDark && styles.textWhite]}>Section {section.section}</Text>
                <View style={styles.sectionDetails}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="room" size={14} color="#888" />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>Room: {section.room}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="calendar-today" size={14} color="#888" />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>
                      {section.schedule.map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join(', ')}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="person" size={14} color="#888" />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>Teacher: {section.teacherName}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="people" size={14} color="#888" />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>{section.studentCount} student{section.studentCount !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={[styles.cardAction, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F0' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="chevron-right" size={18} color={iconColor} />
                    <Text style={[styles.viewLabel, isDark && styles.textGolden]}>View Section</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/(faculty)/subjects/[id]/sessions', params: { id: id, sectionId: section.id } })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="event" size={16} color={iconColor} />
                      <Text style={[styles.viewLabel, isDark && styles.textGolden]}>Sessions</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Pressable>
        ))}

        {sections.length === 0 && (
          <Text style={[styles.empty, isDark && styles.textWhite50]}>No sections for this subject. Create sections to get started.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B', marginBottom: 12 },
  textGolden: { color: '#FFDF00' },
  textWhite: { color: '#FFFFFF' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 0, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  cardAccent: { width: 4, height: '100%', backgroundColor: '#7B1113', position: 'absolute', left: 0, top: 0, bottom: 0 },
  cardAccentDark: { backgroundColor: '#FFDF00' },
  cardBody: { padding: 16, paddingLeft: 24 },
  sectionName: { fontSize: 16, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333', marginBottom: 8 },
  sectionDetails: { gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, fontFamily: fonts.body, color: '#888', flex: 1 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  viewLabel: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 60, color: '#BBB' },
  addSectionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7B1113', paddingHorizontal: 12, paddingVertical: 6 },
  addSectionBtnDark: { backgroundColor: '#FFDF00' },
  addSectionBtnText: { fontSize: 12, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#FFFFFF' },
  addSectionBtnTextDark: { color: '#4A0A0B' },
})
