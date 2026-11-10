// Pure render-model coverage for the F8 "blackbox" dispute timeline.
// The rail itself is NativeWind markup (rendering parity lives in the web
// suite); here we lock the data shaping: ordering, node/chip tone mapping,
// recommendation copy, and the fetch/retry state machine.
jest.mock('../services/api-client', () => ({
  api: { getRecordTimeline: jest.fn() },
}))
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }))

import type { RecordTimeline, RecordTimelineEvent } from '@polycheck/shared'
import { api } from '../services/api-client'
import {
  formatTimelineClock,
  loadTimelineState,
  orderTimelineEvents,
  recommendationChip,
  timelineErrorMessage,
  timelineEvidenceChips,
  timelineNodeTone,
  RECOMMENDATION_TEXT_TONE_CLASSES,
  RECOMMENDATION_TONE_CLASSES,
  TIMELINE_CHIP_TEXT_TONE_CLASSES,
  TIMELINE_CHIP_TONE_CLASSES,
  TIMELINE_NODE_TONE_CLASSES,
} from '../components/DisputeTimeline'

const buildEvent = (
  overrides: Partial<RecordTimelineEvent> & Pick<RecordTimelineEvent, 'kind' | 'at' | 'label'>,
): RecordTimelineEvent => ({
  source: 'scan_attempt',
  ...overrides,
})

describe('formatTimelineClock', () => {
  it('renders a local HH:MM:SS clock', () => {
    const local = new Date()
    local.setHours(8, 1, 14, 0)
    expect(formatTimelineClock(local.toISOString())).toBe('08:01:14')
  })

  it('pads single-digit fields', () => {
    const local = new Date()
    local.setHours(15, 4, 9, 0)
    expect(formatTimelineClock(local.toISOString())).toBe('15:04:09')
  })

  it('falls back to a blank clock for unparseable input', () => {
    expect(formatTimelineClock('not-a-date')).toBe('--:--:--')
  })
})

describe('orderTimelineEvents', () => {
  it('orders events by timestamp regardless of arrival order', () => {
    const activation = buildEvent({ kind: 'activation', at: '2026-11-02T08:00:00.000Z', label: 'Session activated', source: 'session' })
    const scan = buildEvent({ kind: 'scan', at: '2026-11-02T08:02:15.000Z', label: 'QR scanned' })
    const sync = buildEvent({ kind: 'sync', at: '2026-11-02T08:31:00.000Z', label: 'Batch synced', source: 'record' })
    expect(orderTimelineEvents([sync, activation, scan]).map((item) => item.kind)).toEqual(['activation', 'scan', 'sync'])
  })

  it('does not mutate the input array', () => {
    const first = buildEvent({ kind: 'sync', at: '2026-11-02T09:00:00.000Z', label: 'later', source: 'record' })
    const second = buildEvent({ kind: 'scan', at: '2026-11-02T08:00:00.000Z', label: 'earlier' })
    const input = [first, second]
    orderTimelineEvents(input)
    expect(input).toEqual([first, second])
  })

  it('breaks timestamp ties deterministically by kind', () => {
    const sync = buildEvent({ kind: 'sync', at: '2026-11-02T08:00:00.000Z', label: 'x', source: 'record' })
    const dispute = buildEvent({ kind: 'dispute', at: '2026-11-02T08:00:00.000Z', label: 'y', source: 'audit' })
    expect(orderTimelineEvents([sync, dispute]).map((item) => item.kind)).toEqual(['dispute', 'sync'])
  })

  it('sends unparseable timestamps to the end of the rail', () => {
    const broken = buildEvent({ kind: 'scan', at: 'nope', label: 'broken clock' })
    const good = buildEvent({ kind: 'activation', at: '2026-11-02T08:00:00.000Z', label: 'ok', source: 'session' })
    expect(orderTimelineEvents([broken, good]).map((item) => item.kind)).toEqual(['activation', 'scan'])
  })
})

