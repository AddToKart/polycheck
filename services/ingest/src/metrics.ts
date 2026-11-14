/**
 * Minimal Prometheus surface.
 *
 * The gateway is a separate process with no NestJS MetricsService, so it keeps
 * its own counters. Names are prefixed `ingest_` to avoid colliding with the
 * control plane's series when both are scraped.
 *
 * In cluster mode every worker keeps its own copy; the primary aggregates the
 * snapshots workers report over IPC (`mergeIngestMetrics`) so a single scrape
 * reflects the whole container.
 */

/** Cumulative histogram buckets (ms) for `ingest_http_duration_ms`. */
export const HTTP_DURATION_BUCKETS_MS = [10, 25, 50, 100, 200, 500, 1_000, 2_000, 5_000] as const

export interface IngestMetrics {
  scansAccepted: number
  scansRejected: number
  /** Scans rejected at the request path as an already-submitted duplicate. */
  scansDuplicate: number
  /** Poison messages quarantined to the dead-letter stream. */
  deadLetterTotal: number
  drainWritten: number
  drainDuplicates: number
  drainFailures: number
  streamTrimmed: number
  httpRequests: number
  httpDurationSumMs: number
  /** Cumulative bucket counts (Prometheus semantics); `+Inf` renders as httpRequests. */
  httpDurationBuckets: number[]
  startedAt: number
}

export function createMetrics(): IngestMetrics {
  return {
    scansAccepted: 0,
    scansRejected: 0,
    scansDuplicate: 0,
    deadLetterTotal: 0,
    drainWritten: 0,
    drainDuplicates: 0,
    drainFailures: 0,
    streamTrimmed: 0,
    httpRequests: 0,
    httpDurationSumMs: 0,
    httpDurationBuckets: new Array<number>(HTTP_DURATION_BUCKETS_MS.length).fill(0),
    startedAt: Date.now(),
  }
}

/** Records one completed HTTP request. Histogram buckets stay cumulative. */
export function observeHttpDuration(metrics: IngestMetrics, durationMs: number): void {
  metrics.httpRequests += 1
  metrics.httpDurationSumMs += durationMs
  for (let index = 0; index < HTTP_DURATION_BUCKETS_MS.length; index += 1) {
    if (durationMs <= HTTP_DURATION_BUCKETS_MS[index]!) metrics.httpDurationBuckets[index]! += 1
  }
}

/**
 * Sums worker snapshots for the cluster primary. Counters are per-process
 * cumulative values, so summing live workers is the container total (a worker
 * that dies drops out; a respawn starts from zero, which is the honest number
 * for the processes actually serving).
 */
export function mergeIngestMetrics(snapshots: IngestMetrics[]): IngestMetrics {
  const merged = createMetrics()
  if (snapshots.length === 0) return merged
  merged.startedAt = Math.min(...snapshots.map((snapshot) => snapshot.startedAt))
  for (const snapshot of snapshots) {
    merged.scansAccepted += snapshot.scansAccepted
    merged.scansRejected += snapshot.scansRejected
    merged.scansDuplicate += snapshot.scansDuplicate
    merged.deadLetterTotal += snapshot.deadLetterTotal
    merged.drainWritten += snapshot.drainWritten
    merged.drainDuplicates += snapshot.drainDuplicates
    merged.drainFailures += snapshot.drainFailures
    merged.streamTrimmed += snapshot.streamTrimmed
    merged.httpRequests += snapshot.httpRequests
    merged.httpDurationSumMs += snapshot.httpDurationSumMs
    for (let index = 0; index < merged.httpDurationBuckets.length; index += 1) {
      merged.httpDurationBuckets[index]! += snapshot.httpDurationBuckets[index] ?? 0
    }
  }
  return merged
}

export interface RenderSnapshot {
  /** Pending (unacknowledged) entries — the true backlog. */
  bufferDepth: number
  /** `XLEN`: entries retained after trimming (history + backlog). */
  streamLength: number
  /** Age of the oldest unacknowledged entry, in seconds. */
  lagSeconds: number
  /** Dead-letter stream length (quarantined entries awaiting repair). */
  dlqDepth?: number
  ready: boolean
}

