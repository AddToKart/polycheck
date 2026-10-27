import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { Section, Session, Subject } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useAuthGate } from '../../../hooks/use-auth-gate'
import { useTheme } from '../../../theme/ThemeContext'
import { pupColors } from '../../../theme/colors'
import { CampusHeader } from '../../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton, SectionHeading } from '../../../components/CampusPrimitives'
import { FilterChipsRow, FilterPanel, FilterSelect } from '../../../components/FilterPrimitives'
import { useCampusToast } from '../../../components/CampusToast'
import { campusDate, datePresetRange, filterSessions, type DatePreset, type SessionStatusFilter } from '../../../lib/filters'

const statusOptions: Array<{ value: SessionStatusFilter; label: string }> = [
  { value: 'all', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
]

const dateOptions: Array<{ value: DatePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'upcoming7', label: 'Next 7 days' },
]

export default function FacultySessionsScreen() {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const user = useAuthGate(['teacher', 'super_admin'])
  const [sessions, setSessions] = useState<Session[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')

  useEffect(() => {
    if (!user) return
    void Promise.all([api.getSessions(), api.getSubjects(), api.getSections()])
      .then(([nextSessions, nextSubjects, nextSections]) => {
        setSessions(nextSessions)
        setSubjects(nextSubjects)
        setSections(nextSections)
      })
      .catch(() => showToast('error', 'Unable to load sessions', 'Check your connection and try again.'))
  }, [showToast, user])

  const sectionOptions = useMemo(() => sections
    .filter((section) => !selectedSubjectId || section.subjectId === selectedSubjectId)
    .map((section) => ({ id: section.id, label: `Section ${section.section}`, hint: subjects.find((subject) => subject.id === section.subjectId)?.code })), [sections, selectedSubjectId, subjects])

  const filteredSessions = useMemo(() => filterSessions(sessions, {
    subjectId: selectedSubjectId || undefined,
    sectionId: selectedSectionId || undefined,
    status: statusFilter,
    ...datePresetRange(datePreset),
  }, {
    today: campusDate(),
    subjectForSection: (sectionId) => sections.find((section) => section.id === sectionId)?.subjectId,
  }), [datePreset, sections, selectedSectionId, selectedSubjectId, sessions, statusFilter])

  const groupedSessions = useMemo(() => subjects.map((subject) => ({
    subject,
    sessions: filteredSessions.filter((session) => {
      const section = sections.find((item) => item.id === session.sectionId)
      return section?.subjectId === subject.id
    }),
  })).filter((group) => group.sessions.length > 0), [filteredSessions, sections, subjects])

  const isFiltered = selectedSubjectId !== '' || selectedSectionId !== '' || statusFilter !== 'all' || datePreset !== 'all'

  if (!user) return null
  const isSuper = user.role === 'super_admin'

  const selectSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId)
    if (selectedSectionId && subjectId) {
      const section = sections.find((candidate) => candidate.id === selectedSectionId)
      if (section?.subjectId !== subjectId) setSelectedSectionId('')
    }
  }

  const selectSection = (sectionId: string) => {
    setSelectedSectionId(sectionId)
    if (sectionId) {
      const section = sections.find((candidate) => candidate.id === sectionId)
      if (section && !selectedSubjectId) setSelectedSubjectId(section.subjectId)
    }
  }

  const clearFilters = () => {
    setSelectedSubjectId('')
    setSelectedSectionId('')
    setStatusFilter('all')
    setDatePreset('all')
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
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
        <FilterPanel filtered={isFiltered} onClear={clearFilters} title="Filter sessions">
          <View className="flex-row flex-wrap gap-2">
            <FilterSelect
              label="Subject"
              value={selectedSubjectId}
              placeholder="All subjects"
              options={subjects.map((subject) => ({ id: subject.id, label: `${subject.name} (${subject.code})` }))}
              onSelect={selectSubject}
              testID="sessions-subject-filter"
            />
            <FilterSelect
              label="Section"
              value={selectedSectionId}
              placeholder="All sections"
              options={sectionOptions}
              onSelect={selectSection}
              testID="sessions-section-filter"
            />
          </View>
          <FilterChipsRow
            label="Session status"
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            testID="sessions-status-filter"
          />
          <FilterChipsRow
            label="Session date"
            options={dateOptions}
            value={datePreset}
            onChange={setDatePreset}
            testID="sessions-date-filter"
          />
        </FilterPanel>

        {groupedSessions.length === 0 ? (
          <CampusEmptyState
            icon="event-busy"
            title={isFiltered ? 'No matching sessions' : 'No sessions found'}
            description={isFiltered ? 'Clear a filter or widen the date range to see more sessions.' : 'Create a session from a class section when attendance is ready to begin.'}
          />
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
                    testID={`session-card-${session.id}`}
                    onPress={() => router.push(`/(faculty)/sessions/${session.id}`)}
                    accessibilityLabel={`Open session on ${session.date}`}
                    className="p-4"
                  >
                    <View className="flex-row items-center gap-4">
                      <View className={`h-14 w-14 items-center justify-center rounded-[20px] ${session.isActive ? 'bg-golden' : 'bg-maroon/5 dark:bg-white/5'}`}>
                        <MaterialIcons name={session.isActive ? 'radio-button-checked' : 'event'} size={22} color={session.isActive ? pupColors.maroonDark : isDark ? pupColors.golden : pupColors.maroon} />
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
