import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import type { Section, Subject } from '@polycheck/shared'
import { api } from '../../../services/api-client'
import { useTheme } from '../../../theme/ThemeContext'
import { CampusHeader } from '../../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, SectionHeading } from '../../../components/CampusPrimitives'

export default function SubjectDetailScreen() {
  const { isDark } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const isTeacher = api.getCurrentUser()?.role === 'teacher'

  useEffect(() => {
    if (!id) return
    void Promise.all([api.getSubject(id), api.getSections(id)])
      .then(([nextSubject, nextSections]) => { setSubject(nextSubject); setSections(nextSections) })
      .catch(() => router.back())
  }, [id])

  if (!subject) return null

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader eyebrow={subject.code} title={subject.name} subtitle={subject.description || `${sections.length} class sections`} onBack={() => router.replace('/(faculty)/subjects')} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-20">
        <SectionHeading eyebrow={`${sections.length} total`} title="Class sections" />
        {isTeacher ? <CampusButton label="Add class section" icon="add" onPress={() => router.push({ pathname: '/(faculty)/sections/create', params: { subjectId: id } })} className="mb-5" /> : null}
        <View className="gap-3">
          {!sections.length ? <CampusEmptyState icon="view-list" title="No sections yet" description={isTeacher ? 'Add a section to assign its room, semester, and weekly schedule.' : 'Faculty-created sections will appear here.'} /> : sections.map((section) => (
            <CampusCard key={section.id} onPress={() => router.push(`/(faculty)/sections/${section.id}`)} accessibilityLabel={`Open section ${section.section}`}>
              <View className="flex-row items-start gap-4">
                <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-maroon dark:bg-golden"><Text className="font-sans-bold text-sm text-white dark:text-maroon-dark">{section.section}</Text></View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-base text-ink dark:text-white">Section {section.section}</Text>
                  <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{section.teacherName}</Text>
                  <View className="mt-4 gap-2">
                    <View className="flex-row items-center gap-2"><MaterialIcons name="room" size={16} color={isDark ? '#A1A1AA' : '#746C6E'} /><Text className="font-sans text-xs text-muted dark:text-zinc-400">{section.room || 'Room TBA'}</Text></View>
                    <View className="flex-row items-center gap-2"><MaterialIcons name="groups" size={16} color={isDark ? '#A1A1AA' : '#746C6E'} /><Text className="font-sans text-xs text-muted dark:text-zinc-400">{section.studentCount} students</Text></View>
                  </View>
                  <View className="mt-4 flex-row items-center justify-between border-t border-line pt-4 dark:border-line-dark">
                    <Text className="font-sans-bold text-xs text-maroon dark:text-golden">View section</Text>
                    <CampusButton label="Sessions" icon="event" variant="secondary" onPress={() => router.push({ pathname: '/(faculty)/subjects/[id]/sessions', params: { id, sectionId: section.id } })} className="min-h-11 px-3" />
                  </View>
                </View>
              </View>
            </CampusCard>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
