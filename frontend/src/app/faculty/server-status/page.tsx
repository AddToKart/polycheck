'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  MemoryStick,
  Radio,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import type { User } from '@polycheck/shared'
import { api } from '@/lib/api-client'
import { subscribeToServerStatus } from '@/lib/realtime'
import { Sidebar } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/lib/hooks'
import {
  appendServerSample,
  formatByteSize,
  formatLatency,
  formatPercent,
  formatRate,
  formatSnapshotTimestamp,
  formatUptime,
  SERVER_HISTORY_MAX_SAMPLES,
  seriesWithGaps,
  sparklineSegments,
  type ServerHistorySample,
} from '@/lib/server-status'

interface ChartSeries {
  name: string
  values: Array<number | null>
  className: string
}

function Sparkline({ label, series }: { label: string; series: ChartSeries[] }) {
  const hasData = series.some((entry) => entry.values.some((value) => value !== null && Number.isFinite(value)))
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="h-16 w-full"
    >
      {hasData ? (
        series.map((entry, seriesIndex) =>
          sparklineSegments(entry.values).map((points, segmentIndex) => (
            <polyline
              key={`${seriesIndex}-${segmentIndex}`}
              points={points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={entry.className}
            />
          )),
        )
      ) : (
        <line
          x1="0"
          y1="16"
          x2="100"
          y2="16"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeDasharray="3 3"
          className="text-zinc-400"
        />
      )}
    </svg>
  )
}

function ReadinessGauge({ label, ready }: { label: string; ready: boolean | null }) {
  const state = ready === null ? 'unknown' : ready ? 'ready' : 'unavailable'
  const tone =
    state === 'ready'
      ? 'text-green-600 dark:text-green-400'
      : state === 'unavailable'
        ? 'text-red-600 dark:text-red-400'
        : 'text-zinc-400'
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 36 36"
        role="img"
        aria-label={`${label}: ${state}`}
        className={`h-11 w-11 shrink-0 ${tone}`}
      >
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={state === 'ready' ? '94.25 94.25' : state === 'unavailable' ? '3 94.25' : '0 94.25'}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          {state === 'ready' ? 'Ready' : state === 'unavailable' ? 'Unavailable' : 'No data'}
        </p>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  caption,
  icon: Icon,
  children,
}: {
  title: string
  value: string
  caption?: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800">
      <CardHeader className="flex-row items-start justify-between space-y-0 border-b border-zinc-200 p-5 dark:border-zinc-800">
        <div>
          <CardTitle className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <Icon className="h-4 w-4 text-maroon dark:text-golden" />
            {title}
          </CardTitle>
          <p className="mt-2 text-2xl font-heading font-bold text-foreground">{value}</p>
          {caption ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{caption}</p> : null}
        </div>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  )
}

