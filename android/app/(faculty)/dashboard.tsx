import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { formatTime } from '@polycheck/shared/utils'
import type { CalendarEvent, DashboardOverview, Section, Subject, User } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import {
  CampusButton,
  CampusCard,
  CampusEmptyState,
  CampusIconButton,
  MetricTile,
  SectionHeading,
} from '../../components/CampusPrimitives'

const campusDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const campusDate = (date = new Date()) => {
  const parts = new Map(campusDateFormatter.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}

export default function FacultyDashboardScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(api.getCurrentUser())
  const [sections, setSections] = useState<Section[]>([])
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [subjects, setSubjects] = useState<Record<string, Subject>>({})
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadDashboard = useCallback(async (currentUser: User) => {
    const today = campusDate()
    const [nextSections, events, subjectList, nextOverview] = await Promise.all([
      api.getSections(),
      api.getCalendarEvents(currentUser.id, today, today),
      api.getSubjects(),
      api.getDashboardOverview(),
    ])
    setSections(nextSections.filter((section) => section.teacherId === currentUser.id || currentUser.role === 'super_admin'))
    setTodayEvents(events.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    setSubjects(Object.fromEntries(subjectList.map((subject) => [subject.id, subject])))
    setOverview(nextOverview)
  }, [])

  useEffect(() => {
    const currentUser = api.getCurrentUser()
    if (!currentUser) return
    setUser(currentUser)
    void loadDashboard(currentUser).catch(() => Alert.alert('Unable to load dashboard', 'Pull down to try again.'))
  }, [loadDashboard])

  if (!user) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-campus dark:bg-campus-dark">
        <ActivityIndicator size="large" color="#7B1113" />
      </SafeAreaView>
    )
  }

  const isSuper = user.role === 'super_admin'
  const sessionsToday = overview?.counts.sessionsToday ?? 0
  const pendingDisputes = overview?.counts.pendingDisputes ?? 0

  const refresh = async () => {
    setRefreshing(true)
    try {
      await loadDashboard(user)
    } catch {
      Alert.alert('Unable to refresh', 'Check your connection and try again.')
    } finally {
      setRefreshing(false)
    }
  }

  const signOut = () => {
    void api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader
        eyebrow={isSuper ? 'University Oversight' : 'Faculty Workspace'}
        title={user.fullName}
        subtitle={isSuper ? 'Institution activity and reporting at a glance.' : 'Your classes, sessions, and attendance today.'}
        actions={(
          <>
            <CampusIconButton icon="search" label="Search" onPress={() => router.push('/(faculty)/search')} inverse />
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
            <CampusIconButton icon="logout" label="Sign out" onPress={signOut} inverse />
          </>
        )}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={isDark ? '#FFDF00' : '#7B1113'} />}
      >
        {pendingDisputes > 0 ? (
          <CampusCard
            className="mb-4 rounded-none border-l-4 border-l-red-600 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20"
            onPress={() => router.push('/(faculty)/disputes')}
            accessibilityLabel={`Review ${pendingDisputes} pending disputes`}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-none bg-red-100 dark:bg-red-900/40">
                <MaterialIcons name="gavel" size={20} color={isDark ? '#FCA5A5' : '#B91C1C'} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-sm uppercase tracking-wider text-red-900 dark:text-red-200">
                  {isSuper ? 'Disputes Need Teacher Action' : 'Attendance Disputes To Review'}
                </Text>
                <Text className="mt-0.5 font-sans text-xs text-red-700 dark:text-red-300">
                  {pendingDisputes} record{pendingDisputes === 1 ? ' is' : 's are'} waiting for a decision.
                </Text>
              </View>
              <MaterialIcons name="arrow-forward" size={18} color={isDark ? '#FCA5A5' : '#B91C1C'} />
            </View>
          </CampusCard>
        ) : null}

        <View className="mb-7 flex-row flex-wrap gap-3">
          <MetricTile label="Subjects" value={overview?.counts.subjects ?? 0} icon="auto-stories" />
          <MetricTile label="Students" value={overview?.counts.students ?? 0} icon="groups" />
          <MetricTile label="Sessions Today" value={sessionsToday} icon="today" />
          <MetricTile label="Pending Disputes" value={pendingDisputes} icon="gavel" emphasis={pendingDisputes ? 'alert' : 'neutral'} />
        </View>

        <SectionHeading
          eyebrow="Today"
          title={isSuper ? 'Session Monitoring' : 'Class Schedule'}
          actionLabel="Calendar"
          onAction={() => router.push('/(faculty)/schedule')}
        />
        <View className="mb-8 gap-3">
          {todayEvents.length === 0 ? (
            <CampusEmptyState icon="event-available" title="NO SESSIONS TODAY" description="Scheduled and active class sessions will appear here." />
          ) : todayEvents.map((event) => {
            const active = event.status === 'active'
            const completed = event.status === 'completed'
            const moved = event.status === 'moved'

            return (
              <CampusCard key={event.id} className="p-4 rounded-none border-l-4 border-l-maroon dark:border-l-golden">
                <View className="flex-row items-center gap-4">
                  <View className={`h-12 w-12 items-center justify-center rounded-none ${active ? 'bg-golden' : 'bg-maroon/5 dark:bg-white/5 border border-maroon/10 dark:border-white/10'}`}>
                    <MaterialIcons
                      name={active ? 'radio-button-checked' : completed ? 'check-circle' : moved ? 'event-busy' : 'event'}
                      size={20}
                      color={active ? '#4A0A0B' : moved ? '#DC2626' : isDark ? '#FFDF00' : '#7B1113'}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-maroon dark:text-golden">
                      {formatTime(event.startTime)} – {formatTime(event.endTime)}
                    </Text>
                    <Text className="mt-0.5 font-sans-bold text-base text-ink dark:text-white" numberOfLines={1}>{event.subjectName}</Text>
                    <Text className="mt-0.5 font-sans text-xs text-muted dark:text-zinc-400 uppercase tracking-wider">
                      Sec {event.sectionName}{event.room ? ` · ${event.room}` : ''}
                    </Text>
                  </View>
                </View>

                <View className="mt-4 border-t border-line pt-3 dark:border-line-dark">
                  {active ? (
                    <CampusButton label="Open active session" icon="arrow-forward" onPress={() => router.push(`/(faculty)/sessions/${event.id}`)} />
                  ) : completed || moved || isSuper ? (
                    <View className="self-start rounded-none border border-line bg-zinc-100 px-3 py-1.5 dark:border-line-dark dark:bg-white/5">
                      <Text className={`font-sans-bold text-[10px] uppercase tracking-widest ${moved ? 'text-red-700 dark:text-red-300' : 'text-muted dark:text-zinc-300'}`}>
                        {moved ? 'Moved' : completed ? 'Completed' : 'Scheduled'}
                      </Text>
                    </View>
                  ) : (
                    <CampusButton
                      label="Activate session"
                      icon="qr-code-2"
                      variant="secondary"
                      onPress={() => router.push({ pathname: '/(faculty)/sessions/create', params: { sectionId: event.sectionId } })}
                    />
                  )}
                </View>
              </CampusCard>
            )
          })}
        </View>

        <SectionHeading
          eyebrow={isSuper ? 'Institution' : 'Teaching'}
          title={isSuper ? 'Subject Directory' : 'My Classes'}
          actionLabel="View All"
          onAction={() => router.push('/(faculty)/subjects')}
        />
        <View className="gap-3">
          {sections.length === 0 ? (
            <CampusEmptyState icon="auto-stories" title="NO CLASSES ASSIGNED" description="Classes assigned to this account will appear here." />
          ) : sections.map((section) => {
            const subject = subjects[section.subjectId]
            return (
              <CampusCard
                key={section.id}
                onPress={() => router.push(`/(faculty)/sections/${section.id}`)}
                accessibilityLabel={`Open ${subject?.name ?? 'class'}`}
                className="p-4 rounded-none border-l-4 border-l-maroon dark:border-l-golden"
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-11 w-11 items-center justify-center rounded-none bg-maroon/5 dark:bg-golden/10 border border-maroon/10 dark:border-golden/20">
                    <Text className="font-sans-bold text-xs text-maroon dark:text-golden">{subject?.code?.slice(0, 4) ?? 'PUP'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold text-base text-ink dark:text-white" numberOfLines={1}>{subject?.name ?? section.id}</Text>
                    <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400 uppercase tracking-wider">
                      Section {section.section} · {section.studentCount} Students
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={isDark ? '#A1A1AA' : '#746C6E'} />
                </View>
              </CampusCard>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
