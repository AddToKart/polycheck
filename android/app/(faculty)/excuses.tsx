import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import type { AttendanceRecord, ExcuseDecision, Section, Subject, User } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton, SectionHeading } from '../../components/CampusPrimitives'
import { FilterChipsRow, FilterSelect } from '../../components/FilterPrimitives'
import { useCampusToast } from '../../components/CampusToast'
import {
  EXCUSE_STATUS_META,
  excuseReasonLabel,
  filterExcuseRecords,
  type ExcuseTab,
} from '../../lib/excuses'
import { datePresetRange, type DatePreset } from '../../lib/filters'

const dateOptions: Array<{ value: DatePreset; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row gap-4 border-b border-line py-2.5 last:border-b-0 dark:border-line-dark">
    <Text className="w-24 font-sans-bold text-[10px] uppercase tracking-[1px] text-muted dark:text-zinc-500">{label}</Text>
    <Text className="flex-1 font-sans-medium text-xs leading-5 text-ink dark:text-zinc-200">{value}</Text>
  </View>
)

export default function FacultyExcusesScreen() {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const currentUser = useAuthGate(['teacher', 'super_admin'])
  const [user, setUser] = useState<User | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [activeTab, setActiveTab] = useState<ExcuseTab>('pending')
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    if (!currentUser) return
    const request = ++requestRef.current
    setLoading(true)
    try {
      const range = datePresetRange(datePreset)
      const [nextRecords, nextSubjects, nextSections] = await Promise.all([
        api.listExcuses({
          ...(selectedSectionId ? { sectionId: selectedSectionId } : {}),
          ...range,
        }),
        api.getSubjects(),
        api.getSections(),
      ])
      if (request !== requestRef.current) return
      setRecords(nextRecords)
      setSubjects(nextSubjects)
      setSections(nextSections)
    } catch (error) {
      if (request !== requestRef.current) return
      showToast('error', 'Unable to load excuses', error instanceof Error ? error.message : 'Check your connection and try again.')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [currentUser, datePreset, selectedSectionId, showToast])

  useFocusEffect(useCallback(() => {
    setUser(currentUser)
    void load()
  }, [currentUser, load]))

  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((subject) => [subject.id, subject])), [subjects])
  const sectionsById = useMemo(() => Object.fromEntries(sections.map((section) => [section.id, section])), [sections])

  const pendingCount = records.filter((record) => record.excuseStatus === 'requested').length
  const resolvedCount = records.filter((record) => record.excuseStatus && record.excuseStatus !== 'requested').length
  const visibleRecords = useMemo(() => filterExcuseRecords(records, {
    tab: activeTab,
    sectionId: selectedSectionId || undefined,
    ...datePresetRange(datePreset),
  }), [activeTab, datePreset, records, selectedSectionId])

  if (!user) return null
  const canDecide = user.role === 'teacher'

  const sectionOptions = sections.map((section) => ({
    id: section.id,
    label: `Section ${section.section}`,
    hint: subjectsById[section.subjectId]?.code,
  }))

  const openRecord = (record: AttendanceRecord) => {
    setSelectedRecord(record)
    setReviewNote(record.excuseReviewNote ?? '')
  }

  const decide = async (decision: ExcuseDecision) => {
    if (!selectedRecord) return
    setSubmitting(true)
    try {
      await api.decideExcuse(selectedRecord.id, decision, reviewNote.trim() || undefined)
      setSelectedRecord(null)
      setReviewNote('')
      await load()
      showToast(
        'success',
        decision === 'approve' ? 'Excuse approved' : 'Excuse rejected',
        decision === 'approve'
          ? 'The record is now excused and excluded from the attendance rate.'
          : 'The student keeps the original attendance status.',
      )
    } catch (error) {
      showToast('error', 'Unable to save decision', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const signOut = () => { void api.logout(); router.replace('/') }
  const isFiltered = selectedSectionId !== '' || datePreset !== 'all'

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Attendance integrity"
        title="Excuse requests"
        subtitle={`${pendingCount} waiting for review · ${resolvedCount} decided`}
        actions={(
          <>
            <CampusIconButton icon="refresh" label="Refresh excuse requests" onPress={() => void load()} inverse />
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
            <CampusIconButton icon="logout" label="Sign out" onPress={signOut} inverse />
          </>
        )}
      />

      <View className="px-4 pb-3 pt-2">
        <View className="flex-row flex-wrap gap-2 pb-3">
          <FilterSelect
            label="Section"
            value={selectedSectionId}
            placeholder="All sections"
            options={sectionOptions}
            onSelect={setSelectedSectionId}
            testID="excuses-section-filter"
          />
        </View>
        <View className="pb-3">
          <FilterChipsRow
            label="Request date"
            options={dateOptions}
            value={datePreset}
            onChange={setDatePreset}
            testID="excuses-date-filter"
          />
        </View>

        <View className="flex-row rounded-2xl bg-zinc-200/70 p-1 dark:bg-white/5">
          {([
            { id: 'pending' as const, label: `Pending (${pendingCount})` },
            { id: 'resolved' as const, label: `Resolved (${resolvedCount})` },
          ]).map((tab) => {
            const active = activeTab === tab.id
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(tab.id)}
                className={`min-h-12 flex-1 items-center justify-center rounded-xl ${active ? 'bg-white dark:bg-maroon' : ''}`}
              >
                <Text className={`font-sans-bold text-xs ${active ? 'text-maroon dark:text-golden' : 'text-muted dark:text-zinc-400'}`}>{tab.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 8, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {loading && !records.length ? (
          <View accessibilityRole="progressbar" className="items-center py-16">
            <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
            <Text className="mt-3 font-sans text-sm text-muted dark:text-zinc-400">Loading excuse requests…</Text>
          </View>
        ) : !visibleRecords.length ? (
          <CampusEmptyState
            icon={activeTab === 'pending' ? 'assignment-turned-in' : 'fact-check'}
            title={activeTab === 'pending' ? 'NO PENDING EXCUSES' : 'NO DECIDED EXCUSES'}
            description={isFiltered
              ? 'No requests match this section and date range.'
              : activeTab === 'pending'
                ? 'Student excuse requests will appear here for review.'
                : 'Approved and rejected requests remain here as an audit trail.'}
          />
        ) : (
          <>
            <SectionHeading eyebrow={`${visibleRecords.length} request${visibleRecords.length === 1 ? '' : 's'}`} title={activeTab === 'pending' ? 'Waiting for a decision' : 'Decision archive'} />
            {visibleRecords.map((record) => {
              const meta = record.excuseStatus ? EXCUSE_STATUS_META[record.excuseStatus] : null
              const section = sectionsById[record.sectionId]
              const subject = section ? subjectsById[section.subjectId] : undefined
              return (
                <CampusCard
                  key={record.id}
                  testID={`excuse-card-${record.id}`}
                  onPress={() => openRecord(record)}
                  accessibilityLabel={`Review excuse request from ${record.studentName}`}
                  className="p-4"
                >
                  <View className="flex-row items-start gap-3">
                    <View className="h-11 w-11 items-center justify-center rounded-none bg-maroon dark:bg-golden">
                      <Text className="font-sans-bold text-xs text-white dark:text-maroon-dark">
                        {record.studentName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-sans-bold text-sm text-ink dark:text-white">{record.studentName}</Text>
                      <Text className="mt-0.5 font-sans text-[10px] uppercase tracking-wider text-muted dark:text-zinc-400" numberOfLines={1}>
                        {subject?.name ?? 'Subject'} · {section ? `Sec ${section.section}` : record.sectionId}
                      </Text>
                      <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">
                        {new Date(record.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    {meta ? (
                      <View className={`rounded-full border px-2.5 py-1 ${meta.classes}`}>
                        <Text className={`font-sans-bold text-[9px] uppercase tracking-wider ${meta.textClasses}`}>{meta.label}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="mt-3 border-t border-line pt-3 dark:border-line-dark">
                    <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-maroon dark:text-golden">
                      {excuseReasonLabel(record.excuseReason) || 'Excuse'}
                    </Text>
                    {record.excuseDescription ? (
                      <Text className="mt-1 font-sans text-xs leading-5 text-ink dark:text-zinc-200" numberOfLines={2}>{record.excuseDescription}</Text>
                    ) : null}
                    {record.excuseReviewNote ? (
                      <Text className="mt-1 font-sans text-[11px] italic leading-4 text-muted dark:text-zinc-400" numberOfLines={1}>
                        Review note: {record.excuseReviewNote}
                      </Text>
                    ) : null}
                    <View className="mt-2 flex-row flex-wrap items-center gap-3">
                      {record.excuseEvidencePath ? (
                        <View className="flex-row items-center gap-1">
                          <MaterialIcons name="attach-file" size={14} color={isDark ? pupColors.golden : pupColors.maroon} />
                          <Text className="font-sans text-[10px] text-muted dark:text-zinc-400">Evidence attached</Text>
                        </View>
                      ) : null}
                      <View className="flex-row items-center gap-1">
                        <MaterialIcons name="chevron-right" size={15} color={isDark ? pupColors.golden : pupColors.maroon} />
                        <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-maroon dark:text-golden">Open review</Text>
                      </View>
                    </View>
                  </View>
                </CampusCard>
              )
            })}
          </>
        )}
      </ScrollView>

      <Modal visible={!!selectedRecord} transparent animationType="slide" onRequestClose={() => setSelectedRecord(null)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setSelectedRecord(null)}>
          {selectedRecord ? (
            <Pressable
              accessibilityRole="none"
              onPress={() => undefined}
              className="max-h-[92%] rounded-t-[30px] border-t-2 border-golden/40 bg-white px-5 pb-10 pt-4 dark:bg-surface-dark"
            >
              <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View className="mb-5 flex-row items-start gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-none bg-golden">
                    <MaterialIcons name="assignment-turned-in" size={24} color={pupColors.maroonDark} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-maroon dark:text-golden">
                      {selectedRecord.excuseStatus === 'requested' ? 'Teacher review' : 'Decision archive'}
                    </Text>
                    <Text className="mt-1 font-heading text-2xl text-ink dark:text-white">{selectedRecord.studentName}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close excuse review"
                    onPress={() => setSelectedRecord(null)}
                    className="h-11 w-11 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/10"
                  >
                    <MaterialIcons name="close" size={21} color={isDark ? '#FFFFFF' : pupColors.maroonDark} />
                  </Pressable>
                </View>

                <CampusCard className="mb-5 p-4">
                  <View className="mb-3 flex-row items-center justify-between gap-2">
                    <Text className="font-sans-bold text-sm text-ink dark:text-white">Request evidence</Text>
                    <View className={`rounded-full border px-2.5 py-1 ${EXCUSE_STATUS_META[selectedRecord.excuseStatus ?? 'requested'].classes}`}>
                      <Text className={`font-sans-bold text-[9px] uppercase tracking-wider ${EXCUSE_STATUS_META[selectedRecord.excuseStatus ?? 'requested'].textClasses}`}>
                        {EXCUSE_STATUS_META[selectedRecord.excuseStatus ?? 'requested'].label}
                      </Text>
                    </View>
                  </View>
                  <DetailRow label="Reason" value={excuseReasonLabel(selectedRecord.excuseReason) || 'Not specified'} />
                  <DetailRow label="Subject" value={subjectsById[sectionsById[selectedRecord.sectionId]?.subjectId ?? '']?.name ?? 'Unknown subject'} />
                  <DetailRow label="Section" value={sectionsById[selectedRecord.sectionId] ? `Section ${sectionsById[selectedRecord.sectionId].section}` : 'Unknown section'} />
                  <DetailRow label="Session" value={new Date(selectedRecord.timestamp).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                  <DetailRow label="Explanation" value={selectedRecord.excuseDescription || 'No description provided'} />
                  {selectedRecord.excuseEvidencePath ? <DetailRow label="Evidence" value="Photo attached to this request" /> : null}
                  {selectedRecord.excuseReviewedAt ? (
                    <DetailRow label="Reviewed" value={new Date(selectedRecord.excuseReviewedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                  ) : null}
                  {selectedRecord.excuseReviewNote ? <DetailRow label="Review note" value={selectedRecord.excuseReviewNote} /> : null}
                </CampusCard>

                {selectedRecord.excuseStatus === 'requested' && canDecide ? (
                  <View className="gap-3">
                    <Text className="font-sans-bold text-[10px] uppercase tracking-[1.2px] text-muted dark:text-zinc-500">Review note (optional)</Text>
                    <TextInput
                      accessibilityLabel="Review note"
                      className="min-h-24 rounded-none border border-line bg-zinc-50 p-4 font-sans text-sm text-ink dark:border-line-dark dark:bg-campus-dark dark:text-white"
                      style={{ textAlignVertical: 'top' }}
                      value={reviewNote}
                      onChangeText={setReviewNote}
                      placeholder="Explain the decision for the audit trail."
                      placeholderTextColor={isDark ? pupColors.muted : pupColors.mutedLight}
                      maxLength={500}
                      multiline
                    />
                    <CampusButton
                      label={submitting ? 'Saving…' : 'Approve excuse'}
                      icon="check-circle"
                      disabled={submitting}
                      onPress={() => void decide('approve')}
                      testID="excuse-approve"
                    />
                    <CampusButton
                      label="Reject excuse"
                      icon="cancel"
                      variant="secondary"
                      disabled={submitting}
                      onPress={() => void decide('reject')}
                      testID="excuse-reject"
                    />
                  </View>
                ) : (
                  <View className="rounded-2xl bg-zinc-100 p-4 dark:bg-white/5">
                    <Text className="text-center font-sans text-sm leading-5 text-muted dark:text-zinc-300">
                      {selectedRecord.excuseStatus === 'requested'
                        ? 'Only the assigned teacher can decide this excuse request.'
                        : 'This decision is final and retained in the attendance audit trail.'}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
