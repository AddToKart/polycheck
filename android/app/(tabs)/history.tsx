import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { AttendanceRecord, AttendanceStatus, StudentDisputeReason } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import { AttendanceStatusPill, CampusCard, CampusEmptyState, CampusIconButton } from '../../components/CampusPrimitives'
import { AttendanceDisputeModal, AttendanceRecordDetailModal } from '../../components/AttendanceRecordModals'

type FilterTab = 'all' | AttendanceStatus

const filterTabs: Array<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
  { key: 'disputed', label: 'Disputed' },
]

const statusIcons: Record<AttendanceStatus, keyof typeof MaterialIcons.glyphMap> = {
  present: 'check-circle',
  late: 'schedule',
  absent: 'cancel',
  pending: 'hourglass-empty',
  disputed: 'gavel',
}

export default function HistoryScreen() {
  const { isDark, toggle } = useTheme()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([])
  const [sectionsMap, setSectionsMap] = useState<Map<string, { id: string; subjectId: string }>>(new Map())
  const [subjects, setSubjects] = useState<Record<string, { id: string; name: string }>>({})
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [disputeVisible, setDisputeVisible] = useState(false)
  const [submittingDispute, setSubmittingDispute] = useState(false)

  const user = api.getCurrentUser()
  const student = useMemo(() => {
    if (!user) return null
    return {
      id: user.id,
      fullName: user.fullName || 'Student',
      studentId: user.studentId || user.id || '2024-00001',
    }
  }, [user])

  useEffect(() => {
    if (!student) {
      setAllRecords([])
      return
    }
    void Promise.all([api.getMyAttendance(student.id), api.getSections(), api.getSubjects()])
      .then(([records, sections, subjectList]) => {
        setAllRecords(records)
        setSectionsMap(new Map(sections.map((section) => [section.id, section])))
        setSubjects(Object.fromEntries(subjectList.map((subject) => [subject.id, subject])))
      })
      .catch(() => Alert.alert('Unable to load history', 'Check your connection and try again.'))
  }, [student?.id])

  const filteredRecords = useMemo(
    () => activeFilter === 'all' ? allRecords : allRecords.filter((record) => record.status === activeFilter),
    [activeFilter, allRecords],
  )
  const totals = useMemo(() => allRecords.reduce(
    (counts, record) => ({ ...counts, [record.status]: counts[record.status] + 1 }),
    { present: 0, late: 0, absent: 0, pending: 0, disputed: 0 } as Record<AttendanceStatus, number>,
  ), [allRecords])

  const subjectNameFor = (record: AttendanceRecord | null) => {
    if (!record) return 'Attendance record'
    const section = sectionsMap.get(record.sectionId)
    return section ? subjects[section.subjectId]?.name ?? record.sectionId : record.sectionId
  }

  const submitDispute = async (reason: StudentDisputeReason, description: string) => {
    if (!selectedRecord || !student) return
    setSubmittingDispute(true)
    try {
      await api.submitDispute({ recordId: selectedRecord.id, reason, description })
      setAllRecords(await api.getMyAttendance(student.id))
      setDisputeVisible(false)
      setSelectedRecord(null)
      Alert.alert('Issue reported', 'Your instructor can now review this attendance record.')
    } catch (error) {
      Alert.alert('Unable to send report', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setSubmittingDispute(false)
    }
  }

  const signOut = () => {
    void api.logout()
    router.replace('/')
  }

  if (!student) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-campus dark:bg-campus-dark">
        <ActivityIndicator size="large" color="#7B1113" />
      </SafeAreaView>
    )
  }

  const listHeader = (
    <View>
      <View className="mb-5 flex-row gap-2">
        {([
          ['Present', totals.present, 'text-emerald-700 dark:text-emerald-300'],
          ['Late', totals.late, 'text-amber-700 dark:text-amber-300'],
          ['Absent', totals.absent, 'text-red-700 dark:text-red-300'],
          ['Disputed', totals.disputed, 'text-maroon dark:text-golden'],
        ] as const).map(([label, value, color]) => (
          <View key={label} className="flex-1 items-center rounded-none border border-line bg-white py-3 border-t-2 border-t-maroon dark:border-t-golden dark:border-line-dark dark:bg-surface-dark">
            <Text className={`font-heading text-xl font-bold ${color}`}>{value}</Text>
            <Text className="mt-1 font-sans-bold text-[9px] uppercase tracking-wider text-muted dark:text-zinc-400">{label}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-5">
        {filterTabs.map((tab) => {
          const active = activeFilter === tab.key
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${tab.label.toLowerCase()} attendance`}
              onPress={() => setActiveFilter(tab.key)}
              className={`min-h-10 justify-center rounded-none border px-4 ${active ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}
            >
              <Text className={`font-sans-bold text-xs uppercase tracking-widest ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-300'}`}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader
        eyebrow="Personal Attendance"
        title="Audit History"
        subtitle="Review every check-in and report records that need correction."
        actions={(
          <>
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
            <CampusIconButton icon="logout" label="Sign out" onPress={signOut} inverse />
          </>
        )}
      />

      <FlatList
        style={{ flex: 1 }}
        data={filteredRecords}
        keyExtractor={(record) => record.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={(
          <CampusEmptyState
            icon="search-off"
            title="NO RECORDS IN THIS VIEW"
            description={activeFilter === 'all' ? 'Your attendance records will appear after your first class check-in.' : `No ${activeFilter} records were found.`}
          />
        )}
        renderItem={({ item: record }) => (
          <CampusCard
            onPress={() => { setSelectedRecord(record); setDetailVisible(true) }}
            accessibilityLabel={`Open ${subjectNameFor(record)} attendance record`}
            className="p-4 rounded-none border-l-4 border-l-maroon dark:border-l-golden"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-none bg-maroon/5 dark:bg-golden/10 border border-maroon/10 dark:border-golden/20">
                <MaterialIcons name={statusIcons[record.status]} size={20} color={isDark ? '#FFDF00' : '#7B1113'} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-sm text-ink dark:text-white" numberOfLines={1}>{subjectNameFor(record)}</Text>
                <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400 uppercase tracking-wider">
                  {new Date(record.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(record.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <AttendanceStatusPill status={record.status} />
            </View>
          </CampusCard>
        )}
      />

      <AttendanceRecordDetailModal
        visible={detailVisible}
        record={selectedRecord}
        subjectName={subjectNameFor(selectedRecord)}
        onClose={() => setDetailVisible(false)}
        onDispute={() => { setDetailVisible(false); setTimeout(() => setDisputeVisible(true), 250) }}
      />
      <AttendanceDisputeModal
        visible={disputeVisible}
        submitting={submittingDispute}
        onClose={() => { setDisputeVisible(false); setSelectedRecord(null) }}
        onSubmit={(reason, description) => void submitDispute(reason, description)}
      />
    </SafeAreaView>
  )
}