describe('timelineNodeTone', () => {
  it('marks anomaly evidence red', () => {
    expect(timelineNodeTone(buildEvent({ kind: 'scan', at: '2026-11-02T08:02:15.000Z', label: 'x', detail: { mocked: true } }))).toBe('danger')
    expect(timelineNodeTone(buildEvent({ kind: 'scan', at: '2026-11-02T08:02:15.000Z', label: 'x', detail: { insideGeofence: false } }))).toBe('danger')
  })

  it('keeps verified and governance events golden', () => {
    expect(timelineNodeTone(buildEvent({ kind: 'scan', at: '2026-11-02T08:02:15.000Z', label: 'x', detail: { insideGeofence: true } }))).toBe('golden')
    expect(timelineNodeTone(buildEvent({ kind: 'signature', at: '2026-11-02T08:02:14.000Z', label: 'x', source: 'token' }))).toBe('golden')
    expect(timelineNodeTone(buildEvent({ kind: 'activation', at: '2026-11-02T08:00:00.000Z', label: 'x', source: 'session' }))).toBe('golden')
    expect(timelineNodeTone(buildEvent({ kind: 'dispute', at: '2026-11-02T09:00:00.000Z', label: 'x', source: 'audit' }))).toBe('golden')
  })

  it('dims offline pipeline events', () => {
    expect(timelineNodeTone(buildEvent({ kind: 'queue', at: '2026-11-02T08:02:20.000Z', label: 'x' }))).toBe('muted')
    expect(timelineNodeTone(buildEvent({ kind: 'network', at: '2026-11-02T08:30:00.000Z', label: 'x' }))).toBe('muted')
    expect(timelineNodeTone(buildEvent({ kind: 'sync', at: '2026-11-02T08:31:00.000Z', label: 'x', source: 'record' }))).toBe('muted')
  })
})

describe('timelineEvidenceChips', () => {
  it('chips a verified in-person scan with distance, geofence, and clock provenance', () => {
    const chips = timelineEvidenceChips(buildEvent({
      kind: 'scan',
      at: '2026-11-02T08:02:15.000Z',
      label: 'QR scanned',
      detail: { distanceMeters: 21.4, radiusMeters: 50, insideGeofence: true, channel: 'camera' },
    }))
    expect(chips).toEqual([
      { key: 'inside', label: 'Inside geofence', tone: 'success' },
      { key: 'distance', label: '21 m from room · 50 m radius', tone: 'muted' },
      { key: 'channel', label: 'Channel: camera', tone: 'muted' },
      { key: 'clock', label: 'Device clock · offset-corrected', tone: 'muted' },
    ])
  })

  it('flags mocked or outside-geofence scans as danger evidence', () => {
    const mocked = timelineEvidenceChips(buildEvent({ kind: 'scan', at: '2026-11-02T08:02:15.000Z', label: 'x', detail: { mocked: true } }))
    expect(mocked[0]).toEqual({ key: 'mocked', label: 'Mocked GPS reported', tone: 'danger' })

    const outside = timelineEvidenceChips(buildEvent({ kind: 'scan', at: '2026-11-02T08:02:15.000Z', label: 'x', detail: { insideGeofence: false, distanceMeters: 124.6 } }))
    expect(outside[0]).toEqual({ key: 'outside', label: 'Outside geofence', tone: 'danger' })
    expect(outside[1]).toEqual({ key: 'distance', label: '125 m from room', tone: 'muted' })
  })

  it('chips the signature event and meeting-PIN verification as golden', () => {
    expect(timelineEvidenceChips(buildEvent({ kind: 'signature', at: '2026-11-02T08:02:14.000Z', label: 'Token signature verified', source: 'token' })))
      .toEqual([{ key: 'signature', label: 'ED25519 signature verified', tone: 'golden' }])
    expect(timelineEvidenceChips(buildEvent({ kind: 'scan', at: '2026-11-02T08:02:15.000Z', label: 'x', detail: { pinVerified: true } })))
      .toContainEqual({ key: 'pin', label: 'Meeting PIN verified', tone: 'golden' })
  })

  it('chips the offline queue window with its sync receipt', () => {
    const queued = timelineEvidenceChips(buildEvent({ kind: 'queue', at: '2026-11-02T08:02:20.000Z', label: 'Held in encrypted queue', detail: { receiptId: 'a1b2c3d4' } }))
    expect(queued).toEqual([
      { key: 'offline', label: 'Offline · queued', tone: 'muted' },
      { key: 'receipt', label: 'Receipt a1b2c3d4', tone: 'muted' },
    ])
  })

  it('chips the masked device id when present', () => {
    expect(timelineEvidenceChips(buildEvent({ kind: 'scan', at: '2026-11-02T08:02:15.000Z', label: 'x', detail: { deviceIdMasked: 'DEVICE-BOUND •·•·4F2A' } })))
      .toContainEqual({ key: 'device', label: 'Device DEVICE-BOUND •·•·4F2A', tone: 'muted' })
  })

  it('returns no chips for a bare activation event', () => {
    expect(timelineEvidenceChips(buildEvent({ kind: 'activation', at: '2026-11-02T08:00:00.000Z', label: 'Session activated', source: 'session' }))).toEqual([])
  })
})

