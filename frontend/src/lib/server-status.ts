import type { ServerStatusSnapshot } from '@polycheck/shared'

/** 15 minutes of 5 s ticks — the page's rolling client-side window. */
export const SERVER_HISTORY_MAX_SAMPLES = 180
export const SERVER_HISTORY_WINDOW_MS = 15 * 60_000
/**
 * A tick that arrives after a longer gap (hidden tab, reconnect) must not be
 * used to derive rates: the counter delta would be smeared over the wrong
 * time span and draw a misleading spike.
 */
export const SERVER_RATE_MAX_GAP_MS = 30_000

export interface ServerRateDeltas {
  requestRatePerSecond: number
  errorRatePerSecond: number
  errorPercent: number
  cpuPercent: number
}

export interface ServerHistorySample {
  snapshot: ServerStatusSnapshot
  receivedAt: number
  rates: ServerRateDeltas | null
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/**
 * Derive per-second rates from cumulative counters. Returns null when there is
 * no trustworthy baseline (first tick, hidden-tab gap, clock skew, or a
 * counter reset such as a backend restart).
 */
export function deriveServerRates(
  previous: ServerStatusSnapshot | null,
  next: ServerStatusSnapshot,
  elapsedMs: number,
): ServerRateDeltas | null {
  if (!previous) return null
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || elapsedMs > SERVER_RATE_MAX_GAP_MS) return null
  const requests = next.httpRequestsTotal - previous.httpRequestsTotal
  const errors = next.httpErrorsTotal - previous.httpErrorsTotal
  const cpuSeconds = next.cpuSecondsTotal - previous.cpuSecondsTotal
  if (requests < 0 || errors < 0 || cpuSeconds < 0) return null
  const seconds = elapsedMs / 1000
  return {
    requestRatePerSecond: requests / seconds,
    errorRatePerSecond: errors / seconds,
    errorPercent: requests > 0 ? (errors / requests) * 100 : 0,
    // Process CPU is cumulative; a multi-core host can accumulate more CPU
    // seconds than wall-clock seconds, so display it as a capped percentage.
    cpuPercent: clampPercent((cpuSeconds / seconds) * 100),
  }
}

export function appendServerSample(
  history: ServerHistorySample[],
  snapshot: ServerStatusSnapshot,
  receivedAt: number = Date.now(),
  options: { maxSamples?: number; windowMs?: number } = {},
): ServerHistorySample[] {
  const maxSamples = options.maxSamples ?? SERVER_HISTORY_MAX_SAMPLES
  const windowMs = options.windowMs ?? SERVER_HISTORY_WINDOW_MS
  const previous = history.length ? history[history.length - 1] : null
  const rates = deriveServerRates(
    previous?.snapshot ?? null,
    snapshot,
    previous ? receivedAt - previous.receivedAt : 0,
  )
  const next = [...history, { snapshot, receivedAt, rates }]
  return next.filter((sample) => receivedAt - sample.receivedAt <= windowMs).slice(-maxSamples)
}

export function isHistoryGap(
  previous: ServerHistorySample | undefined,
  current: ServerHistorySample,
  maxGapMs = SERVER_RATE_MAX_GAP_MS,
): boolean {
  if (!previous) return false
  return current.receivedAt - previous.receivedAt > maxGapMs
}

/**
 * Project a sample property into a chart series, inserting a null marker at
 * hidden-tab/reconnect gaps so the sparkline never draws a fictitious line
 * across missing time.
 */
export function seriesWithGaps(
  history: ServerHistorySample[],
  project: (sample: ServerHistorySample) => number | null,
  maxGapMs = SERVER_RATE_MAX_GAP_MS,
): Array<number | null> {
  const values: Array<number | null> = []
  history.forEach((sample, index) => {
    if (isHistoryGap(history[index - 1], sample, maxGapMs)) values.push(null)
    values.push(project(sample))
  })
  return values
}

export interface SparklinePoint {
  x: number
  y: number
}

/**
 * Convert a series into SVG segments. Null values split the line so hidden-tab
 * gaps and unavailable gauges do not get connected by a fictitious slope.
 */
export function sparklineSegments(
  values: Array<number | null>,
  width = 100,
  height = 32,
  padding = 2,
): SparklinePoint[][] {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (finite.length === 0) return []
  let min = Math.min(...finite)
  let max = Math.max(...finite)
  if (min === max) {
    min -= 1
    max += 1
  }
  const usableHeight = Math.max(1, height - padding * 2)
  const segments: SparklinePoint[][] = []
  let current: SparklinePoint[] = []
  values.forEach((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      if (current.length) segments.push(current)
      current = []
      return
    }
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = height - padding - ((value - min) / (max - min)) * usableHeight
    current.push({ x, y })
  })
  if (current.length) segments.push(current)
  return segments
}

export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)}/s`
}

export function formatLatency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value < 1) return '<1 ms'
  return `${Math.round(value)} ms`
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(fractionDigits)}%`
}

export function formatByteSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(decimals)} ${units[unit]}`
}

export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const totalMinutes = Math.floor(seconds / 60)
  if (totalMinutes < 1) return '<1m'
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatSnapshotTimestamp(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}
