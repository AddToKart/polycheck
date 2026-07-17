import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '../../../services/api-client'
import { fonts } from '../../../theme/typography'
import { useTheme } from '../../../theme/ThemeContext'
import type { User, Session, Subject, Section } from '@polycheck/shared'

export default function FacultySessionsScreen() {
  const { isDark } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [allSections, setAllSections] = useState<Section[]>([])

  useEffect(() => {
    const cu = api.getCurrentUser()
    if (cu) {
      setUser(cu)
      void Promise.all([api.getSessions(), api.getSubjects(), api.getSections()]).then(([nextSessions, nextSubjects, nextSections]) => {
        setSessions(nextSessions)
        setSubjects(nextSubjects)
        setAllSections(nextSections)
      })
    }
  }, [])

  if (!user) return null

  const subjectSessionMap: Record<string, { subject: Subject; sessions: Session[] }> = {}
  for (const session of sessions) {
    const section = allSections.find(s => s.id === session.sectionId)
    if (!section) continue
    const subjectId = section.subjectId
    const subject = subjects.find(s => s.id === subjectId)
    if (!subject) continue
    if (!subjectSessionMap[subjectId]) {
      subjectSessionMap[subjectId] = { subject, sessions: [] }
    }
    subjectSessionMap[subjectId].sessions.push(session)
  }

  const handleActivate = (sessionId: string) => {
    router.push(`/(faculty)/sessions/${sessionId}`)
  }

  const handleLogout = () => {
    api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.heading, isDark && styles.textGolden]}>Sessions</Text>
        <View style={styles.headerRight}>
          {user.role === 'teacher' && (
            <TouchableOpacity onPress={() => router.push('/(faculty)/sessions/create')} style={styles.iconBtn} accessibilityLabel="Create session">
              <MaterialIcons name="add" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} accessibilityLabel="Sign out">
            <MaterialIcons name="logout" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {Object.entries(subjectSessionMap).map(([subjectId, group]) => (
          <View key={subjectId} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={[styles.groupTitle, isDark && styles.textGolden]}>{group.subject.name}</Text>
              <TouchableOpacity
                onPress={() => router.push(`/(faculty)/subjects/${subjectId}/sessions`)}
                style={styles.viewAllBtn}
                accessibilityRole="button"
                accessibilityLabel="View all sessions"
              >
                <Text style={[styles.viewAllText, isDark && styles.textGolden]}>View All</Text>
                <MaterialIcons name="arrow-forward" size={14} color={isDark ? '#FFDF00' : '#7B1113'} />
              </TouchableOpacity>
            </View>
            {group.sessions.map((session) => {
              const section = allSections.find(s => s.id === session.sectionId)
              return (
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
                    {section ? (
                      <Text style={[styles.sessionSection, isDark && styles.textWhite50]}>
                        <MaterialIcons name="people" size={12} color={isDark ? 'rgba(255,255,255,0.5)' : '#888'} /> Sec {section.section}
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
              )
            })}
          </View>
        ))}
        {sessions.length === 0 && (
          <Text style={[styles.empty, isDark && styles.textWhite50]}>No sessions found.</Text>
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
  heading: { flex: 1, fontSize: 22, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A' },
  headerRight: { flexDirection: 'row', gap: 8 },
  textWhite: { color: '#FFFFFF' },
  textWhite70: { color: 'rgba(255,255,255,0.7)' },
  textWhite50: { color: 'rgba(255,255,255,0.5)' },
  textGolden: { color: '#FFDF00' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  group: { marginBottom: 24 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  groupTitle: { fontSize: 18, fontWeight: '700', fontFamily: fonts.heading, color: '#1A1A1A' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: '#7B1113' },
  sessionCard: { backgroundColor: '#FFFFFF', borderRadius: 0, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardDark: { backgroundColor: '#121215', borderWidth: 1, borderColor: 'rgba(245, 168, 0, 0.15)' },
  sessionLeft: { flex: 1 },
  sessionDate: { fontSize: 15, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#333' },
  sessionTime: { fontSize: 12, fontFamily: fonts.body, color: '#888', marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionRoom: { fontSize: 11, fontFamily: fonts.body, color: '#999', marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionSection: { fontSize: 11, fontFamily: fonts.body, color: '#999', marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
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
