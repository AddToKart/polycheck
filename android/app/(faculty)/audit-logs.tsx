import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getRecentCampusDateRange, type AuditLogPage, type AuditOutcome, type LedgerVerifyResult } from '@polycheck/shared'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton } from '../../components/CampusPrimitives'
import { useCampusToast } from '../../components/CampusToast'

const range = getRecentCampusDateRange(30)
const emptyPage: AuditLogPage = { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }

// ── F9 ledger verify (pure banner model, unit-tested in __tests__/ledger-verify.test.ts) ──

export type LedgerVerifyState =
  | { phase: 'idle' }
  | { phase: 'busy' }
  | { phase: 'done'; result: LedgerVerifyResult }
  | { phase: 'error'; message: string }

export type LedgerBannerTone = 'busy' | 'verified' | 'broken' | 'error'

export interface LedgerBanner {
  tone: LedgerBannerTone
  title: string
  detail: string | null
}

const LEDGER_BREAK_LABELS: Record<NonNullable<LedgerVerifyResult['brokenAt']>['reason'], string> = {
  hash_mismatch: 'the stored hash no longer matches the recomputed chain',
  link_mismatch: 'a chain link points at the wrong predecessor record',
  anchor_mismatch: 'the published daily anchor does not match the chain head',
}

const formatLedgerCount = (value: number): string => value.toLocaleString('en-US')

export function ledgerBannerFor(state: LedgerVerifyState): LedgerBanner | null {
  switch (state.phase) {
    case 'idle':
      return null
    case 'busy':
      return {
        tone: 'busy',
        title: 'Verifying ledger integrity…',
        detail: 'Recomputing every attendance hash chain — read-only check.',
      }
    case 'error':
      return { tone: 'error', title: 'Ledger verification failed', detail: state.message }
    case 'done': {
      const { verified, recordsChecked, sessionsChecked, lastAnchorDate, brokenAt } = state.result
      if (verified) {
        return {
          tone: 'verified',
          title: `✓ Ledger intact — ${formatLedgerCount(recordsChecked)} records across ${formatLedgerCount(sessionsChecked)} sessions verified`,
          detail: lastAnchorDate ? `Last published anchor: ${lastAnchorDate}` : 'Daily chain heads are published to the audit trail.',
        }
      }
      return {
        tone: 'broken',
        title: brokenAt ? `✗ Chain broken at ${brokenAt.recordId}` : '✗ Chain verification failed',
        detail: brokenAt
          ? `Investigate session ${brokenAt.sessionId} — ${LEDGER_BREAK_LABELS[brokenAt.reason]}.`
          : 'The scanner could not complete a chain; check server logs and retry.',
      }
    }
  }
}

export const LEDGER_BANNER_TONE_CLASSES: Record<LedgerBannerTone, string> = {
  busy: 'border-line bg-white dark:border-line-dark dark:bg-surface-dark',
  verified: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/60',
  broken: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/60',
  error: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/60',
}

export const LEDGER_BANNER_TEXT_TONE_CLASSES: Record<LedgerBannerTone, string> = {
  busy: 'text-ink dark:text-white',
  verified: 'text-emerald-800 dark:text-emerald-300',
  broken: 'text-red-800 dark:text-red-300',
  error: 'text-red-800 dark:text-red-300',
}

export const LEDGER_BANNER_DETAIL_TONE_CLASSES: Record<LedgerBannerTone, string> = {
  busy: 'text-muted dark:text-zinc-400',
  verified: 'text-emerald-700 dark:text-emerald-200',
  broken: 'text-red-700 dark:text-red-200',
  error: 'text-red-700 dark:text-red-200',
}