export default function ServerStatusPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [history, setHistory] = useState<ServerHistorySample[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const current = api.getCurrentUser()
    if (!current || current.role !== 'super_admin') {
      router.replace('/faculty')
      return
    }
    setUser(current)
  }, [router])

  const loadSnapshot = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const snapshot = await api.getServerStatus()
      setHistory((current) => appendServerSample(current, snapshot, Date.now()))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the server status snapshot')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void loadSnapshot()
    const unsubscribe = subscribeToServerStatus(
      (snapshot) => {
        // Do not append ticks while the tab is hidden: on return the derived
        // rates would be smeared across the hidden interval and draw spikes.
        if (document.visibilityState === 'hidden') return
        setHistory((current) => appendServerSample(current, snapshot, Date.now()))
      },
      setConnected,
    )
    return unsubscribe
  }, [loadSnapshot, user])

  const latest = history.length ? history[history.length - 1].snapshot : null

  const series = useMemo(
    () => ({
      requestRate: seriesWithGaps(history, (sample) => sample.rates?.requestRatePerSecond ?? null),
      errorRate: seriesWithGaps(history, (sample) => sample.rates?.errorRatePerSecond ?? null),
      p50: seriesWithGaps(history, (sample) => sample.snapshot.latencyP50Ms),
      p95: seriesWithGaps(history, (sample) => sample.snapshot.latencyP95Ms),
      lag: seriesWithGaps(history, (sample) => sample.snapshot.eventLoopLagMs),
      rss: seriesWithGaps(history, (sample) => sample.snapshot.memoryRssBytes),
      cpu: seriesWithGaps(history, (sample) => sample.rates?.cpuPercent ?? null),
    }),
    [history],
  )

  const connectionLabel = connected ? 'Live' : latest ? 'Reconnecting…' : 'Connecting…'
  const lastTick = latest ? formatSnapshotTimestamp(latest.timestamp) : '—'

  if (!user) return null

  if (loading && !latest) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
        <Sidebar user={user} onLogout={() => { api.logout(); router.push('/') }} />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
              Loading server snapshot…
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (error && !latest) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
        <Sidebar user={user} onLogout={() => { api.logout(); router.push('/') }} />
        <main className="flex flex-1 items-center justify-center p-6">
          <div
            role="alert"
            className="w-full max-w-md border border-red-300 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30"
          >
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-600 dark:text-red-400" />
            <h1 className="text-lg font-heading font-bold text-red-800 dark:text-red-300">
              Server status unavailable
            </h1>
            <p className="mt-2 text-sm text-red-700/80 dark:text-red-300/80">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Button onClick={() => void loadSnapshot()}>
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
              <Button variant="outline" asChild>
                <Link href="/faculty">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zinc-50 dark:bg-pup-black">
      <Sidebar user={user} onLogout={() => { api.logout(); router.push('/') }} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6 md:p-10">
          <div className="flex flex-col gap-5 border-b border-zinc-200 pb-8 mb-8 lg:flex-row lg:items-end lg:justify-between dark:border-zinc-800">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Operations console
              </p>
              <h1 className="flex items-center gap-3 text-3xl font-heading font-bold text-maroon dark:text-white">
                <Server className="h-7 w-7" />
                Server Status
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                Live metrics streamed from this backend instance. History covers roughly the last 15 minutes
                and is kept in this browser session only.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="status"
                aria-live="polite"
                className={`flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                  connected
                    ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300'
                    : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                }`}
              >
                {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                {connectionLabel}
                <span className="normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
                  · last tick {lastTick}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadSnapshot()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Snapshot
              </Button>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-6 flex flex-col gap-2 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
            >
              <span>Snapshot refresh failed: {error}</span>
              <Button variant="outline" size="sm" onClick={() => void loadSnapshot()}>
                Retry
              </Button>
            </div>
          ) : null}

          <div className="mb-6 flex items-start gap-3 border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-maroon dark:text-golden" />
            <p>
              These values describe <span className="font-bold">this backend instance</span> only. Behind a load
              balancer, use Grafana for aggregate across replicas. Uptime {latest ? formatUptime(latest.uptimeSeconds) : '—'}.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <MetricCard
              title="HTTP request rate"
              value={latest ? formatRate(history[history.length - 1]?.rates?.requestRatePerSecond) : '—'}
              caption={
                latest
                  ? `Error rate ${formatRate(history[history.length - 1]?.rates?.errorRatePerSecond)} · ${formatPercent(history[history.length - 1]?.rates?.errorPercent)} of requests`
                  : 'Waiting for the next tick'
              }
              icon={Activity}
            >
              <Sparkline
                label="HTTP request rate over the recent window"
                series={[
                  { name: 'Requests', values: series.requestRate, className: 'text-maroon dark:text-golden' },
                  { name: 'Errors', values: series.errorRate, className: 'text-red-600 dark:text-red-400' },
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-maroon dark:bg-golden" /> Requests
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-red-600 dark:bg-red-400" /> Errors
                </span>
              </div>
            </MetricCard>

            <MetricCard
              title="Latency"
              value={latest ? formatLatency(latest.latencyP95Ms) : '—'}
              caption={
                latest
                  ? `p50 ${formatLatency(latest.latencyP50Ms)} · p95 ${formatLatency(latest.latencyP95Ms)}`
                  : 'Waiting for the next tick'
              }
              icon={Clock}
            >
              <Sparkline
                label="Latency percentiles over the recent window"
                series={[
                  { name: 'p50', values: series.p50, className: 'text-maroon dark:text-golden' },
                  { name: 'p95', values: series.p95, className: 'text-golden-dark' },
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-maroon dark:bg-golden" /> p50
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-golden-dark" /> p95
                </span>
              </div>
            </MetricCard>

            <MetricCard
              title="Event-loop lag"
              value={latest ? formatLatency(latest.eventLoopLagMs) : '—'}
              caption="Lower is better; sustained lag delays every request."
              icon={Cpu}
            >
              <Sparkline
                label="Event-loop lag over the recent window"
                series={[{ name: 'Lag', values: series.lag, className: 'text-maroon dark:text-golden' }]}
              />
            </MetricCard>

            <MetricCard
              title="CPU"
              value={latest ? formatPercent(history[history.length - 1]?.rates?.cpuPercent) : '—'}
              caption="Derived from the cumulative process CPU counter. Capped at 100%."
              icon={Cpu}
            >
              <Sparkline
                label="CPU usage over the recent window"
                series={[{ name: 'CPU', values: series.cpu, className: 'text-maroon dark:text-golden' }]}
              />
            </MetricCard>

            <MetricCard
              title="Resident memory"
              value={latest ? formatByteSize(latest.memoryRssBytes) : '—'}
              caption="Process RSS for this instance."
              icon={MemoryStick}
            >
              <Sparkline
                label="Resident memory over the recent window"
                series={[{ name: 'RSS', values: series.rss, className: 'text-maroon dark:text-golden' }]}
              />
            </MetricCard>

            <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800">
              <CardHeader className="border-b border-zinc-200 p-5 dark:border-zinc-800">
                <CardTitle className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <Database className="h-4 w-4 text-maroon dark:text-golden" />
                  Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 p-5 sm:grid-cols-3">
                <ReadinessGauge label="Application" ready={latest ? latest.applicationReady : null} />
                <ReadinessGauge label="Database" ready={latest ? latest.databaseReady : null} />
                <ReadinessGauge label="Redis" ready={latest ? latest.redisReady : null} />
              </CardContent>
            </Card>

            <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800">
              <CardHeader className="border-b border-zinc-200 p-5 dark:border-zinc-800">
                <CardTitle className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <Activity className="h-4 w-4 text-maroon dark:text-golden" />
                  BullMQ queue
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 p-5">
                {[
                  { label: 'Waiting', value: latest?.queue.wait ?? 0 },
                  { label: 'Active', value: latest?.queue.active ?? 0 },
                  { label: 'Failed', value: latest?.queue.failed ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{item.label}</p>
                    <p className={`mt-1 text-2xl font-heading font-bold ${item.label === 'Failed' && item.value > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-none border-zinc-300/80 dark:border-zinc-800">
              <CardHeader className="border-b border-zinc-200 p-5 dark:border-zinc-800">
                <CardTitle className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <Wifi className="h-4 w-4 text-maroon dark:text-golden" />
                  Connections
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Active sockets</p>
                  <p className="mt-1 text-3xl font-heading font-bold text-foreground">{latest?.activeSockets ?? 0}</p>
                </div>
                <Badge variant="outline" className="uppercase tracking-widest">
                  {connected ? 'Streaming' : 'Reconnecting'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <p className="mt-8 text-[10px] uppercase tracking-widest text-zinc-400">
            Rolling window: {SERVER_HISTORY_MAX_SAMPLES} samples at a 5 s tick · gaps mark hidden tabs or reconnects.
          </p>
        </div>
      </main>
    </div>
  )
}