export function renderMetrics(metrics: IngestMetrics, snapshot: RenderSnapshot): string {
  const lines = [
    '# HELP ingest_scans_accepted_total Scans accepted and buffered',
    '# TYPE ingest_scans_accepted_total counter',
    `ingest_scans_accepted_total ${metrics.scansAccepted}`,
    '# HELP ingest_scans_rejected_total Scans rejected by validation',
    '# TYPE ingest_scans_rejected_total counter',
    `ingest_scans_rejected_total ${metrics.scansRejected}`,
    '# HELP ingest_scans_duplicate_total Scans rejected as already-submitted duplicates',
    '# TYPE ingest_scans_duplicate_total counter',
    `ingest_scans_duplicate_total ${metrics.scansDuplicate}`,
    '# HELP ingest_dead_letter_total Messages quarantined to the dead-letter stream',
    '# TYPE ingest_dead_letter_total counter',
    `ingest_dead_letter_total ${metrics.deadLetterTotal}`,
    '# HELP ingest_drain_written_total Attendance rows committed by the drainer',
    '# TYPE ingest_drain_written_total counter',
    `ingest_drain_written_total ${metrics.drainWritten}`,
    '# HELP ingest_drain_duplicates_total Replays skipped as duplicates',
    '# TYPE ingest_drain_duplicates_total counter',
    `ingest_drain_duplicates_total ${metrics.drainDuplicates}`,
    '# HELP ingest_drain_failures_total Batch writes that failed and will retry',
    '# TYPE ingest_drain_failures_total counter',
    `ingest_drain_failures_total ${metrics.drainFailures}`,
    '# HELP ingest_stream_trimmed_total Stream entries reclaimed by XTRIM',
    '# TYPE ingest_stream_trimmed_total counter',
    `ingest_stream_trimmed_total ${metrics.streamTrimmed}`,
    '# HELP ingest_buffer_depth Unacknowledged stream entries (true backlog)',
    '# TYPE ingest_buffer_depth gauge',
    `ingest_buffer_depth ${snapshot.bufferDepth}`,
    '# HELP ingest_stream_length Retained stream entries (XLEN after trimming)',
    '# TYPE ingest_stream_length gauge',
    `ingest_stream_length ${snapshot.streamLength}`,
    '# HELP ingest_buffer_lag_seconds Age of the oldest unacked entry',
    '# TYPE ingest_buffer_lag_seconds gauge',
    `ingest_buffer_lag_seconds ${snapshot.lagSeconds}`,
    '# HELP ingest_dlq_depth Dead-letter stream length',
    '# TYPE ingest_dlq_depth gauge',
    `ingest_dlq_depth ${snapshot.dlqDepth ?? 0}`,
    '# HELP ingest_http_requests_total HTTP requests answered by this process',
    '# TYPE ingest_http_requests_total counter',
    `ingest_http_requests_total ${metrics.httpRequests}`,
    '# HELP ingest_http_duration_ms HTTP request duration in milliseconds',
    '# TYPE ingest_http_duration_ms histogram',
    `ingest_http_duration_ms_sum ${metrics.httpDurationSumMs}`,
    `ingest_http_duration_ms_count ${metrics.httpRequests}`,
    ...HTTP_DURATION_BUCKETS_MS.map(
      (bucket, index) => `ingest_http_duration_ms_bucket{le="${bucket}"} ${metrics.httpDurationBuckets[index] ?? 0}`,
    ),
    `ingest_http_duration_ms_bucket{le="+Inf"} ${metrics.httpRequests}`,
    '# HELP ingest_ready Whether the gateway considers itself ready',
    '# TYPE ingest_ready gauge',
    `ingest_ready ${snapshot.ready ? 1 : 0}`,
    '# HELP ingest_uptime_seconds Process uptime',
    '# TYPE ingest_uptime_seconds gauge',
    `ingest_uptime_seconds ${Math.floor((Date.now() - metrics.startedAt) / 1000)}`,
  ]
  return `${lines.join('\n')}\n`
}