export default function AuditLogsScreen() {
  const user = useAuthGate(['super_admin'])
  const { isDark, toggle } = useTheme()
  const { showToast } = useCampusToast()
  const [logs, setLogs] = useState<AuditLogPage>(emptyPage)
  const [outcome, setOutcome] = useState<AuditOutcome | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [ledger, setLedger] = useState<LedgerVerifyState>({ phase: 'idle' })

  const runLedgerVerify = useCallback(async () => {
    if (!user) return
    setLedger({ phase: 'busy' })
    try {
      const result = await api.verifyLedger()
      setLedger({ phase: 'done', result })
    } catch (error) {
      setLedger({
        phase: 'error',
        message: error instanceof Error && error.message ? error.message : 'Ledger verification failed. Try again.',
      })
    }
  }, [user])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setLogs(await api.getAuditLogs({ page, pageSize: 25, outcome, startDate: range.startDate, endDate: range.endDate }))
    } catch (error) {
      showToast('error', 'Unable to load audit log', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setLoading(false)
    }
  }, [outcome, page, showToast, user])

  useEffect(() => { void load() }, [load])
  if (!user) return null

  const ledgerBanner = ledgerBannerFor(ledger)

  const outcomes: Array<{ value: AuditOutcome | undefined; label: string }> = [
    { value: undefined, label: 'All' },
    { value: 'succeeded', label: 'Succeeded' },
    { value: 'failed', label: 'Failed' },
    { value: 'initiated', label: 'Incomplete' },
  ]

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.campus }}
      className="flex-1 bg-campus dark:bg-campus-dark"
    >
      <CampusHeader eyebrow="Governance" title="Audit log" subtitle="Account, classroom, and settings changes in your scope." onBack={() => router.back()} actions={<><CampusIconButton icon="shield" label="Verify Ledger Integrity" onPress={() => void runLedgerVerify()} disabled={ledger.phase === 'busy'} inverse testID="ledger-verify-button" /><CampusIconButton icon="refresh" label="Refresh audit log" onPress={() => void load()} inverse /><CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle theme" onPress={toggle} inverse /></>} />
      <View className="border-b border-line px-4 py-3 dark:border-line-dark">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {outcomes.map((option) => {
            const selected = option.value === outcome
            return <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setOutcome(option.value); setPage(1) }} className={`min-h-11 justify-center rounded-full border px-4 ${selected ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}><Text className={`font-sans-bold text-xs ${selected ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-300'}`}>{option.label}</Text></Pressable>
          })}
        </ScrollView>
      </View>
      {ledgerBanner ? (
        <View
          testID="ledger-verify-result"
          accessibilityLiveRegion="polite"
          className={`mx-4 mt-3 rounded-2xl border p-4 ${LEDGER_BANNER_TONE_CLASSES[ledgerBanner.tone]}`}
        >
          <View className="flex-row items-start gap-3">
            {ledgerBanner.tone === 'busy' ? (
              <ActivityIndicator size="small" color={isDark ? pupColors.golden : pupColors.maroon} />
            ) : (
              <MaterialIcons
                name={ledgerBanner.tone === 'verified' ? 'verified' : ledgerBanner.tone === 'broken' ? 'link-off' : 'error-outline'}
                size={20}
                color={ledgerBanner.tone === 'verified' ? pupColors.success : pupColors.danger}
              />
            )}
            <View className="flex-1">
              <Text className={`font-sans-bold text-sm leading-5 ${LEDGER_BANNER_TEXT_TONE_CLASSES[ledgerBanner.tone]}`}>{ledgerBanner.title}</Text>
              {ledgerBanner.detail ? <Text className={`mt-1 font-sans text-xs leading-5 ${LEDGER_BANNER_DETAIL_TONE_CLASSES[ledgerBanner.tone]}`}>{ledgerBanner.detail}</Text> : null}
              {ledgerBanner.tone === 'error' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry ledger verification"
                  onPress={() => void runLedgerVerify()}
                  className="mt-2 min-h-11 flex-row items-center justify-center self-start rounded-xl border border-line bg-white px-4 dark:border-line-dark dark:bg-surface-dark"
                >
                  <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Retry</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} /></View> : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 110 }}>
          {!logs.items.length ? <CampusEmptyState icon="history" title="No audited changes" description="No activity matches this outcome in the last 30 days." /> : null}
          {logs.items.map((entry) => (
            <CampusCard key={entry.id} className="p-4">
              <View className="flex-row items-start gap-3">
                <View className={`h-10 w-10 items-center justify-center rounded-2xl ${entry.outcome === 'failed' ? 'bg-red-100 dark:bg-red-950' : entry.outcome === 'succeeded' ? 'bg-green-100 dark:bg-green-950' : 'bg-zinc-100 dark:bg-zinc-800'}`}><MaterialIcons name={entry.outcome === 'failed' ? 'error-outline' : entry.outcome === 'succeeded' ? 'check-circle-outline' : 'schedule'} size={20} color={entry.outcome === 'failed' ? '#B91C1C' : entry.outcome === 'succeeded' ? '#15803D' : '#746C6E'} /></View>
                <View className="flex-1"><Text className="font-sans-bold text-sm text-ink dark:text-white">{entry.actorName}</Text><Text className="mt-1 font-sans-medium text-xs text-maroon dark:text-golden">{entry.action}</Text><Text className="mt-2 font-sans text-xs text-muted dark:text-zinc-400">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ''}</Text><Text className="mt-2 font-sans text-[10px] text-muted dark:text-zinc-500">{new Date(entry.createdAt).toLocaleString('en-PH')} · {entry.outcome === 'initiated' ? 'incomplete' : entry.outcome}</Text></View>
              </View>
            </CampusCard>
          ))}
          <View className="flex-row items-center justify-between gap-3"><CampusButton className="flex-1" label="Previous" variant="secondary" disabled={page <= 1} onPress={() => setPage((value) => value - 1)} /><Text className="font-sans text-xs text-muted dark:text-zinc-400">{logs.totalPages ? page : 0}/{logs.totalPages}</Text><CampusButton className="flex-1" label="Next" variant="secondary" disabled={page >= logs.totalPages} onPress={() => setPage((value) => value + 1)} /></View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
