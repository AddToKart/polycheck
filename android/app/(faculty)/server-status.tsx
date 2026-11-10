import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { canAccessItOperations, type ServerStatusSnapshot } from '@polycheck/shared'
import { api } from '../../services/api-client'
import { useAuthGate } from '../../hooks/use-auth-gate'
import { useTheme } from '../../theme/ThemeContext'
import { pupColors } from '../../theme/colors'
import { CampusHeader } from '../../components/CampusHeader'
import { CampusCard, CampusIconButton } from '../../components/CampusPrimitives'

const POLL_MS = 5_000

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

function MetricTile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <CampusCard className="flex-1 p-4">
      <Text className="font-sans-bold text-[9px] uppercase tracking-widest text-muted dark:text-zinc-400">{label}</Text>
      <Text className="mt-1 font-heading text-xl text-ink dark:text-white">{value}</Text>
      {caption ? <Text className="mt-1 font-sans text-[10px] text-muted dark:text-zinc-500">{caption}</Text> : null}
    </CampusCard>
  )
}

export default function FacultyServerStatusScreen() {
  const currentUser = useAuthGate(['teacher', 'super_admin'], canAccessItOperations)
  const { isDark, toggle } = useTheme()
  const [snapshot, setSnapshot] = useState<ServerStatusSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSnapshot(await api.getServerStatus())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the server status snapshot')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    void load()
    const interval = setInterval(() => {
      void load()
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [currentUser, load])

  if (!currentUser) return null

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? pupColors.campusDark : pupColors.campus }}
      className="flex-1 bg-campus dark:bg-campus-dark"
    >
      <CampusHeader
        eyebrow="IT Operations Suite"
        title="Server status"
        subtitle="Live health and latency for this Polycheck instance."
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
      {loading && !snapshot ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={isDark ? pupColors.golden : pupColors.maroon} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 12 }}>
          {error ? (
            <View className="border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
              <Text className="font-sans text-xs text-red-700 dark:text-red-300">{error}</Text>
            </View>
          ) : null}
          {snapshot ? (
            <>
              <View className="flex-row gap-3">
                <MetricTile
                  label="Readiness"
                  value={snapshot.applicationReady ? 'Ready' : 'Degraded'}
                  caption={`DB ${snapshot.databaseReady ? 'ok' : 'down'} · Redis ${snapshot.redisReady ? 'ok' : 'down'}`}
                />
                <MetricTile label="Uptime" value={`${Math.floor(snapshot.uptimeSeconds / 3600)} h`} caption="Process uptime" />
              </View>
              <View className="flex-row gap-3">
                <MetricTile label="Requests" value={String(snapshot.httpRequestsTotal)} caption="Since boot" />
                <MetricTile label="Errors" value={String(snapshot.httpErrorsTotal)} caption="Since boot" />
              </View>
              <View className="flex-row gap-3">
                <MetricTile
                  label="Latency p50"
                  value={snapshot.latencyP50Ms === null ? '—' : `${Math.round(snapshot.latencyP50Ms)} ms`}
                />
                <MetricTile
                  label="Latency p95"
                  value={snapshot.latencyP95Ms === null ? '—' : `${Math.round(snapshot.latencyP95Ms)} ms`}
                />
              </View>
              <View className="flex-row gap-3">
                <MetricTile
                  label="Event loop"
                  value={snapshot.eventLoopLagMs === null ? '—' : `${Math.round(snapshot.eventLoopLagMs)} ms`}
                  caption="Lag p95"
                />
                <MetricTile label="Memory" value={formatBytes(snapshot.memoryRssBytes)} caption="RSS" />
              </View>
              <View className="flex-row gap-3">
                <MetricTile
                  label="Queue"
                  value={String(snapshot.queue.active)}
                  caption={`${snapshot.queue.wait} waiting · ${snapshot.queue.failed} failed`}
                />
                <MetricTile label="Sockets" value={String(snapshot.activeSockets)} caption="This instance" />
              </View>
              <Text className="px-1 font-sans text-[10px] text-muted dark:text-zinc-500">
                Refreshed every 5 seconds · last update {new Date(snapshot.timestamp).toLocaleTimeString()}
              </Text>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
