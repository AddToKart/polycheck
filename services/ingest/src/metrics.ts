/**
 * Minimal Prometheus surface.
 *
 * The gateway is a separate process with no NestJS MetricsService, so it keeps
 * its own counters. Names are prefixed `ingest_` to avoid colliding with the
 * control plane's series when both are scraped.
 */
export interface IngestMetrics {
  scansAccepted: number
  scansRejected: number
  drainWritten: number
  drainDuplicates: number
  drainFailures: number
  startedAt: number
}

export function createMetrics(): IngestMetrics {
  return {
    scansAccepted: 0,
    scansRejected: 0,
    drainWritten: 0,
    drainDuplicates: 0,
    drainFailures: 0,
    startedAt: Date.now(),
  }
}

export function renderMetrics(metrics: IngestMetrics, bufferDepth: number, lagSeconds: number, ready: boolean) {
  const lines = [
    '# HELP ingest_scans_accepted_total Scans accepted and buffered',
    '# TYPE ingest_scans_accepted_total counter',
    `ingest_scans_accepted_total ${metrics.scansAccepted}`,
    '# HELP ingest_scans_rejected_total Scans rejected by validation',
    '# TYPE ingest_scans_rejected_total counter',
    `ingest_scans_rejected_total ${metrics.scansRejected}`,
    '# HELP ingest_drain_written_total Attendance rows committed by the drainer',
    '# TYPE ingest_drain_written_total counter',
    `ingest_drain_written_total ${metrics.drainWritten}`,
    '# HELP ingest_drain_duplicates_total Replays skipped as duplicates',
    '# TYPE ingest_drain_duplicates_total counter',
    `ingest_drain_duplicates_total ${metrics.drainDuplicates}`,
    '# HELP ingest_drain_failures_total Batch writes that failed and will retry',
    '# TYPE ingest_drain_failures_total counter',
    `ingest_drain_failures_total ${metrics.drainFailures}`,
    '# HELP ingest_buffer_depth Pending entries in the stream',
    '# TYPE ingest_buffer_depth gauge',
    `ingest_buffer_depth ${bufferDepth}`,
    '# HELP ingest_buffer_lag_seconds Age of the oldest unacked entry',
    '# TYPE ingest_buffer_lag_seconds gauge',
    `ingest_buffer_lag_seconds ${lagSeconds}`,
    '# HELP ingest_ready Whether the gateway considers itself ready',
    '# TYPE ingest_ready gauge',
    `ingest_ready ${ready ? 1 : 0}`,
    '# HELP ingest_uptime_seconds Process uptime',
    '# TYPE ingest_uptime_seconds gauge',
    `ingest_uptime_seconds ${Math.floor((Date.now() - metrics.startedAt) / 1000)}`,
  ]
  return `${lines.join('\n')}\n`
}