describe('recommendationChip', () => {
  it('formats the accept verdict from the shared label map', () => {
    const chip = recommendationChip({ verdict: 'accept', rationale: 'Cryptographic proof confirms student presence at 08:02:15' })
    expect(chip.heading).toBe('RECOMMENDATION: ACCEPT DISPUTE')
    expect(chip.rationale).toBe('Cryptographic proof confirms student presence at 08:02:15')
    expect(chip.tone).toBe('accept')
  })

  it('formats the review and reject verdicts', () => {
    expect(recommendationChip({ verdict: 'review', rationale: 'Mocked GPS signal' }).heading).toBe('RECOMMENDATION: REVIEW DISPUTE')
    expect(recommendationChip({ verdict: 'reject', rationale: 'Duplicate submission' }).heading).toBe('RECOMMENDATION: REJECT DISPUTE')
  })

  it('maps verdicts to the semantic badge palette', () => {
    expect(RECOMMENDATION_TONE_CLASSES.accept).toContain('bg-maroon')
    expect(RECOMMENDATION_TONE_CLASSES.accept).toContain('dark:bg-golden')
    expect(RECOMMENDATION_TEXT_TONE_CLASSES.accept).toContain('text-golden')
    expect(RECOMMENDATION_TONE_CLASSES.review).toContain('bg-amber')
    expect(RECOMMENDATION_TONE_CLASSES.reject).toContain('bg-red')
    expect(RECOMMENDATION_TEXT_TONE_CLASSES.reject).toContain('text-red')
  })
})

describe('tone class maps', () => {
  it('renders golden nodes, red anomaly nodes, and zinc pipeline nodes', () => {
    expect(TIMELINE_NODE_TONE_CLASSES.golden).toContain('bg-golden')
    expect(TIMELINE_NODE_TONE_CLASSES.danger).toContain('bg-red-500')
    expect(TIMELINE_NODE_TONE_CLASSES.muted).toContain('bg-zinc')
  })

  it('gives every chip tone both a container and a text class', () => {
    for (const tone of ['golden', 'success', 'danger', 'muted'] as const) {
      expect(TIMELINE_CHIP_TONE_CLASSES[tone]).toContain('border-')
      expect(TIMELINE_CHIP_TEXT_TONE_CLASSES[tone]).toContain('text-')
    }
    expect(TIMELINE_CHIP_TONE_CLASSES.success).toContain('bg-emerald')
    expect(TIMELINE_CHIP_TONE_CLASSES.danger).toContain('bg-red')
  })
})

describe('timelineErrorMessage', () => {
  it('surfaces Error messages verbatim', () => {
    expect(timelineErrorMessage(new Error('Network request failed'))).toBe('Network request failed')
  })

  it('falls back to friendly copy for non-Error failures', () => {
    expect(timelineErrorMessage('boom')).toBe('Unable to load the forensic timeline. Check your connection and try again.')
    expect(timelineErrorMessage(undefined)).toBe('Unable to load the forensic timeline. Check your connection and try again.')
  })
})

describe('loadTimelineState', () => {
  const timeline: RecordTimeline = {
    recordId: 'rec-1',
    events: [],
    recommendation: { verdict: 'accept', rationale: 'Cryptographic proof confirms presence' },
  }

  it('loads through the mocked api client', async () => {
    jest.mocked(api.getRecordTimeline).mockResolvedValueOnce(timeline)
    await expect(loadTimelineState('rec-1', (id) => api.getRecordTimeline(id))).resolves.toEqual({ phase: 'ready', timeline })
    expect(api.getRecordTimeline).toHaveBeenCalledWith('rec-1')
  })

  it('maps failures to a retryable error state', async () => {
    const state = await loadTimelineState('rec-1', async () => {
      throw new Error('Network request failed')
    })
    expect(state).toEqual({ phase: 'error', message: 'Network request failed' })
  })

  it('uses the fallback copy for non-Error failures', async () => {
    const state = await loadTimelineState('rec-1', async () => {
      throw 'boom'
    })
    expect(state.phase).toBe('error')
    expect((state as { message: string }).message).toBe('Unable to load the forensic timeline. Check your connection and try again.')
  })

  it('supports the retry path — a failed load followed by a successful retry', async () => {
    let attempts = 0
    const fetcher = async () => {
      attempts += 1
      if (attempts === 1) throw new Error('offline')
      return timeline
    }
    const first = await loadTimelineState('rec-1', fetcher)
    expect(first.phase).toBe('error')
    const second = await loadTimelineState('rec-1', fetcher)
    expect(second).toEqual({ phase: 'ready', timeline })
    expect(attempts).toBe(2)
  })
})
