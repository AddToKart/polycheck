import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { AdminOverview, User } from '@polycheck/shared'
import { api } from '../services/api-client'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { CampusHeader } from './CampusHeader'
import {
  CampusButton,
  CampusCard,
  CampusEmptyState,
  CampusIconButton,
  MetricTile,
  SectionHeading,
} from './CampusPrimitives'
import { useCampusToast } from './CampusToast'
import {
  buildAccountSplit,
  describeAdminScope,
  describeAuditOutcome,
  formatRelativeTime,
  humanizeAuditAction,
  summarizeAdminHealth,
  topRecentActivity,
  type AccountSplit,
  type AdminHealthTone,
} from './super-admin-dashboard-helpers'

const healthPalette: Record<AdminHealthTone, { icon: keyof typeof MaterialIcons.glyphMap; iconColor: string; iconBg: string; pill: string; pillText: string }> = {
  healthy: {
    icon: 'check-circle',
    iconColor: '#047857',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    pill: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
    pillText: 'text-emerald-700 dark:text-emerald-300',
  },
  degraded: {
    icon: 'warning',
    iconColor: '#B45309',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    pill: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    pillText: 'text-amber-700 dark:text-amber-300',
  },
  unavailable: {
    icon: 'error-outline',
    iconColor: '#DC2626',
    iconBg: 'bg-red-50 dark:bg-red-950/40',
    pill: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
    pillText: 'text-red-700 dark:text-red-300',
  },
}

