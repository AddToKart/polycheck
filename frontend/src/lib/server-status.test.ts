import { describe, expect, it } from 'vitest'
import type { ServerStatusSnapshot } from '@polycheck/shared'
import {
  appendServerSample,
  deriveServerRates,
  formatByteSize,
  formatLatency,
  formatPercent,
  formatRate,
  formatUptime,
  isHistoryGap,
  SERVER_HISTORY_MAX_SAMPLES,
  SERVER_RATE_MAX_GAP_MS,
  seriesWithGaps,
  sparklineSegments,
  type ServerHistorySample,
} from './server-status'

function snapshot(overrides: Partial<ServerStatusSnapshot> = {}): ServerStatusSnapshot {
  return {
    timestamp: '2026-10-26T02:30:00.000Z',
    uptimeSeconds: 3_600,
    httpRequestsTotal: 1_000,
    httpErrorsTotal: 10,
    latencyP50Ms: 12,
    latencyP95Ms: 40,
    eventLoopLagMs: 3,
    memoryRssBytes: 128 * 1024 * 1024,
    cpuSecondsTotal: 600,
    applicationReady: true,
    databaseReady: true,
    redisReady: true,
    queue: { wait: 2, active: 1, failed: 0 },
    activeSockets: 8,
    ...overrides,
  }
}

describe('server status helpers', () => {
  it('derives request, error, and CPU rates from cumulative counters', () => {
    const rates = deriveServerRates(
      snapshot(),
      snapshot({ httpRequestsTotal: 1_100, httpErrorsTotal: 15, cpuSecondsTotal: 602 }),
      5_000,
    )
    expect(rates).not.toBeNull()
    expect(rates?.requestRatePerSecond).toBeCloseTo(20)
    expect(rates?.errorRatePerSecond).toBeCloseTo(1)
    expect(rates?.errorPercent).toBeCloseTo(5)
    expect(rates?.cpuPercent).toBeCloseTo(40)
  })

  it('refuses to derive rates without a baseline, across a hidden-tab gap, or after a restart', () => {
    expect(deriveServerRates(null, snapshot(), 5_000)).toBeNull()
    expect(
      deriveServerRates(snapshot(), snapshot({ httpRequestsTotal: 2_000 }), SERVER_RATE_MAX_GAP_MS + 1),
    ).toBeNull()
    expect(deriveServerRates(snapshot(), snapshot({ httpRequestsTotal: 900 }), 5_000)).toBeNull()
    expect(deriveServerRates(snapshot(), snapshot(), 0)).toBeNull()
  })

  it('caps CPU percent and handles zero requests', () => {
    expect(
      deriveServerRates(snapshot(), snapshot({ cpuSecondsTotal: 610 }), 5_000)?.cpuPercent,
    ).toBe(100)
    expect(
      deriveServerRates(
        snapshot(),
        snapshot({ httpRequestsTotal: 1_000, httpErrorsTotal: 10 }),
        5_000,
      ),
    ).toEqual(expect.objectContaining({ requestRatePerSecond: 0, errorRatePerSecond: 0, errorPercent: 0 }))
  })

  it('appends samples within the rolling window and sample cap', () => {
    let history: ServerHistorySample[] = []
    for (let index = 0; index < SERVER_HISTORY_MAX_SAMPLES + 10; index += 1) {
      history = appendServerSample(
        history,
        snapshot({ httpRequestsTotal: 1_000 + index * 10 }),
        index * 5_000,
        { maxSamples: SERVER_HISTORY_MAX_SAMPLES, windowMs: 60 * 60_000 },
      )
    }
    expect(history).toHaveLength(SERVER_HISTORY_MAX_SAMPLES)
    // The retained window starts mid-stream, so every retained sample except a
    // true first tick has a baseline. The newest sample reflects the 10-request
    // increments every 5 seconds.
    expect(history[history.length - 1].rates?.requestRatePerSecond).toBeCloseTo(2)
    expect(history[0].rates).not.toBeNull()
  })

  it('drops samples outside the 15-minute window', () => {
    const history = appendServerSample([], snapshot(), 0)
    const next = appendServerSample(history, snapshot(), 16 * 60_000)
    expect(next).toHaveLength(1)
    expect(next[0].receivedAt).toBe(16 * 60_000)
  })

  it('marks hidden-tab or reconnect gaps in chart series', () => {
    const samples: ServerHistorySample[] = [
      { snapshot: snapshot({ latencyP50Ms: 10 }), receivedAt: 0, rates: null },
      { snapshot: snapshot({ latencyP50Ms: 12 }), receivedAt: 5_000, rates: null },
      { snapshot: snapshot({ latencyP50Ms: 90 }), receivedAt: 5_000 + SERVER_RATE_MAX_GAP_MS + 1, rates: null },
    ]
    expect(isHistoryGap(samples[0], samples[1])).toBe(false)
    expect(isHistoryGap(samples[1], samples[2])).toBe(true)
    expect(seriesWithGaps(samples, (sample) => sample.snapshot.latencyP50Ms)).toEqual([10, 12, null, 90])
  })

  it('splits sparkline segments at null gaps', () => {
    const segments = sparklineSegments([0, 5, 10], 100, 20)
    expect(segments).toHaveLength(1)
    expect(segments[0][0]).toEqual({ x: 0, y: 18 })
    expect(segments[0][1]).toEqual({ x: 50, y: 10 })
    expect(segments[0][2]).toEqual({ x: 100, y: 2 })

    const gapped = sparklineSegments([1, null, 2, 3], 100, 20)
    expect(gapped).toHaveLength(2)
    expect(gapped[0]).toHaveLength(1)
    expect(gapped[1]).toHaveLength(2)

    expect(sparklineSegments([null, null])).toEqual([])
    expect(sparklineSegments([])).toEqual([])
  })

  it('formats metric values for display', () => {
    expect(formatRate(null)).toBe('—')
    expect(formatRate(12.34)).toBe('12.3/s')
    expect(formatLatency(null)).toBe('—')
    expect(formatLatency(0.4)).toBe('<1 ms')
    expect(formatLatency(41.6)).toBe('42 ms')
    expect(formatPercent(4.25)).toBe('4.3%')
    expect(formatByteSize(null)).toBe('—')
    expect(formatByteSize(512)).toBe('512 B')
    expect(formatByteSize(1024)).toBe('1.00 KB')
    expect(formatByteSize(512 * 1024 * 1024)).toBe('512 MB')
    expect(formatByteSize(2 * 1024 ** 3)).toBe('2.00 GB')
    expect(formatUptime(45)).toBe('<1m')
    expect(formatUptime(3_725)).toBe('1h 2m')
    expect(formatUptime(90_000)).toBe('1d 1h')
  })
})
