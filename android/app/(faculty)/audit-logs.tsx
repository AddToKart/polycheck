import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getRecentCampusDateRange, type AuditLogPage, type AuditOutcome } from '@polycheck/shared'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { api } from '../../services/api-client'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusButton, CampusCard, CampusEmptyState, CampusIconButton } from '../../components/CampusPrimitives'

const range = getRecentCampusDateRange(30)
const emptyPage: AuditLogPage = { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }

export default function AuditLogsScreen() {
  const user = useAuthGate(['super_admin'])
  const { isDark, toggle } = useTheme()
  const [logs, setLogs] = useState<AuditLogPage>(emptyPage)
  const [outcome, setOutcome] = useState<AuditOutcome | undefined>()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setLogs(await api.getAuditLogs({ page, pageSize: 25, outcome, startDate: range.startDate, endDate: range.endDate }))
    } catch (error) {
      Alert.alert('Unable to load audit log', error instanceof Error ? error.message : 'Try again.')
    } finally {
      setLoading(false)
    }
  }, [outcome, page, user])

  useEffect(() => { void load() }, [load])
  if (!user) return null

  const outcomes: Array<{ value: AuditOutcome | undefined; label: string }> = [
    { value: undefined, label: 'All' },
    { value: 'succeeded', label: 'Succeeded' },
    { value: 'failed', label: 'Failed' },
    { value: 'initiated', label: 'Incomplete' },
  ]

  return (
    <SafeAreaView className="flex-1 bg-campus dark:bg-campus-dark">
      <CampusHeader eyebrow="Governance" title="Audit log" subtitle="Account, classroom, and settings changes in your scope." onBack={() => router.back()} actions={<><CampusIconButton icon="refresh" label="Refresh audit log" onPress={() => void load()} inverse /><CampusIconButton icon={isDark ? 'light-mode' : 'dark-mode'} label="Toggle theme" onPress={toggle} inverse /></>} />
      <View className="border-b border-line px-4 py-3 dark:border-line-dark">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {outcomes.map((option) => {
            const selected = option.value === outcome
            return <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setOutcome(option.value); setPage(1) }} className={`min-h-11 justify-center rounded-full border px-4 ${selected ? 'border-maroon bg-maroon dark:border-golden dark:bg-golden' : 'border-line bg-white dark:border-line-dark dark:bg-surface-dark'}`}><Text className={`font-sans-bold text-xs ${selected ? 'text-white dark:text-maroon-dark' : 'text-muted dark:text-zinc-300'}`}>{option.label}</Text></Pressable>
          })}
        </ScrollView>
      </View>
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
