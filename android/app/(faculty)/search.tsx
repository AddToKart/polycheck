import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { Section, Session, Student, Subject } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusCard, CampusEmptyState, SectionHeading } from '../../components/CampusPrimitives'

type Results = { students: Student[]; sections: Section[]; sessions: Session[] }
const emptyResults: Results = { students: [], sections: [], sessions: [] }

const SearchResultCard = ({ icon, title, subtitle, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; subtitle: string; onPress: () => void }) => {
  const { isDark } = useTheme()
  return (
    <CampusCard onPress={onPress} accessibilityLabel={`Open ${title}`} className="p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10"><MaterialIcons name={icon} size={20} color={isDark ? '#FFDF00' : '#7B1113'} /></View>
        <View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white" numberOfLines={1}>{title}</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400" numberOfLines={2}>{subtitle}</Text></View>
        <MaterialIcons name="chevron-right" size={20} color={isDark ? '#A1A1AA' : '#746C6E'} />
      </View>
    </CampusCard>
  )
}

export default function FacultySearchScreen() {
  const { isDark } = useTheme()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Results>(emptyResults)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => { void api.getSubjects().then(setSubjects) }, [])
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults(emptyResults)
      setSearched(false)
      setSearching(false)
      return
    }
    let active = true
    setSearching(true)
    const timeout = setTimeout(() => {
      void api.search(trimmed)
        .then((nextResults) => { if (active) { setResults(nextResults); setSearched(true) } })
        .finally(() => { if (active) setSearching(false) })
    }, 250)
    return () => { active = false; clearTimeout(timeout) }
  }, [query])

  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects])
  const totalResults = results.students.length + results.sections.length + results.sessions.length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader eyebrow="Faculty tools" title="Global search" subtitle="Find students, class sections, and attendance sessions." onBack={() => router.back()} />
      <View className="mx-4 mb-2 min-h-14 flex-row items-center rounded-2xl border border-line bg-white px-4 dark:border-line-dark dark:bg-surface-dark">
        {searching ? <ActivityIndicator size="small" color={isDark ? '#FFDF00' : '#7B1113'} /> : <MaterialIcons name="search" size={21} color={isDark ? '#A1A1AA' : '#746C6E'} />}
        <TextInput
          autoFocus
          accessibilityLabel="Search students, sections, and sessions"
          className="flex-1 px-3 py-4 font-sans text-sm text-ink dark:text-white"
          value={query}
          onChangeText={setQuery}
          placeholder="Name, student number, subject, or date"
          placeholderTextColor={isDark ? '#777177' : '#A39B9D'}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} className="h-10 w-10 items-center justify-center"><MaterialIcons name="close" size={19} color={isDark ? '#A1A1AA' : '#746C6E'} /></Pressable> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        {!searched && !query ? <CampusEmptyState icon="manage-search" title="Search university records" description="Enter a name, student number, subject code, section, or session date." /> : null}
        {searched ? <Text accessibilityLiveRegion="polite" className="my-4 font-sans-medium text-xs text-muted dark:text-zinc-400">{totalResults ? `${totalResults} result${totalResults === 1 ? '' : 's'} for “${query.trim()}”` : `No results for “${query.trim()}”`}</Text> : null}
        {searched && !totalResults ? <CampusEmptyState icon="search-off" title="No matching records" description="Try a shorter name, a full student number, or a subject code." /> : null}

        {results.students.length ? <View className="mb-6"><SectionHeading eyebrow={`${results.students.length} matches`} title="Students" /><View className="gap-3">{results.students.map((student) => <SearchResultCard key={student.id} icon="person" title={student.fullName} subtitle={`${student.studentId} · ${student.program}`} onPress={() => router.push(`/(faculty)/student/${student.id}` as never)} />)}</View></View> : null}
        {results.sections.length ? <View className="mb-6"><SectionHeading eyebrow={`${results.sections.length} matches`} title="Class sections" /><View className="gap-3">{results.sections.map((section) => { const subject = subjectMap.get(section.subjectId); return <SearchResultCard key={section.id} icon="auto-stories" title={subject?.name ?? 'Class section'} subtitle={`${subject?.code ?? ''} · Section ${section.section}${section.room ? ` · ${section.room}` : ''}`} onPress={() => router.push(`/(faculty)/sections/${section.id}` as never)} /> })}</View></View> : null}
        {results.sessions.length ? <View className="mb-6"><SectionHeading eyebrow={`${results.sessions.length} matches`} title="Sessions" /><View className="gap-3">{results.sessions.map((session) => <SearchResultCard key={session.id} icon={session.isActive ? 'radio-button-checked' : 'event'} title={session.subjectName} subtitle={`${session.date} · ${session.startTime}–${session.endTime}${session.isActive ? ' · Active' : ''}`} onPress={() => router.push(`/(faculty)/sessions/${session.id}` as never)} />)}</View></View> : null}
      </ScrollView>
    </SafeAreaView>
  )
}
