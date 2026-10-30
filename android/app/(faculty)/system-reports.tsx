import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import {
  REPORT_STATUSES,
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_LABELS,
  type ReportCategory,
  type ReportStatus,
  type SystemReport,
  type SystemReportStats,
} from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, MetricTile } from '../../components/CampusPrimitives'
import { CampusFormField } from '../../components/CampusFormField'
import { useCampusToast } from '../../components/CampusToast'

const STATUS_FILTERS: { value: ReportStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]

const CATEGORY_FILTERS: { value: ReportCategory | ''; label: string }[] = [
  { value: '', label: 'Every category' },
  { value: 'scanner_camera', label: 'Scanner / camera' },
  { value: 'geofence_gps', label: 'Geofence / GPS' },
  { value: 'ui_display', label: 'UI / display' },
  { value: 'enrollment_roster', label: 'Enrollment' },
  { value: 'account_login', label: 'Account / login' },
  { value: 'feedback_suggestion', label: 'Feedback' },
]

function statusPillClass(status: ReportStatus): string {
  switch (status) {
    case 'in_review':
      return 'border-amber-400 bg-amber-50 dark:bg-amber-950'
    case 'resolved':
      return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950'
    case 'dismissed':
      return 'border-line bg-transparent dark:border-line-dark'
    default:
      return 'border-maroon bg-maroon dark:border-golden dark:bg-golden'
  }
}

function statusPillTextClass(status: ReportStatus): string {
  switch (status) {
    case 'in_review':
      return 'text-amber-800 dark:text-amber-300'
    case 'resolved':
      return 'text-emerald-800 dark:text-emerald-300'
    case 'dismissed':
      return 'text-muted dark:text-zinc-500'
    default:
      return 'text-white dark:text-maroon-ink'
  }
}

