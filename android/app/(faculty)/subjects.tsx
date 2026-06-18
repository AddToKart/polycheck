import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../services/mock-api'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../theme/ThemeContext'
import type { User, Subject } from '@polycheck/shared'

export default function FacultySubjectsScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      setSubjects(api.getSubjects(cu.id))
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
        <Text style={[styles.heading, isDark && styles.textWhite]}>My Subjects</Text>
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
        {subjects.map((subject) => (
          <View key={subject.id} style={[styles.card, isDark && styles.cardDark]}>
            <View style={[styles.cardAccent, isDark && styles.cardAccentDark]} />
            <View style={styles.cardBody}>
              <Text style={[styles.subjectName, isDark && styles.textWhite]}>{subject.name}</Text>
              <Text style={[styles.subjectMeta, isDark && styles.textWhite50]}>
                {subject.code} · Section {subject.section}
              </Text>
              <View style={styles.subjectDetails}>
                <View style={styles.detailRow}>
                  <MaterialIcons name="room" size={14} color="#888" />
                  <Text style={[styles.detailText, isDark && styles.textWhite50]}>Room: {subject.room}</Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="calendar-today" size={14} color="#888" />
                  <Text style={[styles.detailText, isDark && styles.textWhite50]}>
                    {subject.schedule.map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join(', ')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="person" size={14} color="#888" />
                  <Text style={[styles.detailText, isDark && styles.textWhite50]}>Teacher: {subject.teacherName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="people" size={14} color="#888" />
                  <Text style={[styles.detailText, isDark && styles.textWhite50]}>Students: {subject.studentCount} enrolled</Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="vpn-key" size={14} color="#888" />
                  <Text style={[styles.detailText, isDark && styles.textWhite50]}>
                    Code: <Text style={[styles.enrollmentCode, isDark && styles.textGolden]}>{subject.enrollmentCode}</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
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
  containerDark: { backgroundColor: '#0A0A0A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerDark: { backgroundColor: '#1A1A1A', borderBottomColor: '#222' },
  iconBtn: { padding: 6 },
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#4A0A0B' },
  headerRight: { flexDirection: 'row', gap: 8 },
  textWhite: { color: '#FFFFFF' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#F5A800' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 0, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardDark: { backgroundColor: '#1A1A1A' },
  cardAccent: { width: 4, height: '100%', backgroundColor: '#7B1113', position: 'absolute', left: 0, top: 0, bottom: 0 },
  cardAccentDark: { backgroundColor: '#F5A800' },
  cardBody: { padding: 20, paddingLeft: 24 },
  subjectName: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#333' },
  subjectMeta: { fontSize: 13, fontFamily: fonts.body, color: '#888', marginTop: 2 },
  subjectDetails: { marginTop: 12, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, fontFamily: fonts.body, color: '#888', flex: 1 },
  enrollmentCode: { fontFamily: fonts.mono, fontWeight: '700', color: '#7B1113' },
  empty: { textAlign: 'center', fontFamily: fonts.body, paddingVertical: 60, color: '#BBB' },
})
