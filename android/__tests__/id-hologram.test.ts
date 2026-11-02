import {
  buildWatermarkLine,
  formatLiveUtcStamp,
  maskDeviceChip,
} from '@polycheck/shared/utils'
import {
  computeSweepTranslateRange,
  getWatermarkClockOffset,
  HOLOGRAM_MAX_OPACITY,
  HOLOGRAM_PARALLAX_TILT_DEG,
  HOLOGRAM_SWEEP_ANGLE_DEG,
  HOLOGRAM_SWEEP_DURATION_MS,
  HOLOGRAM_SWEEP_WIDTH_RATIO,
  HOLOGRAM_WATERMARK_OPACITY,
  HOLOGRAM_WATERMARK_TICK_MS,
} from '../lib/id-hologram'
import type { ServerClockOffsetReader } from '../lib/id-hologram'

describe('formatLiveUtcStamp', () => {
  it('formats a UTC timestamp zero-padded as YYYY-MM-DD HH:MM:SS', () => {
    // 2026-11-02 08:01:14 UTC
    expect(formatLiveUtcStamp(Date.UTC(2026, 10, 2, 8, 1, 14))).toBe('2026-11-02 08:01:14')
  })

  it('zero-pads every single-digit component', () => {
    // 2026-01-05 03:04:05 UTC
    expect(formatLiveUtcStamp(Date.UTC(2026, 0, 5, 3, 4, 5))).toBe('2026-01-05 03:04:05')
  })

  it('applies a positive server-clock offset across a date boundary', () => {
    const base = Date.UTC(2026, 10, 2, 23, 59, 59)
    expect(formatLiveUtcStamp(base, 1_000)).toBe('2026-11-03 00:00:00')
  })

  it('applies a negative server-clock offset across a date boundary', () => {
    const base = Date.UTC(2026, 10, 2, 0, 0, 30)
    expect(formatLiveUtcStamp(base, -60_000)).toBe('2026-11-01 23:59:30')
  })

  it('defaults the offset to 0 (device clock alone when no cache exists)', () => {
    const base = Date.UTC(2026, 10, 2, 12, 34, 56)
    expect(formatLiveUtcStamp(base, 0)).toBe(formatLiveUtcStamp(base))
  })

  it('falls back to the epoch stamp for non-finite input instead of NaN garbage', () => {
    expect(formatLiveUtcStamp(Number.NaN)).toBe('1970-01-01 00:00:00')
    expect(formatLiveUtcStamp(Date.UTC(2026, 10, 2, 8, 1, 14), Number.POSITIVE_INFINITY)).toBe(
      '1970-01-01 00:00:00',
    )
  })
})

describe('maskDeviceChip', () => {
  it('reports WEB-SESSION when no device is bound', () => {
    expect(maskDeviceChip(undefined)).toBe('WEB-SESSION')
    expect(maskDeviceChip(null)).toBe('WEB-SESSION')
    expect(maskDeviceChip('')).toBe('WEB-SESSION')
    expect(maskDeviceChip('   ')).toBe('WEB-SESSION')
  })

  it('masks to the last 4 characters of the bound installation id', () => {
    expect(maskDeviceChip('mobile-abc123')).toBe('DEVICE-BOUND •·•·c123')
    expect(maskDeviceChip('4F2A')).toBe('DEVICE-BOUND •·•·4F2A')
  })

  it('ignores separators when picking the alphanumeric tail', () => {
    expect(maskDeviceChip('ab-cd')).toBe('DEVICE-BOUND •·•·abcd')
    expect(maskDeviceChip('a b c d e')).toBe('DEVICE-BOUND •·•·bcde')
  })

  it('falls back to the dotted placeholder when fewer than 4 alphanumeric characters exist', () => {
    expect(maskDeviceChip('abc')).toBe('DEVICE-BOUND •·•·•·')
    expect(maskDeviceChip('a')).toBe('DEVICE-BOUND •·•·•·')
    expect(maskDeviceChip('···')).toBe('DEVICE-BOUND •·•·•·')
  })

  it('never renders the full device id', () => {
    const masked = maskDeviceChip('mobile-abc123')
    expect(masked.startsWith('DEVICE-BOUND')).toBe(true)
    expect(masked).not.toContain('mobile-')
    expect(masked).not.toBe('mobile-abc123')
  })
})