/** Super-admin triage cockpit: metric cards, filters, detail + resolution. */
export default function SystemReportsScreen() {
  const currentUser = useAuthGate(['super_admin'])
  const { showToast } = useCampusToast()

  const [stats, setStats] = useState<SystemReportStats | null>(null)
  const [reports, setReports] = useState<SystemReport[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('')
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<SystemReport | null>(null)
  const [detailStatus, setDetailStatus] = useState<ReportStatus>('in_review')
  const [adminNotes, setAdminNotes] = useState('')
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const scope = (currentUser as { scope?: string | null } | null)?.scope ?? null
  const canManage = currentUser?.role === 'super_admin' && scope !== 'department'

  const load = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const [nextStats, page] = await Promise.all([
        api.getSystemReportStats(),
        api.getSystemReports({
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(categoryFilter ? { category: categoryFilter } : {}),
          ...(searchInput.trim() ? { search: searchInput.trim() } : {}),
          limit: 50,
        }),
      ])
      setStats(nextStats)
      setReports(page.data)
      setTotal(page.total)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, currentUser, searchInput, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (report: SystemReport) => {
    setDetail(report)
    setDetailStatus(report.status)
    setAdminNotes(report.adminNotes ?? '')
    setScreenshotUri(null)
    if (report.screenshotUrl) {
      const dataUrl = await api.getReportScreenshotDataUrl(report.id)
      if (dataUrl) setScreenshotUri(dataUrl)
    }
  }

  const saveStatus = async () => {
    if (!detail || saving) return
    setSaving(true)
    try {
      const updated = await api.updateSystemReportStatus(detail.id, {
        status: detailStatus,
        ...(adminNotes.trim() ? { adminNotes: adminNotes.trim() } : {}),
      })
      setDetail(updated)
      setReports((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      showToast('success', 'Report updated', `${REPORT_STATUS_LABELS[updated.status]} recorded and audited.`)
      await load()
    } catch (saveError) {
      Alert.alert(
        'Unable to update report',
        saveError instanceof Error ? saveError.message : 'Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (!currentUser) return null
  const readOnly = scope === 'department'

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark" testID="system-reports-screen">
      <CampusHeader
        eyebrow="Administration"
        title="System Reports"
        subtitle="Triage issue reports and feedback from campus."
        onBack={() => router.back()}
      />

      {readOnly ? (
        <View className="mx-4 mt-2 border border-amber-300 bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
          <Text className="font-sans text-[11px] leading-5 text-amber-800 dark:text-amber-300">
            Department administrators have read-only access. Institution administrators triage and resolve.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View className="mx-4 mt-2">
          <CampusButton label="Retry" icon="refresh" variant="secondary" onPress={() => void load()} />
        </View>
      ) : null}

      {stats ? (
        <View className="mt-3 px-4">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricTile label="Total reports" value={stats.total} icon="receipt-long" />
            </View>
            <View className="flex-1">
              <MetricTile label="Unresolved" value={stats.open + stats.inReview} icon="pending" />
            </View>
          </View>
          <View className="mt-3 flex-row gap-3">
            <View className="flex-1">
              <MetricTile label="Scanner / GPS" value={stats.scannerAndGps} icon="photo-camera" />
            </View>
            <View className="flex-1">
              <MetricTile label="Resolved (month)" value={stats.resolvedThisMonth} icon="verified" />
            </View>
          </View>
        </View>
      ) : null}

      <View className="px-4 pt-4">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => {
            const active = statusFilter === item.value
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`reports-status-filter-${item.value || 'all'}`}
                onPress={() => setStatusFilter(item.value)}
                className={`mr-2 rounded-full border px-3 py-1.5 ${active ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line dark:border-line-dark'}`}
              >
                <Text
                  className={`font-sans-bold text-[10px] uppercase tracking-widest ${active ? 'text-white dark:text-maroon-ink' : 'text-muted dark:text-zinc-300'}`}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          }}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2"
          data={CATEGORY_FILTERS}
          keyExtractor={(item) => item.value || 'all'}
          renderItem={({ item }) => {
            const active = categoryFilter === item.value
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategoryFilter(item.value)}
                className={`mr-2 rounded-full border px-3 py-1.5 ${active ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line dark:border-line-dark'}`}
              >
                <Text
                  className={`font-sans-bold text-[9px] uppercase tracking-widest ${active ? 'text-white dark:text-maroon-ink' : 'text-muted dark:text-zinc-400'}`}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          }}
        />
        <View className="mt-2">
          <CampusFormField
            label=""
            icon="search"
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search title or description"
            autoCapitalize="none"
            testID="reports-search"
          />
        </View>
      </View>

      <FlatList
        className="flex-1 px-4 pt-3"
        contentContainerClassName="pb-24 gap-3"
        data={reports}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={() => void load()}
        ListEmptyComponent={
          loading ? null : (
            <Text className="py-8 text-center font-sans text-sm text-muted dark:text-zinc-400">
              {error ? error : 'No reports match these filters.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open report ${item.title}`}
            testID={`report-row-${item.id}`}
            onPress={() => void openDetail(item)}
          >
            <CampusCard className="p-4">
              <View className="flex-row items-center gap-2">
                <View className={`rounded-full border px-2 py-0.5 ${statusPillClass(item.status)}`}>
                  <Text className={`font-sans-bold text-[9px] uppercase tracking-widest ${statusPillTextClass(item.status)}`}>
                    {REPORT_STATUS_LABELS[item.status]}
                  </Text>
                </View>
                <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-muted dark:text-zinc-500">
                  {REPORT_CATEGORY_LABELS[item.category]}
                </Text>
                {item.severity === 'critical' || item.severity === 'high' ? (
                  <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-red-600 dark:text-red-400">
                    {item.severity}
                  </Text>
                ) : null}
              </View>
              <Text className="mt-1.5 font-sans-bold text-sm text-ink dark:text-white" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="mt-0.5 font-sans text-[11px] text-muted dark:text-zinc-400">
                {item.user.fullName} · {new Date(item.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              </Text>
            </CampusCard>
          </Pressable>
        )}
      />

      <Modal
        visible={detail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}
      >
        <Pressable className="flex-1 justify-end bg-black/70" onPress={() => setDetail(null)}>
          <Pressable onPress={() => undefined} className="max-h-[92%] rounded-t-[36px] border-t-4 border-t-golden bg-white px-5 pb-10 pt-4 dark:bg-surface-dark" testID="report-detail-sheet">
            <View className="mb-3 h-1.5 w-14 self-center rounded-full bg-maroon/30 dark:bg-golden/40" />
            <ScrollView showsVerticalScrollIndicator={false}>
              {detail ? (
                <View className="gap-4 pb-24">
                  <View className="flex-row items-center gap-2">
                    <View className={`rounded-full border px-2 py-0.5 ${statusPillClass(detail.status)}`}>
                      <Text className={`font-sans-bold text-[9px] uppercase tracking-widest ${statusPillTextClass(detail.status)}`}>
                        {REPORT_STATUS_LABELS[detail.status]}
                      </Text>
                    </View>
                    <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-muted dark:text-zinc-500">
                      {REPORT_CATEGORY_LABELS[detail.category]} · {detail.severity}
                    </Text>
                  </View>
                  <Text className="font-heading text-xl text-ink dark:text-white">{detail.title}</Text>
                  <Text className="font-sans text-sm leading-5 text-muted dark:text-zinc-300">
                    {detail.description}
                  </Text>
                  <View className="gap-2 border border-line p-3 dark:border-line-dark">
                    <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-muted dark:text-zinc-500">
                      Diagnostics
                    </Text>
                    {[
                      ['Submitted by', `${detail.user.fullName} (${detail.user.role})`],
                      ['Student number', detail.user.studentId ?? '—'],
                      ['Email', detail.user.email ?? '—'],
                      ['Platform', detail.deviceInfo ?? '—'],
                      ['App version', detail.appVersion ?? '—'],
                      ['Route', detail.route ?? '—'],
                      ['Network', detail.networkType ?? '—'],
                    ].map(([label, value]) => (
                      <View key={label} className="flex-row justify-between gap-4">
                        <Text className="font-sans text-[10px] uppercase tracking-widest text-muted dark:text-zinc-500">
                          {label}
                        </Text>
                        <Text className="flex-1 text-right font-sans text-xs text-ink dark:text-white" numberOfLines={1}>
                          {value}
                        </Text>
                      </View>
                    ))}
                    <Text className="font-sans text-[10px] text-muted dark:text-zinc-500">
                      Submitted {new Date(detail.createdAt).toLocaleString('en-PH')}
                    </Text>
                  </View>
                  {screenshotUri ? (
                    <Image
                      source={{ uri: screenshotUri }}
                      className="h-64 w-full border border-line"
                      style={{ resizeMode: 'contain' }}
                      testID="report-screenshot"
                      accessibilityLabel={`Screenshot for ${detail.title}`}
                    />
                  ) : null}
                  {canManage ? (
                    <View className="gap-3">
                      <Text className="font-sans-bold text-sm text-ink dark:text-white">Triage</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {REPORT_STATUSES.map((status) => {
                          const selected = detailStatus === status
                          return (
                            <Pressable
                              key={status}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              testID={`report-status-${status}`}
                              onPress={() => setDetailStatus(status)}
                              className={`rounded-full border px-3 py-2 ${selected ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line dark:border-line-dark'}`}
                            >
                              <Text
                                className={`font-sans-bold text-[10px] uppercase tracking-widest ${selected ? 'text-white dark:text-maroon-ink' : 'text-muted dark:text-zinc-300'}`}
                              >
                                {REPORT_STATUS_LABELS[status]}
                              </Text>
                            </Pressable>
                          )
                        })}
                      </View>
                      <CampusFormField
                        label="Admin notes"
                        icon="edit-note"
                        hint="Internal note recorded with the status change."
                        value={adminNotes}
                        onChangeText={setAdminNotes}
                        multiline
                        autoCapitalize="none"
                        testID="report-admin-notes"
                      />
                      <CampusButton
                        label={saving ? 'Saving…' : 'Save changes'}
                        icon="check"
                        disabled={saving}
                        onPress={() => void saveStatus()}
                        testID="report-save-status"
                      />
                    </View>
                  ) : detail.adminNotes ? (
                    <View className="border border-line p-3 dark:border-line-dark">
                      <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-muted dark:text-zinc-500">
                        Admin note
                      </Text>
                      <Text className="mt-1 font-sans text-xs text-ink dark:text-white">{detail.adminNotes}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
