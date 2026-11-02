import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  canAccessAcademicOversight,
  REFERRAL_STATUS_LABELS,
  type AtRiskReferral,
  type ReferralStatus,
  type StudentAtRisk,
} from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton } from '../../components/CampusPrimitives'
import { useCampusToast } from '../../components/CampusToast'
import {
  CHED_NOTICE_FILENAME,
  REFERRAL_STATUS_PILL_CLASSES,
  REFERRAL_STATUS_TEXT_CLASSES,
  REFERRAL_TRANSITION_LABELS,
  canManageReferrals,
  chedNoticeDownloadPath,
  describeReferralError,
  groupReferralsByStatus,
  isReferralNoticeEligible,
  referralTransitionOptions,
  validateReferralNote,
} from '../../lib/institution-settings'

const STATUS_LABELS: Record<StudentAtRisk['status'], string> = {
  below_threshold: 'Below threshold',
  at_risk: 'At risk',
  on_track: 'On track',
  insufficient_data: 'Insufficient data',
}

type AtRiskView = 'list' | 'referrals'

const describeDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

export default function FacultyAtRiskScreen() {
  const currentUser = useAuthGate(['teacher', 'super_admin'], canAccessAcademicOversight)
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const [view, setView] = useState<AtRiskView>('list')
  const [rows, setRows] = useState<StudentAtRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // F5: the "Issue CHED notice" confirmation sheet state.
  const [noticeRow, setNoticeRow] = useState<StudentAtRisk | null>(null)
  const [noticeNote, setNoticeNote] = useState('')
  const [noticeBusy, setNoticeBusy] = useState(false)
  const [noticeError, setNoticeError] = useState('')
  // Bumped after a referral is generated so the queue refetches.
  const [referralRefreshKey, setReferralRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await api.getAtRiskStudents({ limit: 50 }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load at-risk students')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    void load()
  }, [currentUser, load])

  const openNoticeSheet = (row: StudentAtRisk) => {
    setNoticeNote('')
    setNoticeError('')
    setNoticeRow(row)
  }

  const closeNoticeSheet = useCallback(() => {
    if (noticeBusy) return
    setNoticeRow(null)
    setNoticeError('')
  }, [noticeBusy])

  const confirmIssueNotice = async () => {
    const row = noticeRow
    if (!row || noticeBusy) return
    const validation = validateReferralNote(noticeNote)
    if (!validation.ok) {
      setNoticeError(validation.message)
      return
    }
    setNoticeError('')
    setNoticeBusy(true)
    try {
      const referral = await api.generateAtRiskReferral({
        studentId: row.studentId,
        sectionId: row.sectionId,
        ...(validation.note ? { note: validation.note } : {}),
      })
      showToast(
        'success',
        'CHED notice issued',
        `The notice of impending drop for ${row.studentName} was generated and the department head was alerted.`,
      )
      setNoticeRow(null)
      setNoticeNote('')
      try {
        await api.downloadAssistantFile(chedNoticeDownloadPath(referral.id), CHED_NOTICE_FILENAME)
        showToast('success', 'Notice ready', 'The signed CHED notice was opened in your share sheet.')
      } catch (shareCause) {
        showToast(
          'warning',
          'Notice download failed',
          shareCause instanceof Error
            ? shareCause.message
            : 'Re-download the notice from the Referrals view.',
        )
      }
      setReferralRefreshKey((current) => current + 1)
      void load()
    } catch (cause) {
      setNoticeError(describeReferralError(cause))
    } finally {
      setNoticeBusy(false)
    }
  }

  if (!currentUser) return null

  const canManage = canManageReferrals(currentUser)

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader
        eyebrow="Academic Department Oversight"
        title="At-risk students"
        subtitle={`Students near the attendance floor in ${currentUser.department ?? 'your department'}.`}
        onBack={() => router.back()}
        actions={
          <CampusIconButton
            icon={isDark ? 'light-mode' : 'dark-mode'}
            label="Toggle color theme"
            onPress={toggle}
            inverse
          />
        }
      />

      <View
        className="mx-4 mt-1 flex-row rounded-2xl bg-zinc-200/70 p-1 dark:bg-white/5"
        accessibilityRole="tablist"
        accessibilityLabel="At-risk views"
      >
        {([{ id: 'list', label: 'Oversight list' }, { id: 'referrals', label: 'Referrals' }] as const).map((tab) => {
          const active = view === tab.id
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`at-risk-view-${tab.id}`}
              onPress={() => setView(tab.id)}
              className={`min-h-11 flex-1 items-center justify-center rounded-xl ${active ? 'bg-white dark:bg-maroon' : ''}`}
            >
              <Text className={`font-sans-bold text-xs ${active ? 'text-maroon dark:text-golden' : 'text-muted dark:text-zinc-400'}`}>
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {view === 'list' ? (
        loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => `${item.sectionId}:${item.studentId}`}
            contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}
            ListHeaderComponent={
              error ? (
                <View className="mb-3 border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
                  <Text className="font-sans text-xs text-red-700 dark:text-red-300">{error}</Text>
                </View>
              ) : (
                <View className="mb-1" />
              )
            }
            ListEmptyComponent={
              <CampusCard className="items-center p-8">
                <MaterialIcons name="verified" size={32} color={isDark ? pupColors.golden : pupColors.maroon} />
                <Text className="mt-3 font-heading text-lg text-ink dark:text-white">Everyone is on track</Text>
                <Text className="mt-1 text-center font-sans text-xs text-muted dark:text-zinc-400">
                  No students are close to the attendance threshold in your department.
                </Text>
              </CampusCard>
            }
            renderItem={({ item }) => (
              <CampusCard className="p-4" testID={`at-risk-${item.studentId}-${item.sectionId}`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="font-sans-bold text-sm text-ink dark:text-white">{item.studentName}</Text>
                    <Text className="mt-0.5 font-sans text-[10px] text-muted dark:text-zinc-500">
                      {item.studentNumber ?? '—'} · {item.subjectName} {item.sectionName}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-sans-bold text-sm text-maroon dark:text-golden">
                      {item.attendanceRate === null ? '—' : `${item.attendanceRate}%`}
                    </Text>
                    <Text className="font-sans text-[9px] uppercase tracking-wider text-muted dark:text-zinc-500">
                      {STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                </View>
                <Text className="mt-2 font-sans text-[11px] text-muted dark:text-zinc-400">
                  Professor {item.professorName} · {item.absencesBeforeBelowThreshold ?? '—'} absence(s) before the{' '}
                  {item.thresholdPercent}% floor
                </Text>
                {item.absencesBeforeBelowThreshold === 0 ? (
                  <View className="mt-2 self-start rounded-none border border-golden bg-golden px-2 py-0.5" testID="impending-drop">
                    <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-maroon-dark">
                      Impending drop
                    </Text>
                  </View>
                ) : null}
                {isReferralNoticeEligible(item) ? (
                  <CampusButton
                    label="Issue CHED notice"
                    icon="warning-amber"
                    variant="secondary"
                    onPress={() => openNoticeSheet(item)}
                    className="mt-3"
                    testID={`issue-notice-${item.studentId}`}
                  />
                ) : null}
              </CampusCard>
            )}
            ListFooterComponent={
              <CampusButton
                label="Refresh"
                icon="refresh"
                variant="secondary"
                onPress={() => void load()}
                className="mt-4"
              />
            }
          />
        )
      ) : (
        <ReferralsView canManage={canManage} refreshKey={referralRefreshKey} />
      )}

      <Modal visible={!!noticeRow} transparent animationType="slide" onRequestClose={closeNoticeSheet}>
        <Pressable className="flex-1 justify-end bg-black/55" onPress={closeNoticeSheet}>
          {noticeRow ? (
            <Pressable
              accessibilityRole="none"
              onPress={() => undefined}
              className="max-h-[90%] rounded-t-[34px] bg-white px-5 pb-10 pt-4 dark:bg-surface-dark"
            >
              <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="mb-5 flex-row items-start gap-4">
                  <View className="h-14 w-14 items-center justify-center rounded-2xl bg-golden">
                    <MaterialIcons name="warning-amber" size={26} color={pupColors.maroonDark} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-bold text-[10px] uppercase tracking-[1.5px] text-maroon dark:text-golden">
                      CHED CMO No. 40, Art. V §21
                    </Text>
                    <Text className="mt-1 font-heading text-2xl text-ink dark:text-white">Issue CHED notice</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close notice sheet"
                    onPress={closeNoticeSheet}
                    className="h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5"
                  >
                    <MaterialIcons name="close" size={21} color={isDark ? pupColors.white : pupColors.maroonInk} />
                  </Pressable>
                </View>

                <CampusCard className="mb-5 p-4">
                  <SheetDetailRow label="Student" value={`${noticeRow.studentName}${noticeRow.studentNumber ? ` (${noticeRow.studentNumber})` : ''}`} />
                  <SheetDetailRow label="Section" value={`${noticeRow.subjectName} · ${noticeRow.sectionName}`} />
                  <SheetDetailRow
                    label="Standing"
                    value={`${noticeRow.attendanceRate === null ? '—' : `${noticeRow.attendanceRate}%`} of the ${noticeRow.thresholdPercent}% floor${noticeRow.absencesBeforeBelowThreshold === 0 ? ' — threshold reached' : ''}`}
                  />
                  <Text className="mt-3 font-sans text-[11px] leading-5 text-muted dark:text-zinc-400">
                    Generates the official Notice of Impending Drop slip, shares it for the student record, and
                    alerts the department head.
                  </Text>
                </CampusCard>

                <Text className="mb-1.5 font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-400">
                  Note (optional)
                </Text>
                <TextInput
                  accessibilityLabel="Optional note for the CHED referral"
                  className="min-h-24 border border-zinc-300 bg-white px-3 py-2.5 font-sans text-sm text-ink dark:border-zinc-700 dark:bg-white/5 dark:text-white"
                  placeholder="e.g. Fourth consecutive absence verified against the class record; advising guidance counseling."
                  placeholderTextColor={isDark ? pupColors.mutedLight : pupColors.muted}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                  value={noticeNote}
                  editable={!noticeBusy}
                  onChangeText={setNoticeNote}
                  testID="ched-note-input"
                />
                <Text className="mt-1 text-right font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-500">
                  {noticeNote.trim().length}/500
                </Text>

                {noticeError ? (
                  <View
                    accessibilityLiveRegion="assertive"
                    className="mt-2 border border-red-300 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30"
                    testID="ched-note-error"
                  >
                    <Text className="font-sans text-xs leading-5 text-red-700 dark:text-red-300">{noticeError}</Text>
                  </View>
                ) : null}

                <View className="mt-5 flex-row gap-3">
                  <CampusButton
                    label="Cancel"
                    variant="secondary"
                    onPress={closeNoticeSheet}
                    disabled={noticeBusy}
                    className="flex-1"
                    testID="ched-note-cancel"
                  />
                  <CampusButton
                    label={noticeBusy ? 'Generating…' : 'Generate notice'}
                    icon={noticeBusy ? undefined : 'warning-amber'}
                    onPress={() => void confirmIssueNotice()}
                    disabled={noticeBusy}
                    className="flex-1"
                    testID="ched-note-generate"
                  />
                </View>
              </ScrollView>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const SheetDetailRow = ({ label, value }: { label: string; value: string }) => (
  <View className="mb-2 flex-row gap-2">
    <Text className="w-20 shrink-0 font-sans-bold text-[10px] uppercase tracking-widest text-muted dark:text-zinc-500">
      {label}
    </Text>
    <Text className="flex-1 font-sans text-xs leading-5 text-ink dark:text-zinc-200">{value}</Text>
  </View>
)

interface ReferralsViewProps {
  /** Whether the actor may triage (department head or super admin). */
  canManage: boolean
  /** Bump to refetch (e.g. after a referral is generated on the list view). */
  refreshKey: number
}

/**
 * F5: the CHED referral queue. Referrals are grouped by status in lifecycle
 * order; department heads and super admins move them through `acknowledged` →
 * `counseling_scheduled` → `resolved`, while other oversight viewers see the
 * queue read-only. Every row can re-share the signed notice PDF.
 */
function ReferralsView({ canManage, refreshKey }: ReferralsViewProps) {
  const { isDark } = useTheme()
  const { showToast } = useCampusToast()
  const [referrals, setReferrals] = useState<AtRiskReferral[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setReferrals(await api.getAtRiskReferrals())
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load CHED referrals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey, reloadNonce])

  const transition = async (referral: AtRiskReferral, status: ReferralStatus) => {
    if (updatingId) return
    setUpdatingId(referral.id)
    try {
      const updated = await api.updateAtRiskReferral(referral.id, { status })
      setReferrals((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      showToast(
        'success',
        'Referral updated',
        `${updated.studentName}'s referral is now ${REFERRAL_STATUS_LABELS[status]}.`,
      )
    } catch (cause) {
      showToast(
        'error',
        'Referral update failed',
        cause instanceof Error ? cause.message : 'Unable to update the referral.',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const shareNotice = async (referral: AtRiskReferral) => {
    if (downloadingId) return
    setDownloadingId(referral.id)
    try {
      await api.downloadAssistantFile(chedNoticeDownloadPath(referral.id), CHED_NOTICE_FILENAME)
      showToast(
        'success',
        'Notice downloaded',
        `The signed CHED notice for ${referral.studentName} is ready to share.`,
      )
    } catch (cause) {
      showToast(
        'error',
        'Download failed',
        cause instanceof Error ? cause.message : 'Unable to download the CHED notice.',
      )
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {loadError ? (
        <View className="gap-3">
          <View className="border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
            <Text className="font-sans text-xs text-red-700 dark:text-red-300">{loadError}</Text>
          </View>
          <CampusButton label="Retry" icon="refresh" variant="secondary" onPress={() => setReloadNonce((n) => n + 1)} />
        </View>
      ) : null}

      {!loadError && !referrals.length ? (
        <CampusCard className="items-center p-8">
          <MaterialIcons name="history" size={32} color={isDark ? pupColors.golden : pupColors.maroon} />
          <Text className="mt-3 font-heading text-lg text-ink dark:text-white">No CHED referrals yet</Text>
          <Text className="mt-1 text-center font-sans text-xs text-muted dark:text-zinc-400">
            Notices issued with the “Impending drop” action on the oversight list will appear here for the
            guidance queue.
          </Text>
        </CampusCard>
      ) : null}

      {groupReferralsByStatus(referrals).map((group) => (
        <View key={group.status} className="gap-3" testID={`referral-group-${group.status}`}>
          <View className="flex-row items-center gap-2">
            <View className={`min-h-7 justify-center rounded-none border px-2.5 py-0.5 ${REFERRAL_STATUS_PILL_CLASSES[group.status]}`}>
              <Text className={`font-sans-bold text-[9px] uppercase tracking-widest ${REFERRAL_STATUS_TEXT_CLASSES[group.status]}`}>
                {REFERRAL_STATUS_LABELS[group.status]}
              </Text>
            </View>
            <Text className="font-sans-bold text-xs text-muted dark:text-zinc-400">{group.rows.length}</Text>
          </View>
          {group.rows.map((referral) => {
            const busy = updatingId === referral.id || downloadingId === referral.id
            return (
              <CampusCard key={referral.id} className="p-4" testID={`referral-${referral.id}`}>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-sans-bold text-sm text-ink dark:text-white">
                      {referral.studentName}
                      {referral.studentNumber ? <Text className="font-sans text-[11px] text-muted dark:text-zinc-500"> · {referral.studentNumber}</Text> : null}
                    </Text>
                    <Text className="mt-0.5 font-sans text-[11px] text-muted dark:text-zinc-400">
                      {referral.subjectName} · {referral.sectionName}
                    </Text>
                    <Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">
                      Instructor {referral.professorName} · Issued by {referral.generatedByName} ·{' '}
                      {describeDate(referral.createdAt)}
                    </Text>
                    {referral.note ? (
                      <Text className="mt-1 font-sans text-[11px] italic leading-5 text-muted dark:text-zinc-400">
                        “{referral.note}”
                      </Text>
                    ) : null}
                  </View>
                  <View className={`min-h-7 justify-center rounded-none border px-2.5 py-0.5 ${REFERRAL_STATUS_PILL_CLASSES[referral.status]}`}>
                    <Text className={`font-sans-bold text-[9px] uppercase tracking-widest ${REFERRAL_STATUS_TEXT_CLASSES[referral.status]}`}>
                      {REFERRAL_STATUS_LABELS[referral.status]}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  {canManage
                    ? referralTransitionOptions(referral.status).map((status) => (
                        <Pressable
                          key={status}
                          accessibilityRole="button"
                          accessibilityLabel={`${REFERRAL_TRANSITION_LABELS[status]} for ${referral.studentName}`}
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          onPress={() => void transition(referral, status)}
                          className="min-h-11 justify-center rounded-none border border-maroon/30 bg-maroon/5 px-3.5 dark:border-golden/30 dark:bg-golden/10"
                          testID={`referral-transition-${status}-${referral.id}`}
                        >
                          <Text className="font-sans-bold text-[11px] uppercase tracking-wider text-maroon dark:text-golden">
                            {REFERRAL_TRANSITION_LABELS[status]}
                          </Text>
                        </Pressable>
                      ))
                    : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Download CHED notice for ${referral.studentName}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => void shareNotice(referral)}
                    className="min-h-11 flex-row items-center justify-center gap-1.5 rounded-none border border-line bg-white px-3.5 dark:border-line-dark dark:bg-surface-dark"
                    testID={`referral-notice-${referral.id}`}
                  >
                    {downloadingId === referral.id ? (
                      <ActivityIndicator size="small" color={isDark ? pupColors.golden : pupColors.maroon} />
                    ) : (
                      <MaterialIcons name="file-download" size={16} color={isDark ? pupColors.golden : pupColors.maroon} />
                    )}
                    <Text className="font-sans-bold text-[11px] uppercase tracking-wider text-maroon dark:text-golden">
                      Notice (PDF)
                    </Text>
                  </Pressable>
                </View>

                {!canManage ? (
                  <Text className="mt-2 font-sans text-[10px] text-muted dark:text-zinc-500">
                    Read-only — department heads and super administrators triage this queue.
                  </Text>
                ) : null}
              </CampusCard>
            )
          })}
        </View>
      ))}

      <CampusButton
        label="Refresh"
        icon="refresh"
        variant="secondary"
        onPress={() => setReloadNonce((n) => n + 1)}
        className="mt-2"
      />
    </ScrollView>
  )
}
