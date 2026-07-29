import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import type { Section, Session, Subject } from '@polycheck/shared'
import { api } from '../../../../services/api-client'
import { useTheme } from '../../../../theme/ThemeContext'
import { CampusHeader } from '../../../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, SectionHeading } from '../../../../components/CampusPrimitives'

const days = ['All', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SubjectSessionsScreen() {
  const { isDark } = useTheme()
  const { id, sectionId: paramSectionId } = useLocalSearchParams<{ id: string; sectionId?: string }>()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState(paramSectionId ?? '')
  const [selectedDay, setSelectedDay] = useState('')
  const [sectionPickerVisible, setSectionPickerVisible] = useState(false)
  const isTeacher = api.getCurrentUser()?.role === 'teacher'

  useEffect(() => {
    if (!id) return
    void Promise.all([api.getSubject(id), api.getSections(id)])
      .then(async ([nextSubject, subjectSections]) => {
        const sessionGroups = await Promise.all(subjectSections.map((section) => api.getSectionSessions(section.id)))
        setSubject(nextSubject)
        setSections(subjectSections)
        setSessions(sessionGroups.flat().sort((a, b) => b.date.localeCompare(a.date)))
      })
      .catch(() => router.back())
  }, [id])

  useEffect(() => { if (paramSectionId) setSelectedSectionId(paramSectionId) }, [paramSectionId])

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    if (selectedSectionId && session.sectionId !== selectedSectionId) return false
    if (selectedDay && weekDayNames[new Date(`${session.date}T00:00:00`).getDay()] !== selectedDay) return false
    return true
  }), [selectedDay, selectedSectionId, sessions])

  const groupedSessions = useMemo(() => sections.map((section) => ({
    section,
    sessions: filteredSessions.filter((session) => session.sectionId === section.id),
  })).filter((group) => group.sessions.length), [filteredSessions, sections])

  if (!subject) return null
  const selectedSection = sections.find((section) => section.id === selectedSectionId)

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader eyebrow={subject.code} title="Subject sessions" subtitle={subject.name} onBack={() => router.replace(`/(faculty)/subjects/${id}`)} />

      <View className="px-4">
        <Pressable accessibilityRole="button" accessibilityLabel={`Filter by ${selectedSection ? `Section ${selectedSection.section}` : 'all sections'}`} onPress={() => setSectionPickerVisible(true)} className={`mb-3 min-h-12 flex-row items-center gap-2 rounded-2xl border px-4 ${selectedSectionId ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}>
          <MaterialIcons name="filter-list" size={18} color={selectedSectionId ? isDark ? '#4A0A0B' : '#FFFFFF' : isDark ? '#FFDF00' : '#7B1113'} />
          <Text className={`flex-1 font-sans-bold text-xs ${selectedSectionId ? 'text-white dark:text-maroon-dark' : 'text-ink dark:text-white'}`}>{selectedSection ? `Section ${selectedSection.section}` : 'All sections'}</Text>
          <MaterialIcons name="expand-more" size={20} color={selectedSectionId ? isDark ? '#4A0A0B' : '#FFFFFF' : isDark ? '#A1A1AA' : '#746C6E'} />
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-4">
          {days.map((day) => {
            const active = day === 'All' ? !selectedDay : selectedDay === day
            return <Pressable key={day} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={`Show ${day.toLowerCase()} sessions`} onPress={() => setSelectedDay(day === 'All' ? '' : day)} className={`min-h-11 justify-center rounded-full border px-4 ${active ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}><Text className={`font-sans-bold text-xs ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-400'}`}>{day}</Text></Pressable>
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-20">
        {!groupedSessions.length ? <CampusEmptyState icon="event-busy" title="No matching sessions" description="Change the section or day filter to see more sessions." /> : groupedSessions.map(({ section, sessions: sectionSessions }) => (
          <View key={section.id} className="mb-7">
            <SectionHeading eyebrow={subject.code} title={`Section ${section.section}${section.room ? ` · ${section.room}` : ''}`} />
            <View className="gap-3">
              {sectionSessions.map((session) => (
                <CampusCard key={session.id} onPress={() => router.push(`/(faculty)/sessions/${session.id}`)} accessibilityLabel={`Open session on ${session.date}`} className="p-4">
                  <View className="flex-row items-center gap-4">
                    <View className={`h-14 w-14 items-center justify-center rounded-[20px] ${session.isActive ? 'bg-golden' : 'bg-maroon/5 dark:bg-white/5'}`}><MaterialIcons name={session.isActive ? 'radio-button-checked' : 'event'} size={22} color={session.isActive ? '#4A0A0B' : isDark ? '#FFDF00' : '#7B1113'} /></View>
                    <View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{new Date(`${session.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{session.startTime}–{session.endTime}{session.room ? ` · ${session.room}` : ''}</Text></View>
                    <View className={`rounded-full px-3 py-2 ${session.isActive ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-zinc-100 dark:bg-white/5'}`}><Text className={`font-sans-bold text-[10px] ${session.isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted dark:text-zinc-300'}`}>{session.isActive ? 'Active' : 'Inactive'}</Text></View>
                  </View>
                  {!session.isActive && isTeacher ? <CampusButton label="Open to activate" icon="play-arrow" variant="secondary" onPress={() => router.push(`/(faculty)/sessions/${session.id}`)} className="mt-4" /> : null}
                </CampusCard>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={sectionPickerVisible} transparent animationType="fade" onRequestClose={() => setSectionPickerVisible(false)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setSectionPickerVisible(false)}>
          <View className="max-h-[70%] rounded-t-[32px] bg-white p-5 pb-8 dark:bg-surface-dark" onStartShouldSetResponder={() => true}>
            <View className="mb-5 h-1 w-10 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <Text className="mb-4 font-heading text-2xl text-ink dark:text-white">Choose a section</Text>
            <ScrollView>
              {[{ id: '', section: 'All sections', room: '' }, ...sections].map((section) => {
                const active = section.id === selectedSectionId
                return <Pressable key={section.id || 'all'} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => { setSelectedSectionId(section.id); setSectionPickerVisible(false) }} className={`mb-2 min-h-14 flex-row items-center rounded-2xl border px-4 ${active ? 'border-maroon bg-maroon/5 dark:border-golden dark:bg-golden/10' : 'border-line dark:border-line-dark'}`}><Text className="flex-1 font-sans-bold text-sm text-ink dark:text-white">{section.id ? `Section ${section.section}${section.room ? ` · ${section.room}` : ''}` : section.section}</Text>{active ? <MaterialIcons name="check-circle" size={20} color={isDark ? '#FFDF00' : '#7B1113'} /> : null}</Pressable>
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
