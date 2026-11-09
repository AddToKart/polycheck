import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { Section, Subject } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusCard, CampusEmptyState, CampusIconButton, CampusLoadError, CampusSkeleton } from '../../components/CampusPrimitives'
import { useCampusToast } from '../../components/CampusToast'
import { useLoadState } from '../../hooks/use-load-state'

import { confirmSignOut } from '../../lib/sign-out'
export default function FacultySubjectsScreen() {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const user = useAuthGate(['teacher', 'super_admin'])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const loadState = useLoadState()

  useEffect(() => {
    if (!user) return
    let active = true
    void Promise.all([api.getSubjects(), api.getSections()])
      .then(([nextSubjects, nextSections]) => {
        if (!active) return
        setSubjects(nextSubjects)
        setSections(nextSections)
        loadState.markReady()
      })
      .catch(() => {
        if (!active) return
        loadState.markError()
        showToast('error', 'Unable to load subjects', 'Check your connection and try again.')
      })
    return () => { active = false }
  }, [showToast, user, loadState.reloadToken])

  if (!user) return null
  const isSuper = user.role === 'super_admin'

  const signOut = confirmSignOut

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.campus }}
      className="flex-1 bg-campus dark:bg-campus-dark"
    >
      <CampusHeader
        eyebrow={isSuper ? 'Institution catalog' : 'Teaching catalog'}
        title={isSuper ? 'Subject directory' : 'My subjects'}
        subtitle={isSuper ? 'Read-only access to subjects and their sections.' : 'Open a subject to manage its class sections.'}
        actions={(
          <>
            {!isSuper ? <CampusIconButton icon="add" label="Create subject" onPress={() => router.push('/(faculty)/subjects/create')} inverse /> : null}
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
            <CampusIconButton icon="logout" label="Sign out" onPress={signOut} inverse />
          </>
        )}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, gap: 12 }}>
        {loadState.state === 'loading' ? (
          <View accessibilityLabel="Loading subjects" className="gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <CampusSkeleton key={i} className="h-24 w-full"><View /></CampusSkeleton>
            ))}
          </View>
        ) : loadState.state === 'error' ? (
          <CampusLoadError
            title="Unable to load subjects"
            message="Your subjects and sections could not be fetched. Try again."
            onRetry={loadState.retry}
          />
        ) : subjects.length === 0 ? (
          <CampusEmptyState
            icon="auto-stories"
            title="No subjects yet"
            description={isSuper ? 'Subjects created by faculty will appear here.' : 'Create your first subject to begin adding class sections.'}
          />
        ) : subjects.map((subject) => {
          const sectionCount = sections.filter((section) => section.subjectId === subject.id).length
          return (
            <CampusCard
              key={subject.id}
              onPress={() => router.push(`/(faculty)/subjects/${subject.id}`)}
              accessibilityLabel={`Open ${subject.name}`}
            >
              <View className="flex-row items-start gap-4">
                <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-maroon dark:bg-golden">
                  <Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">{subject.code.slice(0, 5)}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-lg text-ink dark:text-white">{subject.name}</Text>
                  <Text className="mt-1 font-sans-bold text-xs text-maroon dark:text-golden">{subject.code}</Text>
                  {subject.description ? (
                    <Text className="mt-3 font-sans text-sm leading-5 text-muted dark:text-zinc-400" numberOfLines={2}>{subject.description}</Text>
                  ) : null}
                  <View className="mt-4 flex-row items-center justify-between border-t border-line pt-4 dark:border-line-dark">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="view-list" size={18} color={isDark ? '#A1A1AA' : '#746C6E'} />
                      <Text className="font-sans-medium text-xs text-muted dark:text-zinc-400">{sectionCount} section{sectionCount === 1 ? '' : 's'}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={19} color={isDark ? pupColors.golden : pupColors.maroon} />
                  </View>
                </View>
              </View>
            </CampusCard>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
