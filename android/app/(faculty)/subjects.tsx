import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/api-client'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, Section, Subject } from '@polycheck/shared'

export default function FacultySubjectsScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      void Promise.all([api.getSubjects(), api.getSections()]).then(([nextSubjects, nextSections]) => {
        setSubjects(nextSubjects)
        setSections(nextSections)
      })
    }
  }, [])

  if (!user) return null

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>My Subjects</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push('/(faculty)/subjects/create')} style={styles.iconBtn} accessibilityLabel="Create subject">
            <MaterialIcons name="add" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
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
        {subjects.map((subject) => {
          const sectionCount = sections.filter((section) => section.subjectId === subject.id).length
          return (
          <Pressable
            key={subject.id}
            onPress={() => router.push(`/(faculty)/subjects/${subject.id}`)}
            style={({ pressed }) => [
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.card, isDark && styles.cardDark]}>
              <View style={[styles.cardAccent, isDark && styles.cardAccentDark]} />
              <View style={styles.cardBody}>
                <Text style={[styles.subjectName, isDark && styles.textWhite]}>{subject.name}</Text>
                <Text style={[styles.subjectMeta, isDark && styles.textWhite50]}>{subject.code}</Text>
                {subject.description ? (
                  <Text style={[styles.description, isDark && styles.textWhite50]}>{subject.description}</Text>
                ) : null}
                <View style={styles.subjectDetails}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="people" size={14} color="#888" />
                    <Text style={[styles.detailText, isDark && styles.textWhite50]}>{sectionCount} section{sectionCount !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <View style={[styles.cardActions, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F0' }]}>
                  <TouchableOpacity
                    style={[styles.viewBtn, isDark && styles.viewBtnDark]}
                    onPress={() => router.push(`/(faculty)/subjects/${subject.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel="View sections"
                  >
                    <MaterialIcons name="list" size={16} color={isDark ? '#4A0A0B' : '#FFF'} />
                    <Text style={[styles.viewBtnText, isDark && styles.viewBtnTextDark]}>View Sections</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Pressable>
          )
        })}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#0A0A0C', borderBottomColor: '#1C1C21' },
  iconBtn: { padding: 6 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  headerRight: { flexDirection: 'row', gap: 8 },
  textWhite: { color: '#FFFFFF' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 0, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  cardAccent: { width: 4, height: '100%', backgroundColor: '#7B1113', position: 'absolute', left: 0, top: 0, bottom: 0 },
  cardAccentDark: { backgroundColor: '#FFDF00' },
  cardBody: { padding: 20, paddingLeft: 24 },
  subjectName: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#333' },
  subjectMeta: { fontSize: 13, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  description: { fontSize: 13, fontFamily: fonts.body, color: '#888', marginTop: 4, lineHeight: 18 },
  subjectDetails: { marginTop: 12, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, fontFamily: fonts.body, color: '#888', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  viewBtn: { backgroundColor: '#7B1113', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  viewBtnDark: { backgroundColor: '#FFDF00' },
  viewBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600', fontFamily: fonts.bodySemiBold },
  viewBtnTextDark: { color: '#4A0A0B' },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 60, color: '#BBB' },
})
