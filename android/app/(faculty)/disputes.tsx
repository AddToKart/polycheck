import { useEffect, useMemo, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { AttendanceRecord, DisputeReason, Section, Session, Subject, User } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { CampusHeader } from '../../components/CampusHeader'
import { AttendanceStatusPill, CampusButton, CampusCard, CampusEmptyState } from '../../components/CampusPrimitives'

const DISPUTE_LABELS: Record<DisputeReason, string> = {
  outside_geofence: 'Outside geofence', expired_token: 'Expired token', duplicate_submission: 'Duplicate submission',
  invalid_signature: 'Invalid signature', device_mismatch: 'Device mismatch', suspicious_coordinates: 'Suspicious GPS',
  delayed_offline_sync: 'Delayed offline sync', invalid_timestamp: 'Invalid timestamp', token_mismatch: 'QR token mismatch',
  session_inactive: 'Inactive session', not_enrolled: 'Not enrolled', qr_expired: 'QR expired', rate_limited: 'Rate limited',
}

const DISPUTE_ICONS: Record<DisputeReason, keyof typeof MaterialIcons.glyphMap> = {
  outside_geofence: 'location-off', expired_token: 'timer-off', duplicate_submission: 'content-copy',
  invalid_signature: 'fingerprint', device_mismatch: 'devices', suspicious_coordinates: 'gps-fixed',
  delayed_offline_sync: 'cloud-off', invalid_timestamp: 'access-time', token_mismatch: 'qr-code-2',
  session_inactive: 'timer-off', not_enrolled: 'person-off', qr_expired: 'timer-off', rate_limited: 'speed',
}

type DisputeGroup = {
  subjectId: string
  subjectName: string
  subjectCode: string
  sections: Array<{
    sectionId: string
    sectionName: string
    sessions: Array<{ sessionId: string; sessionDate: string; sessionTime: string; records: AttendanceRecord[] }>
  }>
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row gap-4 py-1.5">
    <Text className="w-20 font-sans-bold text-[10px] uppercase tracking-[1px] text-muted dark:text-zinc-500">{label}</Text>
    <Text className="flex-1 font-sans-medium text-xs leading-5 text-ink dark:text-zinc-200">{value}</Text>
  </View>
)

export default function DisputesScreen() {
  const { isDark, toggle } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [disputes, setDisputes] = useState<AttendanceRecord[]>([])
  const [sections, setSections] = useState<Record<string, Section>>({})
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('all')
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const currentUser = api.getCurrentUser()
    if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'super_admin')) {
      router.replace('/')
      return
    }
    setUser(currentUser)
    void Promise.all([api.getSubjects(), api.getDisputedRecords(undefined, { status: 'all' }), api.getSections(), api.getSessions()])
      .then(([nextSubjects, nextDisputes, sectionList, sessionList]) => {
        setSubjects(nextSubjects)
        setDisputes(nextDisputes)
        setSections(Object.fromEntries(sectionList.map((section) => [section.id, section])))
        setSessions(Object.fromEntries(sessionList.map((session) => [session.id, session])))
      })
      .catch(() => Alert.alert('Unable to load disputes', 'Please check your connection and try again.'))
  }, [])

  const pendingCount = disputes.filter((record) => record.status === 'disputed').length
  const resolvedCount = disputes.filter((record) => record.disputeResolved).length

  const records = useMemo(() => disputes.filter((record) => {
    if (activeTab === 'pending' && record.status !== 'disputed') return false
    if (activeTab === 'resolved' && !record.disputeResolved) return false
    if (searchQuery && !`${record.studentName} ${record.studentId}`.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (selectedSubjectId !== 'all' && sections[record.sectionId]?.subjectId !== selectedSubjectId) return false
    return true
  }), [activeTab, disputes, searchQuery, sections, selectedSubjectId])

  const groups = useMemo<DisputeGroup[]>(() => {
    const grouped: Record<string, {
      subjectId: string; subjectName: string; subjectCode: string; sections: Record<string, {
        sectionId: string; sectionName: string; sessions: Record<string, {
          sessionId: string; sessionDate: string; sessionTime: string; records: AttendanceRecord[]
        }>
      }>
    }> = {}
    records.forEach((record) => {
      const section = sections[record.sectionId]
      const subject = subjects.find((item) => item.id === section?.subjectId)
      const session = sessions[record.sessionId]
      const subjectId = subject?.id ?? 'unknown'
      const sectionId = section?.id ?? 'unknown'
      const sessionId = session?.id ?? record.sessionId
      grouped[subjectId] ??= { subjectId, subjectName: subject?.name ?? 'Unknown subject', subjectCode: subject?.code ?? 'UNKNOWN', sections: {} }
      grouped[subjectId].sections[sectionId] ??= { sectionId, sectionName: section ? `Section ${section.section}` : 'Unknown section', sessions: {} }
      grouped[subjectId].sections[sectionId].sessions[sessionId] ??= {
        sessionId,
        sessionDate: new Date(record.timestamp).toLocaleDateString(),
        sessionTime: session ? `${session.startTime} – ${session.endTime}` : '',
        records: [],
      }
      grouped[subjectId].sections[sectionId].sessions[sessionId].records.push(record)
    })
    return Object.values(grouped).map((subject) => ({
      ...subject,
      sections: Object.values(subject.sections).map((section) => ({ ...section, sessions: Object.values(section.sessions) })),
    }))
  }, [records, sections, sessions, subjects])

  if (!user) return null

  const resolve = async (resolution: 'accept' | 'reject' | 'override', newStatus?: 'present' | 'late' | 'absent') => {
    if (!selectedRecord) return
    try {
      const updated = await api.resolveDispute(selectedRecord.id, resolution, newStatus)
      setDisputes((previous) => previous.map((record) => record.id === updated.id ? updated : record))
      setSelectedRecord(null)
    } catch (error) {
      Alert.alert('Unable to resolve dispute', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const reject = () => Alert.alert('Reject dispute?', 'The student will be marked absent and the review will be logged.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reject', style: 'destructive', onPress: () => void resolve('reject') },
  ])

  const selectedSection = selectedRecord ? sections[selectedRecord.sectionId] : undefined
  const selectedSubject = selectedSection ? subjects.find((subject) => subject.id === selectedSection.subjectId) : undefined
  const selectedSession = selectedRecord ? sessions[selectedRecord.sessionId] : undefined

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0B0B0E' : '#F7F6F6' }}>
      <CampusHeader
        eyebrow="Attendance integrity"
        title="Disputed records"
        subtitle={`${pendingCount} pending reviews · ${resolvedCount} resolved decisions`}
        actions={<CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />}
      />

      <View className="px-4 pb-3 pt-2">
        <View className="min-h-14 flex-row items-center rounded-2xl border border-line bg-white px-4 dark:border-line-dark dark:bg-surface-dark">
          <MaterialIcons name="search" size={20} color={isDark ? '#A1A1AA' : '#746C6E'} />
          <TextInput
            accessibilityLabel="Search disputes by student"
            className="h-full flex-1 px-3 font-sans text-sm text-ink dark:text-white"
            placeholder="Search student or number"
            placeholderTextColor={isDark ? '#71717A' : '#8A8284'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchQuery('')} className="h-11 w-11 items-center justify-center"><MaterialIcons name="close" size={19} color={isDark ? '#FFFFFF' : '#746C6E'} /></Pressable> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 py-3">
          {[{ id: 'all', label: 'All subjects' }, ...subjects.map((subject) => ({ id: subject.id, label: subject.code }))].map((option) => {
            const active = selectedSubjectId === option.id
            return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setSelectedSubjectId(option.id)} className={`min-h-11 justify-center rounded-full border px-4 ${active ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}><Text className={`font-sans-bold text-xs ${active ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-300'}`}>{option.label}</Text></Pressable>
          })}
        </ScrollView>

        <View className="flex-row rounded-2xl bg-zinc-200/70 p-1 dark:bg-white/5">
          {([{ id: 'pending', label: `Pending (${pendingCount})` }, { id: 'resolved', label: `Resolved (${resolvedCount})` }] as const).map((tab) => {
            const active = activeTab === tab.id
            return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setActiveTab(tab.id)} className={`min-h-11 flex-1 items-center justify-center rounded-xl ${active ? 'bg-white dark:bg-maroon' : ''}`}><Text className={`font-sans-bold text-xs ${active ? 'text-maroon dark:text-golden' : 'text-muted dark:text-zinc-400'}`}>{tab.label}</Text></Pressable>
          })}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 8, gap: 12 }} showsVerticalScrollIndicator={false}>
        {!records.length ? <CampusEmptyState icon="verified" title={`No ${activeTab} records`} description="Adjust the student search or subject filter to broaden this view." /> : null}
        {groups.map((subject) => {
          const count = subject.sections.reduce((sum, section) => sum + section.sessions.reduce((sessionSum, session) => sessionSum + session.records.length, 0), 0)
          const expanded = !!expandedSubjects[subject.subjectId]
          return (
            <CampusCard key={subject.subjectId} className="p-0">
              <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedSubjects((value) => ({ ...value, [subject.subjectId]: !value[subject.subjectId] }))} className="min-h-16 flex-row items-center gap-3 px-4 py-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-maroon/5 dark:bg-golden/10"><MaterialIcons name="menu-book" size={20} color={isDark ? '#FFDF00' : '#7B1113'} /></View>
                <View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white" numberOfLines={1}>{subject.subjectName}</Text><Text className="mt-0.5 font-sans text-xs text-muted dark:text-zinc-400">{subject.subjectCode} · {count} records</Text></View>
                <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={23} color={isDark ? '#FFDF00' : '#7B1113'} />
              </Pressable>
              {expanded ? <View className="gap-3 border-t border-line p-3 dark:border-line-dark">{subject.sections.map((section) => {
                const sectionExpanded = !!expandedSections[section.sectionId]
                const sectionCount = section.sessions.reduce((sum, session) => sum + session.records.length, 0)
                return <View key={section.sectionId} className="overflow-hidden rounded-2xl bg-zinc-50 dark:bg-white/5">
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: sectionExpanded }} onPress={() => setExpandedSections((value) => ({ ...value, [section.sectionId]: !value[section.sectionId] }))} className="min-h-13 flex-row items-center gap-2 px-4 py-3">
                    <MaterialIcons name="layers" size={18} color={isDark ? '#FFDF00' : '#7B1113'} /><Text className="flex-1 font-sans-bold text-xs text-ink dark:text-white">{section.sectionName}</Text><Text className="font-sans text-[10px] text-muted dark:text-zinc-400">{sectionCount} records</Text><MaterialIcons name={sectionExpanded ? 'expand-less' : 'expand-more'} size={20} color="#746C6E" />
                  </Pressable>
                  {sectionExpanded ? <View className="gap-4 border-t border-line px-3 py-4 dark:border-line-dark">{section.sessions.map((session) => <View key={session.sessionId} className="gap-2">
                    <View className="flex-row items-center gap-2"><MaterialIcons name="event" size={15} color={isDark ? '#FFDF00' : '#7B1113'} /><Text className="font-sans-semibold text-[11px] text-muted dark:text-zinc-400">{session.sessionDate}{session.sessionTime ? ` · ${session.sessionTime}` : ''}</Text></View>
                    {session.records.map((record) => <Pressable key={record.id} accessibilityRole="button" accessibilityLabel={`Review ${record.studentName} dispute`} onPress={() => setSelectedRecord(record)} className="rounded-2xl border border-line bg-white p-4 dark:border-line-dark dark:bg-surface-dark">
                      <View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-xl bg-golden/20"><MaterialIcons name={record.disputeReason ? DISPUTE_ICONS[record.disputeReason] : 'warning'} size={19} color="#7B1113" /></View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{record.studentName}</Text><Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400">{record.disputeReason ? DISPUTE_LABELS[record.disputeReason] : 'Unknown reason'}</Text></View><MaterialIcons name="chevron-right" size={20} color="#746C6E" /></View>
                    </Pressable>)}
                  </View>)}</View> : null}
                </View>
              })}</View> : null}
            </CampusCard>
          )
        })}
      </ScrollView>

      <Modal visible={!!selectedRecord} transparent animationType="slide" onRequestClose={() => setSelectedRecord(null)}>
        <Pressable className="flex-1 justify-end bg-black/55" onPress={() => setSelectedRecord(null)}>
          {selectedRecord ? <Pressable accessibilityRole="none" onPress={() => undefined} className="max-h-[90%] rounded-t-[34px] bg-white px-5 pb-10 pt-4 dark:bg-[#151013]">
            <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="mb-5 flex-row items-start gap-4">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-golden"><MaterialIcons name="gavel" size={26} color="#4A0A0B" /></View>
                <View className="flex-1"><Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-maroon dark:text-golden">{selectedRecord.disputeResolved ? 'Decision archive' : 'Teacher review'}</Text><Text className="mt-1 font-heading text-2xl text-ink dark:text-white">{selectedRecord.studentName}</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close review" onPress={() => setSelectedRecord(null)} className="h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5"><MaterialIcons name="close" size={21} color={isDark ? '#FFFFFF' : '#181113'} /></Pressable>
              </View>
              <CampusCard className="mb-5 p-4">
                <View className="mb-3 flex-row items-center justify-between"><Text className="font-sans-bold text-sm text-ink dark:text-white">Review evidence</Text><AttendanceStatusPill status={selectedRecord.status} /></View>
                <DetailRow label="Reason" value={selectedRecord.disputeReason ? DISPUTE_LABELS[selectedRecord.disputeReason] : 'Unknown'} />
                <DetailRow label="Subject" value={selectedSubject?.name ?? 'Unknown subject'} />
                <DetailRow label="Section" value={selectedSection ? `Section ${selectedSection.section}` : 'Unknown section'} />
                <DetailRow label="Session" value={`${new Date(selectedRecord.timestamp).toLocaleDateString()}${selectedSession ? ` · ${selectedSession.startTime} – ${selectedSession.endTime}` : ''}`} />
                {selectedRecord.notes ? <DetailRow label="Notes" value={selectedRecord.notes} /> : null}
              </CampusCard>

              {!selectedRecord.disputeResolved && user.role === 'teacher' ? <View className="gap-3">
                <CampusButton label="Accept as present" icon="check-circle" onPress={() => void resolve('accept')} />
                <CampusButton label="Reject and mark absent" icon="cancel" variant="secondary" onPress={reject} />
                <Text className="mt-2 font-sans-bold text-[10px] uppercase tracking-[1.2px] text-muted dark:text-zinc-500">Override status</Text>
                <View className="flex-row gap-2">{(['present', 'late', 'absent'] as const).map((status) => <Pressable key={status} accessibilityRole="button" onPress={() => void resolve('override', status)} className="min-h-12 flex-1 items-center justify-center rounded-2xl border border-line bg-white dark:border-line-dark dark:bg-surface-dark"><Text className="font-sans-bold text-xs capitalize text-maroon dark:text-golden">{status}</Text></Pressable>)}</View>
              </View> : <View className="rounded-2xl bg-zinc-100 p-4 dark:bg-white/5"><Text className="text-center font-sans text-sm leading-5 text-muted dark:text-zinc-300">{selectedRecord.disputeResolved ? 'This decision is resolved and retained in the audit history.' : 'Only the assigned teacher can resolve this dispute.'}</Text></View>}
            </ScrollView>
          </Pressable> : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
