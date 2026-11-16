import { describe, expect, it } from 'vitest'
import {
  createMetrics,
  HTTP_DURATION_BUCKETS_MS,
  mergeIngestMetrics,
  observeHttpDuration,
  renderMetrics,
} from '../src/metrics'

describe('http histogram', () => {
  it('keeps buckets cumulative and tracks count and sum', () => {
    const metrics = createMetrics()
    observeHttpDuration(metrics, 60, 201)
    observeHttpDuration(metrics, 400, 503)

    expect(metrics.httpRequests).toBe(2)
    expect(metrics.httpRequestsByStatus[201]).toBe(1)
    expect(metrics.httpRequestsByStatus[503]).toBe(1)
    expect(metrics.httpDurationSumMs).toBe(460)
    // 60ms lands in le=100 and every larger bucket; 400ms starts at le=500.
    const bucketAt = (bucket: number) =>
      metrics.httpDurationBuckets[HTTP_DURATION_BUCKETS_MS.indexOf(bucket as (typeof HTTP_DURATION_BUCKETS_MS)[number])]
    expect(bucketAt(50)).toBe(0)
    expect(bucketAt(100)).toBe(1)
    expect(bucketAt(200)).toBe(1)
    expect(bucketAt(500)).toBe(2)
    expect(bucketAt(5_000)).toBe(2)
  })

  it('renders the histogram and backlog gauges in Prometheus text', () => {
    const metrics = createMetrics()
    observeHttpDuration(metrics, 12, 200)
    const text = renderMetrics(metrics, { bufferDepth: 3, streamLength: 900, lagSeconds: 1.5, ready: true })

    expect(text).toContain('ingest_http_requests_total 1')
    expect(text).toContain('ingest_http_responses_total{status="200"} 1')
    expect(text).toContain('ingest_http_duration_ms_bucket{le="10"} 0')
    expect(text).toContain('ingest_http_duration_ms_bucket{le="25"} 1')
    expect(text).toContain('ingest_http_duration_ms_bucket{le="+Inf"} 1')
    expect(text).toContain('ingest_buffer_depth 3')
    expect(text).toContain('ingest_stream_length 900')
    expect(text).toContain('ingest_buffer_lag_seconds 1.5')
    expect(text).toContain('ingest_ready 1')
  })
})

describe('cluster metrics merge', () => {
  it('sums counters and histogram buckets across workers', () => {
    const first = createMetrics()
    observeHttpDuration(first, 5)
    first.scansAccepted = 2
    first.drainFailures = 1

    const second = createMetrics()
    observeHttpDuration(second, 300)
    second.scansAccepted = 3

    const merged = mergeIngestMetrics([first, second])

    expect(merged.httpRequests).toBe(2)
    expect(merged.httpDurationSumMs).toBe(305)
    expect(merged.scansAccepted).toBe(5)
    expect(merged.drainFailures).toBe(1)
    expect(merged.httpDurationBuckets[0]).toBe(1)
    // 5ms lands in every bucket; 300ms only reaches `le=500` and larger.
    expect(merged.httpDurationBuckets[3]).toBe(1)
    expect(merged.httpDurationBuckets[5]).toBe(2)
  })

  it('returns zeroed metrics when no worker has reported yet', () => {
    const merged = mergeIngestMetrics([])
    expect(merged.httpRequests).toBe(0)
    expect(merged.httpDurationBuckets).toHaveLength(HTTP_DURATION_BUCKETS_MS.length)
  })
})
