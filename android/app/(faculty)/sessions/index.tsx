import { useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { Section, Session, Subject, User } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useTheme } from '../../../theme/ThemeContext'
import { CampusHeader } from '../../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton, SectionHeading } from '../../../components/CampusPrimitives'

export default function FacultySessionsScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])

  useEffect(() => {
    const currentUser = api.getCurrentUser()
    if (!currentUser) return
    setUser(currentUser)
    void Promise.all([api.getSessions(), api.getSubjects(), api.getSections()])
      .then(([nextSessions, nextSubjects, nextSections]) => {
        setSessions(nextSessions)
        setSubjects(nextSubjects)
        setSections(nextSections)
      })
      .catch(() => Alert.alert('Unable to load sessions', 'Check your connection and try again.'))
  }, [])

  const groupedSessions = useMemo(() => subjects.map((subject) => ({
    subject,
    sessions: sessions.filter((session) => {
      const section = sections.find((item) => item.id === session.sectionId)
      return section?.subjectId === subject.id
    }),
  })).filter((group) => group.sessions.length > 0), [sections, sessions, subjects])

  if (!user) return null
  const isSuper = user.role === 'super_admin'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader
        eyebrow={isSuper ? 'Session oversight' : 'Attendance workspace'}
        title={isSuper ? 'Session monitoring' : 'Class sessions'}
        subtitle={isSuper ? 'Observe active and completed sessions across the institution.' : 'Activate an upcoming class or review a previous session.'}
        actions={(
          <>
            {!isSuper ? <CampusIconButton icon="add" label="Create session" onPress={() => router.push('/(faculty)/sessions/create')} inverse /> : null}
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
          </>
        )}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}>
        {groupedSessions.length === 0 ? (
          <CampusEmptyState icon="event-busy" title="No sessions found" description="Create a session from a class section when attendance is ready to begin." />
        ) : groupedSessions.map((group) => (
          <View key={group.subject.id} className="mb-7">
            <SectionHeading
              eyebrow={group.subject.code}
              title={group.subject.name}
              actionLabel="View all"
              onAction={() => router.push(`/(faculty)/subjects/${group.subject.id}/sessions`)}
            />
            <View className="gap-3">
              {group.sessions.map((session) => {
                const section = sections.find((item) => item.id === session.sectionId)
                return (
                  <CampusCard
                    key={session.id}
                    onPress={() => router.push(`/(faculty)/sessions/${session.id}`)}
                    accessibilityLabel={`Open session on ${session.date}`}
                    className="p-4"
                  >
                    <View className="flex-row items-center gap-4">
                      <View className={`h-14 w-14 items-center justify-center rounded-[20px] ${session.isActive ? 'bg-golden' : 'bg-maroon/5 dark:bg-white/5'}`}>
                        <MaterialIcons name={session.isActive ? 'radio-button-checked' : 'event'} size={22} color={session.isActive ? '#4A0A0B' : isDark ? '#FFDF00' : '#7B1113'} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-sans-bold text-base text-ink dark:text-white">
                          {new Date(session.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                        <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{session.startTime} – {session.endTime}</Text>
                        <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">Section {section?.section ?? '—'}{session.room ? ` · ${session.room}` : ''}</Text>
                      </View>
                      <View className={`rounded-full px-3 py-2 ${session.isActive ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-zinc-100 dark:bg-white/5'}`}>
                        <Text className={`font-sans-bold text-[10px] ${session.isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted dark:text-zinc-300'}`}>
                          {session.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    {!session.isActive && !isSuper ? (
                      <CampusButton
                        label="Open to activate"
                        icon="play-arrow"
                        variant="secondary"
                        className="mt-4"
                        onPress={() => router.push(`/(faculty)/sessions/${session.id}`)}
                      />
                    ) : null}
                  </CampusCard>
                )
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
