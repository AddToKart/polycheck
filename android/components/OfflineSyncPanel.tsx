import { useCallback, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { api } from '../services/api-client'
import { getOfflineQueueIssues, retryOfflineOperation, type OfflineQueueIssue } from '../services/offline-store'

export const OfflineSyncPanel = () => {
  const [issues, setIssues] = useState<OfflineQueueIssue[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useFocusEffect(useCallback(() => {
    let active = true
    const refresh = () => { void getOfflineQueueIssues().then((rows) => { if (active) setIssues(rows) }).catch(() => { if (active) setError('Unable to read saved check-ins. Try reopening the app.') }) }
    refresh()
    const timer = setInterval(refresh, 5_000)
    return () => { active = false; clearInterval(timer) }
  }, []))
  const retry = async (id?: string) => {
    setBusy(true)
    setError(null)
    try {
      if (id) await retryOfflineOperation(id)
      await api.syncOfflineQueue()
      setIssues(await getOfflineQueueIssues())
    } catch { setError('Sync is unavailable. Your saved check-ins are still on this device.') }
    finally { setBusy(false) }
  }
  if (!issues.length && !error) return null
  const failed = issues.filter((item) => item.failed)
  return (
    <View testID="offline-sync-panel" className="gap-3 border border-maroon bg-white p-4 dark:border-golden dark:bg-surface-dark">
      <Text accessibilityRole="header" className="font-sans-bold text-maroon dark:text-golden">{busy ? 'Syncing…' : `${issues.length - failed.length} awaiting confirmation · ${failed.length} need attention`}</Text>
      <Text className="font-sans text-sm text-ink dark:text-white">Saved check-ins are not confirmed attendance. Late uploads may need instructor review. Confirmed results appear in attendance history.</Text>
      {error ? <Text accessibilityRole="alert" className="font-sans text-sm text-maroon dark:text-golden">{error}</Text> : null}
      {failed.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" disabled={busy} onPress={() => Alert.alert('Check-in needs attention', `${item.error}\nSession: ${item.sessionId}\nReference: ${item.id}\nAsk your instructor to review this evidence. Retrying preserves the original scan.`, [{ text: 'Close' }, { text: 'Retry', onPress: () => { void retry(item.id) } }])} className="gap-1 border-t border-line py-3 dark:border-line-dark">
          <Text className="font-sans-bold text-sm text-ink dark:text-white">Needs attention: {item.sessionId}</Text>
          <Text className="font-sans text-sm text-muted dark:text-zinc-300">{item.error} · Tap for help</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Sync saved check-ins" disabled={busy} onPress={() => { void retry() }} className="min-h-11 items-center justify-center bg-maroon px-4">
        <Text className="font-sans-bold text-white">{busy ? 'Syncing…' : 'Sync now'}</Text>
      </Pressable>
    </View>
  )
}
