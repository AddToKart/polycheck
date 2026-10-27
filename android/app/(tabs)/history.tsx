import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import type { AttendanceRecord, AttendanceStatus, ExcuseReason, StudentDisputeReason } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { AttendanceStatusPill, CampusCard, CampusEmptyState, CampusIconButton } from '../../components/CampusPrimitives'
import { AttendanceDisputeModal, AttendanceRecordDetailModal } from '../../components/AttendanceRecordModals'
import { ExcuseRequestModal } from '../../components/ExcuseRequestModal'
import { FilterChipsRow, FilterPanel, FilterSelect } from '../../components/FilterPrimitives'
import { useCampusToast } from '../../components/CampusToast'
import { EXCUSE_STATUS_META, excuseReasonLabel, isExcuseEligible } from '../../lib/excuses'
import { datePresetRange, filterAttendanceRecords } from '../../lib/filters'

type FilterTab = 'all' | AttendanceStatus
type HistoryDatePreset = 'all' | '7d' | '30d'

const filterTabs: Array<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
  { key: 'excused', label: 'Excused' },
  { key: 'disputed', label: 'Disputed' },
]

const datePresets: Array<{ value: HistoryDatePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const statusIcons: Record<AttendanceStatus, keyof typeof MaterialIcons.glyphMap> = {
  present: 'check-circle',
  late: 'schedule',
  absent: 'cancel',
  pending: 'hourglass-empty',
  disputed: 'gavel',
  excused: 'verified',
}

export default function HistoryScreen() {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [datePreset, setDatePreset] = useState<HistoryDatePreset>('all')
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([])
  const [sectionsMap, setSectionsMap] = useState<Map<string, { id: string; subjectId: string }>>(new Map())
  const [subjects, setSubjects] = useState<Record<string, { id: string; name: string }>>({})
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [disputeVisible, setDisputeVisible] = useState(false)
  const [submittingDispute, setSubmittingDispute] = useState(false)
  const [excuseVisible, setExcuseVisible] = useState(false)
  const [submittingExcuse, setSubmittingExcuse] = useState(false)

  const user = api.getCurrentUser()
  const student = useMemo(() => {
    if (!user) return null
    return {
      id: user.id,
      fullName: user.fullName || 'Student',
      studentId: user.studentId || user.id || '2024-00001',
    }
  }, [user])

  useFocusEffect(useCallback(() => {
    if (!student) {
      setAllRecords([])
      return
    }
    let active = true
    void Promise.all([api.getMyAttendance(student.id), api.getSections(), api.getSubjects()])
      .then(([records, sections, subjectList]) => {
        if (!active) return
        setAllRecords(records)
        setSectionsMap(new Map(sections.map((section) => [section.id, section])))
        setSubjects(Object.fromEntries(subjectList.map((subject) => [subject.id, subject])))
      })
      .catch(() => { if (active) showToast('error', 'Unable to load history', 'Check your connection and try again.') })
    return () => { active = false }
  }, [showToast, student?.id]))

  const filteredRecords = useMemo(() => filterAttendanceRecords(
    allRecords,
    {
      status: activeFilter,
      subjectId: selectedSubjectId || undefined,
      ...datePresetRange(datePreset),
    },
    (sectionId) => sectionsMap.get(sectionId)?.subjectId,
  ), [activeFilter, allRecords, datePreset, sectionsMap, selectedSubjectId])
  const totals = useMemo(() => allRecords.reduce(
    (counts, record) => record.isSynced ? ({ ...counts, [record.status]: counts[record.status] + 1 }) : counts,
    { present: 0, late: 0, absent: 0, pending: 0, disputed: 0, excused: 0 } as Record<AttendanceStatus, number>,
  ), [allRecords])

  const subjectOptions = Object.values(subjects).map((subject) => ({ id: subject.id, label: subject.name }))
  const isFiltered = activeFilter !== 'all' || selectedSubjectId !== '' || datePreset !== 'all'

  const clearFilters = () => {
    setActiveFilter('all')
    setSelectedSubjectId('')
    setDatePreset('all')
  }

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
      showToast('success', 'Issue reported', 'Your instructor can now review this attendance record.')
    } catch (error) {
      showToast('error', 'Unable to send report', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setSubmittingDispute(false)
    }
  }

  const submitExcuse = async (reason: ExcuseReason, description: string, evidenceData?: string) => {
    if (!selectedRecord || !student) return
    setSubmittingExcuse(true)
    try {
      await api.requestExcuse(selectedRecord.id, { reason, description, ...(evidenceData ? { evidenceData } : {}) })
      setAllRecords(await api.getMyAttendance(student.id))
      setExcuseVisible(false)
      setSelectedRecord(null)
      showToast('success', 'Excuse requested', 'Your instructor will review the request and notify you.')
    } catch (error) {
      showToast('error', 'Unable to request excuse', error instanceof Error ? error.message : 'Try again in a moment.')
    } finally {
      setSubmittingExcuse(false)
    }
  }

  const signOut = () => {
    void api.logout()
    router.replace('/')
  }

  if (!student) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-campus dark:bg-campus-dark">
        <ActivityIndicator size="large" color={pupColors.maroon} />
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
          ['Excused', totals.excused, 'text-cyan-700 dark:text-cyan-300'],
          ['Disputed', totals.disputed, 'text-maroon dark:text-golden'],
        ] as const).map(([label, value, color]) => (
          <View key={label} className="flex-1 items-center rounded-none border border-line bg-white py-3 border-t-2 border-t-maroon dark:border-t-golden dark:border-line-dark dark:bg-surface-dark">
            <Text className={`font-heading text-lg font-bold ${color}`}>{value}</Text>
            <Text className="mt-1 font-sans-bold text-[8px] uppercase tracking-wider text-muted dark:text-zinc-400">{label}</Text>
          </View>
        ))}
      </View>

      <FilterPanel filtered={isFiltered} onClear={clearFilters} title="Filter history">
        <FilterSelect
          label="Subject"
          value={selectedSubjectId}
          placeholder="All subjects"
          options={subjectOptions}
          onSelect={setSelectedSubjectId}
          testID="history-subject-filter"
        />
        <FilterChipsRow
          label="Date range"
          options={datePresets}
          value={datePreset}
          onChange={setDatePreset}
          testID="history-date-filter"
        />
      </FilterPanel>

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
              className={`min-h-11 justify-center rounded-none border px-4 ${active ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}
            >
              <Text className={`font-sans-bold text-xs uppercase tracking-widest ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-300'}`}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
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
            description={
              activeFilter !== 'all'
                ? `No ${activeFilter} records match this subject and date range.`
                : isFiltered
                  ? 'No records match the selected subject or date range.'
                  : 'Your attendance records will appear after your first class check-in.'
            }
          />
        )}
        renderItem={({ item: record }) => {
          const excuseMeta = record.excuseStatus ? EXCUSE_STATUS_META[record.excuseStatus] : null
          return (
            <CampusCard
              onPress={() => { setSelectedRecord(record); setDetailVisible(true) }}
              accessibilityLabel={`Open ${subjectNameFor(record)} attendance record`}
              className="p-4 rounded-none border-l-4 border-l-maroon dark:border-l-golden"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-none bg-maroon/5 dark:bg-golden/10 border border-maroon/10 dark:border-golden/20">
                  <MaterialIcons name={statusIcons[record.status]} size={20} color={isDark ? pupColors.golden : pupColors.maroon} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-sm text-ink dark:text-white" numberOfLines={1}>{subjectNameFor(record)}</Text>
                  <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400 uppercase tracking-wider">
                    {new Date(record.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(record.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {record.isSynced ? <AttendanceStatusPill status={record.status} /> : <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Awaiting confirmation</Text>}
              </View>

              {excuseMeta ? (
                <View className="mt-3 flex-row flex-wrap items-center gap-2 border-t border-line pt-3 dark:border-line-dark">
                  <View className={`rounded-full border px-2.5 py-1 ${excuseMeta.classes}`}>
                    <Text className={`font-sans-bold text-[9px] uppercase tracking-widest ${excuseMeta.textClasses}`}>Excuse {excuseMeta.label}</Text>
                  </View>
                  {record.excuseReason ? (
                    <Text className="font-sans text-[11px] text-muted dark:text-zinc-400">{excuseReasonLabel(record.excuseReason)}</Text>
                  ) : null}
                </View>
              ) : null}

              {record.excuseReviewNote ? (
                <Text className="mt-2 font-sans text-[11px] leading-4 text-muted dark:text-zinc-400">
                  Review note: {record.excuseReviewNote}
                </Text>
              ) : null}

              {isExcuseEligible(record) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Request an excuse for ${subjectNameFor(record)}`}
                  onPress={() => { setSelectedRecord(record); setExcuseVisible(true) }}
                  className="mt-3 min-h-14 flex-row items-center justify-center gap-2 border border-maroon/30 bg-maroon/5 px-4 dark:border-golden/30 dark:bg-golden/10"
                >
                  <MaterialIcons name="assignment-turned-in" size={17} color={isDark ? pupColors.golden : pupColors.maroon} />
                  <Text className="font-sans-bold text-[10px] uppercase tracking-widest text-maroon dark:text-golden">
                    {record.excuseStatus === 'rejected' ? 'Request excuse again' : 'Request excuse'}
                  </Text>
                </Pressable>
              ) : null}
            </CampusCard>
          )
        }}
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
      <ExcuseRequestModal
        visible={excuseVisible}
        submitting={submittingExcuse}
        onClose={() => { setExcuseVisible(false); setSelectedRecord(null) }}
        onSubmit={(reason, description, evidenceData) => void submitExcuse(reason, description, evidenceData)}
      />
    </SafeAreaView>
  )
}
