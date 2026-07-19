import { useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { AttendanceRecord, Section, Subject } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusCard, CampusEmptyState } from '../../components/CampusPrimitives'

export default function StudentSubjectsListScreen() {
  const { isDark } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [mySections, setMySections] = useState<Section[]>([])
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([])
  const [subjects, setSubjects] = useState<Record<string, Subject>>({})

  const user = api.getCurrentUser()
  const student = user && 'studentId' in user ? user : null

  useEffect(() => {
    if (!student) return
    void Promise.all([api.getStudentSections(student.id), api.getMyAttendance(student.id), api.getSubjects()])
      .then(([sections, attendance, allSubjects]) => {
        setMySections(sections)
        setMyAttendance(attendance)
        setSubjects(Object.fromEntries(allSubjects.map((subject) => [subject.id, subject])))
      })
      .catch(() => Alert.alert('Unable to load classes', 'Check your connection and try again.'))
  }, [student?.id])

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return mySections
    return mySections.filter((section) => {
      const subject = subjects[section.subjectId]
      return [subject?.name, subject?.code, section.teacherName, section.room]
        .some((value) => value?.toLowerCase().includes(query))
    })
  }, [mySections, searchQuery, subjects])

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Enrolled classes"
        title="All my classes"
        subtitle="Search by subject, code, instructor, or room."
        onBack={() => router.back()}
      />

      <View className="mx-4 mb-3 min-h-14 flex-row items-center rounded-2xl border border-line bg-white px-4 dark:border-line-dark dark:bg-surface-dark">
        <MaterialIcons name="search" size={21} color={isDark ? '#A1A1AA' : '#746C6E'} />
        <TextInput
          accessibilityLabel="Search enrolled classes"
          className="flex-1 px-3 py-4 font-sans text-sm text-ink dark:text-white"
          placeholder="Search classes"
          placeholderTextColor={isDark ? '#777177' : '#A39B9D'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <MaterialIcons name="cancel" size={19} color={isDark ? '#A1A1AA' : '#746C6E'} onPress={() => setSearchQuery('')} />
        ) : null}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-12">
        {filteredSections.length === 0 ? (
          <CampusEmptyState
            icon="search-off"
            title={searchQuery ? 'No matching classes' : 'No classes yet'}
            description={searchQuery ? 'Try a shorter subject name or instructor name.' : 'Use an enrollment code from your instructor to add a class.'}
          />
        ) : filteredSections.map((section) => {
          const subject = subjects[section.subjectId]
          const records = myAttendance.filter((record) => record.sectionId === section.id)
          const presentCount = records.filter((record) => record.status === 'present').length
          const rate = records.length ? Math.round((presentCount / records.length) * 100) : 0

          return (
            <CampusCard
              key={section.id}
              onPress={() => router.push(`/(tabs)/subject-info/${section.id}`)}
              accessibilityLabel={`Open ${subject?.name ?? 'class'}`}
            >
              <View className="flex-row items-start gap-4">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10">
                  <MaterialIcons name="auto-stories" size={22} color={isDark ? '#FFDF00' : '#7B1113'} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-base text-ink dark:text-white">{subject?.name ?? 'Class'}</Text>
                  <Text className="mt-1 font-sans-medium text-xs text-maroon dark:text-golden">{subject?.code} · Section {section.section}</Text>
                  <View className="mt-4 gap-2">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="person-outline" size={16} color={isDark ? '#A1A1AA' : '#746C6E'} />
                      <Text className="flex-1 font-sans text-xs text-muted dark:text-zinc-400">{section.teacherName}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="room" size={16} color={isDark ? '#A1A1AA' : '#746C6E'} />
                      <Text className="flex-1 font-sans text-xs text-muted dark:text-zinc-400">{section.room || 'Room to be announced'}</Text>
                    </View>
                  </View>
                  <View className="mt-5 flex-row items-center gap-3 border-t border-line pt-4 dark:border-line-dark">
                    <View className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                      <View className="h-full rounded-full bg-golden" style={{ width: `${rate}%` }} />
                    </View>
                    <Text className="font-sans-bold text-xs text-muted dark:text-zinc-300">{records.length ? `${rate}%` : 'No records'}</Text>
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