const outcomePalette = {
  success: { icon: 'check-circle' as const, iconColor: '#047857', iconBg: 'bg-emerald-50 dark:bg-emerald-950/40', pill: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300' },
  error: { icon: 'error' as const, iconColor: '#DC2626', iconBg: 'bg-red-50 dark:bg-red-950/40', pill: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300' },
  neutral: { icon: 'history' as const, iconColor: pupColors.maroon, iconBg: 'bg-maroon/5 dark:bg-golden/10', pill: 'border-line dark:border-line-dark', text: 'text-muted dark:text-zinc-300' },
}

const AccountSplitCard = ({ label, icon, split }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; split: AccountSplit }) => {
  const { isDark } = useTheme()
  return (
    <View className="flex-1 border border-line bg-campus p-3 dark:border-line-dark dark:bg-white/5">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name={icon} size={16} color={isDark ? pupColors.golden : pupColors.maroon} />
        <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-muted dark:text-zinc-400">{label}</Text>
      </View>
      <Text className="mt-2 font-sans-bold text-2xl text-ink dark:text-white">{split.total}</Text>
      <View className="mt-2 gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-sans text-[11px] text-emerald-700 dark:text-emerald-300">Active</Text>
          <Text className="font-sans-bold text-[11px] text-emerald-700 dark:text-emerald-300">{split.active}</Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="font-sans text-[11px] text-muted dark:text-zinc-400">Disabled</Text>
          <Text className="font-sans-bold text-[11px] text-ink dark:text-white">{split.disabled}</Text>
        </View>
      </View>
    </View>
  )
}

const HealthRow = ({ label, ok }: { label: string; ok: boolean }) => (
  <View className="flex-row items-center justify-between border-t border-line py-2 dark:border-line-dark">
    <Text className="font-sans text-xs text-muted dark:text-zinc-400">{label}</Text>
    <View className="flex-row items-center gap-1.5">
      <MaterialIcons name={ok ? 'check-circle' : 'cancel'} size={15} color={ok ? '#047857' : '#DC2626'} />
      <Text className={`font-sans-bold text-[10px] uppercase tracking-wider ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
        {ok ? 'Responding' : 'Unavailable'}
      </Text>
    </View>
  </View>
)

const QuickAction = ({ icon, label, detail, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; detail: string; onPress: () => void }) => {
  const { isDark } = useTheme()
  return (
    <CampusCard
      className="min-w-[46%] flex-1 p-4"
      onPress={onPress}
      accessibilityLabel={`${label}. ${detail}`}
    >
      <View className="mb-3 h-10 w-10 items-center justify-center bg-maroon/5 dark:bg-golden/10">
        <MaterialIcons name={icon} size={20} color={isDark ? pupColors.golden : pupColors.maroon} />
      </View>
      <Text className="font-sans-bold text-sm text-ink dark:text-white">{label}</Text>
      <Text className="mt-1 font-sans text-[11px] leading-4 text-muted dark:text-zinc-400">{detail}</Text>
    </CampusCard>
  )
}

export function SuperAdminDashboard({ user }: { user: User }) {
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOverview = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true)
    else setLoading(true)
    try {
      const next = await api.getAdminOverview()
      setOverview(next)
      setError(null)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Please try again.'
      setError(message)
      showToast('error', 'Unable to load admin overview', message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => { void loadOverview('initial') }, [loadOverview])

  const health = useMemo(() => summarizeAdminHealth(overview?.health), [overview?.health])
  const accountSplit = useMemo(
    () => buildAccountSplit(overview?.counts ?? {
      activeFaculty: 0,
      disabledFaculty: 0,
      activeStudents: 0,
      disabledStudents: 0,
      activeSessions: 0,
      pendingDisputes: 0,
    }),
    [overview?.counts],
  )
  const activity = useMemo(() => topRecentActivity(overview?.recentActivity ?? [], 6), [overview?.recentActivity])
  const counts = overview?.counts
  const healthStyle = healthPalette[health.tone]
  const scopeLabel = overview ? describeAdminScope(overview.scope, overview.department) : null

  const signOut = () => {
    void api.logout()
    router.replace('/')
  }

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark" testID="super-admin-dashboard-screen">
      <CampusHeader
        eyebrow="System administration"
        title={user.fullName}
        subtitle={scopeLabel ? `${scopeLabel} · accounts, activity, and service health.` : 'Institution accounts, activity, and service health.'}
        actions={(
          <>
            <CampusIconButton icon="search" label="Global search" onPress={() => router.push('/(faculty)/search' as never)} inverse />
            <CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle color theme" onPress={toggle} inverse />
            <CampusIconButton icon="logout" label="Sign out" onPress={signOut} inverse testID="faculty-sign-out" />
          </>
        )}
      />

      {loading && !overview ? (
        <View className="flex-1 items-center justify-center" accessibilityLabel="Loading administrator overview">
          <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
          <Text className="mt-4 font-sans text-sm text-muted dark:text-zinc-400">Loading administrator overview…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadOverview('refresh')} tintColor={isDark ? pupColors.golden : pupColors.maroon} />}
        >
          {error && !overview ? (
            <CampusCard className="mb-5 border-l-red-600 p-4">
              <Text accessibilityLiveRegion="assertive" className="font-sans-bold text-sm text-red-900 dark:text-red-200">Unable to load the administrator overview</Text>
              <Text className="mt-1 font-sans text-xs leading-5 text-red-700 dark:text-red-300">{error}</Text>
              <CampusButton label="Try again" icon="refresh" onPress={() => void loadOverview('initial')} className="mt-4" />
            </CampusCard>
          ) : null}

          {overview ? (
            <>
          <View className="mb-7 flex-row flex-wrap gap-3">
            <MetricTile testID="super-admin-tile-active-faculty" label="Active Faculty" value={counts?.activeFaculty ?? 0} icon="school" />
            <MetricTile testID="super-admin-tile-active-students" label="Active Students" value={counts?.activeStudents ?? 0} icon="groups" />
            <MetricTile testID="super-admin-tile-active-sessions" label="Active Sessions Now" value={counts?.activeSessions ?? 0} icon="sensors" />
            <MetricTile testID="super-admin-tile-pending-disputes" label="Pending Disputes" value={counts?.pendingDisputes ?? 0} icon="gavel" emphasis={counts?.pendingDisputes ? 'alert' : 'neutral'} />
          </View>

          <SectionHeading eyebrow="Accounts" title="Account overview" actionLabel="Manage" onAction={() => router.push('/(faculty)/users' as never)} />
          <CampusCard className="mb-7 p-4">
            <View className="flex-row gap-3">
              <AccountSplitCard label="Faculty" icon="school" split={accountSplit.faculty} />
              <AccountSplitCard label="Students" icon="groups" split={accountSplit.students} />
            </View>
            <Text className="mt-4 font-sans text-[11px] leading-4 text-muted dark:text-zinc-400">
              Disabled accounts cannot sign in until an administrator enables them.
            </Text>
            <CampusButton label="Manage users" icon="people" onPress={() => router.push('/(faculty)/users' as never)} className="mt-4" testID="super-admin-manage-users" />
          </CampusCard>

          <SectionHeading eyebrow="Service health" title="System status" />
          <CampusCard className="mb-7 p-4" testID="super-admin-health-tile">
            <View className="flex-row items-start gap-3">
              <View className={`h-11 w-11 items-center justify-center ${healthStyle.iconBg}`}>
                <MaterialIcons name={healthStyle.icon} size={22} color={healthStyle.iconColor} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-base text-ink dark:text-white">{health.label}</Text>
                <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-400">{health.detail}</Text>
              </View>
              <View className={`border px-2 py-1 ${healthStyle.pill}`}>
                <Text className={`font-sans-bold text-[9px] uppercase tracking-widest ${healthStyle.pillText}`}>{health.tone}</Text>
              </View>
            </View>
            <View className="mt-4">
              <HealthRow label="Database" ok={health.databaseOk} />
              <HealthRow label="Cache / Redis" ok={health.redisOk} />
            </View>
            <Text className="mt-3 font-sans text-[10px] uppercase tracking-wider text-muted dark:text-zinc-500">
              {overview?.health?.timestamp ? `Checked ${formatRelativeTime(overview.health.timestamp)}` : 'Awaiting health probe'}
            </Text>
          </CampusCard>

          <SectionHeading eyebrow="Audit trail" title="Recent administrative activity" actionLabel="View all" onAction={() => router.push('/(faculty)/audit-logs' as never)} />
          {activity.length === 0 ? (
            <CampusEmptyState icon="history" title="No administrative activity" description="Account, role, and settings changes will appear here." />
          ) : (
            <View className="mb-7 gap-3">
              {activity.map((entry) => {
                const outcome = describeAuditOutcome(entry.outcome)
                const palette = outcomePalette[outcome.tone]
                return (
                  <CampusCard
                    key={entry.id}
                    className="p-4"
                    accessibilityLabel={`${humanizeAuditAction(entry.action)}, by ${entry.actorName}, ${formatRelativeTime(entry.createdAt)}, ${outcome.label}`}
                  >
                    <View className="flex-row items-start gap-3">
                      <View className={`h-10 w-10 items-center justify-center ${palette.iconBg}`}>
                        <MaterialIcons name={palette.icon} size={19} color={outcome.tone === 'neutral' && isDark ? pupColors.golden : palette.iconColor} />
                      </View>
                      <View className="flex-1">
                        <Text className="font-sans-bold text-sm text-ink dark:text-white" numberOfLines={2}>{humanizeAuditAction(entry.action)}</Text>
                        <Text className="mt-1 font-sans text-xs text-muted dark:text-zinc-400" numberOfLines={1}>
                          {entry.actorName} · {formatRelativeTime(entry.createdAt)}
                        </Text>
                      </View>
                      <View className={`border px-2 py-1 ${palette.pill}`}>
                        <Text className={`font-sans-bold text-[9px] uppercase tracking-widest ${palette.text}`}>{outcome.label}</Text>
                      </View>
                    </View>
                  </CampusCard>
                )
              })}
            </View>
          )}

          <SectionHeading eyebrow="Console" title="Quick actions" />
          <View className="flex-row flex-wrap gap-3">
            <QuickAction icon="people" label="Manage users" detail="Accounts, roles, and credentials" onPress={() => router.push('/(faculty)/users' as never)} />
            <QuickAction icon="assessment" label="Reports" detail="Institution-wide attendance" onPress={() => router.push('/(faculty)/reports' as never)} />
            <QuickAction icon="history" label="Audit log" detail="Review administrative changes" onPress={() => router.push('/(faculty)/audit-logs' as never)} />
            <QuickAction icon="settings" label="Settings" detail="Institution attendance defaults" onPress={() => router.push('/(faculty)/settings' as never)} />
          </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