describe('buildWatermarkLine', () => {
  it('joins the verified prefix, live UTC stamp, and device chip', () => {
    expect(buildWatermarkLine('2026-11-02 08:01:14', 'DEVICE-BOUND •·•·4F2A')).toBe(
      'PUP-ID-VERIFIED • LIVE UTC: 2026-11-02 08:01:14 • DEVICE-BOUND •·•·4F2A',
    )
  })

  it('composes with the other helpers into the full watermark contract', () => {
    const line = buildWatermarkLine(
      formatLiveUtcStamp(Date.UTC(2026, 10, 2, 8, 1, 14)),
      maskDeviceChip('mobile-abc123'),
    )
    expect(line).toMatch(/^PUP-ID-VERIFIED • LIVE UTC: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} • (DEVICE-BOUND •·•·\S{4}|WEB-SESSION)$/)
    expect(line).toBe('PUP-ID-VERIFIED • LIVE UTC: 2026-11-02 08:01:14 • DEVICE-BOUND •·•·c123')
  })
})

describe('hologram style constants', () => {
  it('matches the F3 plan geometry', () => {
    expect(HOLOGRAM_SWEEP_WIDTH_RATIO).toBe(0.34)
    expect(HOLOGRAM_SWEEP_ANGLE_DEG).toBe(22)
    expect(HOLOGRAM_SWEEP_DURATION_MS).toBe(5000)
    expect(HOLOGRAM_WATERMARK_TICK_MS).toBe(1000)
    expect(HOLOGRAM_PARALLAX_TILT_DEG).toBe(6)
  })

  it('keeps the watermark opacity within the overlay ceiling (≤ 0.35)', () => {
    expect(HOLOGRAM_MAX_OPACITY).toBeLessThanOrEqual(0.35)
    expect(HOLOGRAM_WATERMARK_OPACITY).toBeLessThanOrEqual(HOLOGRAM_MAX_OPACITY)
    expect(HOLOGRAM_WATERMARK_OPACITY).toBeGreaterThan(0)
  })
})

describe('computeSweepTranslateRange', () => {
  const cardWidth = 340
  const bandWidth = cardWidth * HOLOGRAM_SWEEP_WIDTH_RATIO
  const bandOverhang = 96

  it('parks the band centered as a static sheen under reduce-motion', () => {
    const [start, end] = computeSweepTranslateRange(cardWidth, bandWidth, bandOverhang, true)
    expect(start).toBe(end)
    expect(start).toBe((cardWidth - bandWidth) / 2)
    // The static sheen stays fully on-card.
    expect(start).toBeGreaterThanOrEqual(0)
    expect(start + bandWidth).toBeLessThanOrEqual(cardWidth)
  })

  it('clamps the static center for cards narrower than the band', () => {
    const [start, end] = computeSweepTranslateRange(40, bandWidth, bandOverhang, true)
    expect(start).toBe(0)
    expect(end).toBe(0)
  })

  it('starts fully off-card on the left and ends fully off-card on the right', () => {
    const [start, end] = computeSweepTranslateRange(cardWidth, bandWidth, bandOverhang, false)
    expect(start).toBe(-(bandWidth + bandOverhang))
    expect(end).toBe(cardWidth + bandOverhang)
    // Both extremes leave the band (plus its rotated overhang) outside the card,
    // so the loop's instant reset is never visible.
    expect(start + bandWidth + bandOverhang).toBeLessThanOrEqual(0)
    expect(end - bandOverhang).toBeGreaterThanOrEqual(cardWidth)
  })
})

describe('getWatermarkClockOffset', () => {
  const reader = (value: number | null | Promise<number | null>): ServerClockOffsetReader =>
    () => Promise.resolve(value)

  it('uses the cached server-clock offset when available', async () => {
    await expect(getWatermarkClockOffset(reader(90_000))).resolves.toBe(90_000)
    await expect(getWatermarkClockOffset(reader(-30_000))).resolves.toBe(-30_000)
  })

  it('falls back to 0 when no offset is cached', async () => {
    await expect(getWatermarkClockOffset(reader(null))).resolves.toBe(0)
  })

  it('falls back to 0 for non-finite offsets', async () => {
    await expect(getWatermarkClockOffset(reader(Number.NaN))).resolves.toBe(0)
    await expect(getWatermarkClockOffset(reader(Number.POSITIVE_INFINITY))).resolves.toBe(0)
  })

  it('falls back to 0 when the store read fails (never rejects)', async () => {
    const failing: ServerClockOffsetReader = () => Promise.reject(new Error('db locked'))
    await expect(getWatermarkClockOffset(failing)).resolves.toBe(0)
  })

  it('shifts the watermark stamp across an hour boundary with the resolved offset', async () => {
    const offset = await getWatermarkClockOffset(reader(90_000))
    const base = Date.UTC(2026, 10, 2, 8, 1, 30)
    expect(formatLiveUtcStamp(base, offset)).toBe('2026-11-02 08:03:00')
  })
})
