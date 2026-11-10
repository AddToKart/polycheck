import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FinaleCountStatus, SessionFinaleSummary } from '@polycheck/shared'

// Next/Image is unusable in jsdom — mirror the mock other suits use.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, width, height, ...rest } = props as {
      src: string
      alt: string
      width: number
      height: number
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} {...rest} />
  },
}))

import { QR_RING_CIRCUMFERENCE, qrRingDashOffset, qrRingProgress } from './KioskQrRing'
import KioskQrRing from './KioskQrRing'
import { capacityPct } from './KioskCapacityRing'
import KioskCapacityRing from './KioskCapacityRing'
import {
  TICKER_MAX_VISIBLE,
  TICKER_TTL_MS,
  addTickerEntry,
  formatTickerTime,
  pruneTicker,
} from './KioskTicker'
import KioskTicker from './KioskTicker'
import { FINALE_CONFETTI_COUNT, confettiPiece, finaleAttendancePercent } from './KioskFinale'
import KioskFinale from './KioskFinale'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── QR ring math ─────────────────────────────────────────────────────────────

describe('KioskQrRing ring math', () => {
  it('drains stroke-dashoffset from the validity window (full → half → zero)', () => {
    expect(QR_RING_CIRCUMFERENCE).toBeCloseTo(2 * Math.PI * 47, 6)
    expect(qrRingDashOffset(10_000, 10_000)).toBeCloseTo(0, 6)
    expect(qrRingDashOffset(5_000, 10_000)).toBeCloseTo(QR_RING_CIRCUMFERENCE / 2, 6)
    expect(qrRingDashOffset(0, 10_000)).toBeCloseTo(QR_RING_CIRCUMFERENCE, 6)
    expect(qrRingDashOffset(-4_000, 10_000)).toBeCloseTo(QR_RING_CIRCUMFERENCE, 6)
  })

  it('clamps invalid windows to zero progress instead of NaN', () => {
    expect(qrRingProgress(5_000, 0)).toBe(0)
    expect(qrRingProgress(5_000, Number.NaN)).toBe(0)
    expect(qrRingProgress(Number.NaN, 10_000)).toBe(0)
    expect(qrRingProgress(30_000, 10_000)).toBe(1)
  })

  it('renders the golden progress ring and turns maroon under 20%', () => {
    const { rerender } = render(
      <KioskQrRing qrDataUrl="data:image/png;base64,qr" remainingMs={8_000} totalMs={10_000} countdownLabel="00:08" />,
    )
    const ring = screen.getByTestId('kiosk-qr-ring')
    // Template-literal floats differ in trailing zeros; compare numerically.
    expect(Number(ring.getAttribute('stroke-dashoffset'))).toBeCloseTo(QR_RING_CIRCUMFERENCE * 0.2, 9)
    expect(ring.getAttribute('stroke')).toBe('#FFDF00')
    expect(screen.getByTestId('kiosk-qr-countdown')).toHaveTextContent('00:08')

    rerender(
      <KioskQrRing qrDataUrl="data:image/png;base64,qr" remainingMs={1_800} totalMs={10_000} countdownLabel="00:01" />,
    )
    expect(screen.getByTestId('kiosk-qr-ring').getAttribute('stroke')).toBe('#7B1113')
  })

  it('shows the unarmed placeholder when no token is live', () => {
    render(<KioskQrRing qrDataUrl={null} remainingMs={null} totalMs={null} countdownLabel={null} />)
    expect(screen.getByText('QR not armed')).toBeInTheDocument()
    expect(screen.queryByTestId('kiosk-qr-countdown')).not.toBeInTheDocument()
  })
})

// ── Capacity ring ────────────────────────────────────────────────────────────

describe('KioskCapacityRing', () => {
  it('computes the verified/roster percentage with rounding and clamping', () => {
    expect(capacityPct(38, 42)).toBe(90)
    expect(capacityPct(0, 42)).toBe(0)
    expect(capacityPct(42, 42)).toBe(100)
    expect(capacityPct(50, 40)).toBe(100)
    expect(capacityPct(12, 0)).toBe(0)
  })

  it('renders the 38 / 42 · 90% count line and golden ring on the maroon track', () => {
    render(<KioskCapacityRing verified={38} capacity={42} />)

    expect(screen.getByTestId('kiosk-capacity-text')).toHaveTextContent('38 / 42')
    expect(screen.getByTestId('kiosk-capacity-text')).toHaveTextContent('· 90%')
    const ring = screen.getByTestId('kiosk-capacity-ring')
    expect(ring.getAttribute('stroke')).toBe('#FFDF00')
    // 90% drained clockwise around the golden-angle circumference.
    const circumference = 2 * Math.PI * 44
    expect(Number(ring.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.1, 6)
    expect(screen.getByTestId('kiosk-capacity-track').getAttribute('stroke')).toBe('#4A0A0B')
  })
})

// ── Ticker add / expiry ──────────────────────────────────────────────────────

const NOW = Date.parse('2026-08-06T08:01:00.000Z') // local 10:00:00 at UTC+2

function chipEvent(index: number, status = 'present', at = '2026-08-06T06:00:0' + index) {
  return {
    recordId: `record-${index}`,
    studentName: `Student ${index}`,
    status,
    timestamp: at,
  }
}

describe('KioskTicker add/expiry math', () => {
  it('formats HH:MM:SS locally and labels invalid timestamps as dashes', () => {
    expect(formatTickerTime('2026-08-06T06:01:14.000Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(formatTickerTime('not-a-date')).toBe('—:—:—')
  })

  it('prepends new chips, dedupes re-broadcasts, and marks late check-ins', () => {
    let entries = addTickerEntry([], chipEvent(1), NOW)
    entries = addTickerEntry(entries, chipEvent(2), NOW + 1)
    entries = addTickerEntry(entries, chipEvent(3, 'late'), NOW + 2)

    expect(entries.map((entry) => entry.id)).toEqual(['record-3', 'record-2', 'record-1'])
    expect(entries.find((entry) => entry.id === 'record-3')?.late).toBe(true)
    expect(entries.find((entry) => entry.id === 'record-1')?.late).toBe(false)

    const rebroadcast = addTickerEntry(entries, chipEvent(1), NOW + 3)
    expect(rebroadcast).toEqual(entries)
  })

  it('expires chips after 12s and caps the visible list at 5', () => {
    expect(TICKER_MAX_VISIBLE).toBe(5)
    let entries: ReturnType<typeof addTickerEntry> = []
    for (let i = 1; i <= 7; i += 1) entries = addTickerEntry(entries, chipEvent(i), NOW + i * 1000)
    const pruned = pruneTicker(entries, NOW + 1_000 + TICKER_TTL_MS) // first chip expired

    expect(pruned.map((entry) => entry.id)).toEqual(['record-7', 'record-6', 'record-5', 'record-4', 'record-3'])
    expect(TICKER_TTL_MS).toBe(12_000)
  })
})

describe('KioskTicker component', () => {
  it('springs chips in with late styling and keeps an aria-live summary', () => {
    const entries = addTickerEntry(addTickerEntry([], chipEvent(1), NOW), chipEvent(2, 'late'), NOW + 1000)
    render(<KioskTicker entries={pruneTicker(entries, NOW + 2000)} />)

    const chips = screen.getAllByTestId('kiosk-ticker-chip')
    expect(chips).toHaveLength(2)
    expect(chips[0]).toHaveAttribute('data-late', 'true')
    expect(chips[0]).toHaveTextContent('Late')
    expect(chips[0].className).toContain('kiosk-ticker-in')
    expect(chips[0].className).toContain('motion-reduce:animate-none')

    const live = document.querySelector('[aria-live="polite"]')
    expect(live).toHaveTextContent('latest: Student 2 at')
    expect(live?.textContent).toContain('(late)')
  })

  it('shows the waiting state when no check-ins have landed', () => {
    render(<KioskTicker entries={[]} />)
    expect(screen.getByText('Waiting for the first check-in…')).toBeInTheDocument()
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Waiting for the first check-in')
  })
})

// ── Finale ───────────────────────────────────────────────────────────────────

const summary: SessionFinaleSummary = {
  sessionId: 'session-1',
  endedAt: '2026-08-06T09:00:12.000Z',
  counts: {
    present: 32,
    late: 6,
    absent: 2,
    excused: 1,
    incomplete: 1,
    disputed: 0,
    pending: 0,
  } as Record<FinaleCountStatus, number>,
  capacity: 42,
}

describe('KioskFinale', () => {
  it('computes the standing-policy rate: (present+late) / (that + incomplete + absent)', () => {
    expect(finaleAttendancePercent(summary.counts)).toBe(93) // 38 / 41 rounded
    expect(finaleAttendancePercent({ ...summary.counts, present: 0, late: 0, incomplete: 0, absent: 0 })).toBeNull()
  })

  it('renders the finalized counts card with the PUP seal from the summary', () => {
    render(<KioskFinale summary={summary} subjectName="Software Engineering" sectionLabel="BSCS 3-1" />)

    expect(screen.getByText('Software Engineering')).toBeInTheDocument()
    expect(screen.getByText('· BSCS 3-1')).toBeInTheDocument()
    const counts = screen.getAllByTestId('kiosk-finale-count')
    expect(counts).toHaveLength(7)
    expect(counts.find((n) => n.dataset.status === 'present')?.textContent).toContain('32')
    expect(counts.find((n) => n.dataset.status === 'late')?.textContent).toContain('6')
    expect(counts.find((n) => n.dataset.status === 'excused')?.textContent).toContain('Excused (E)')
    expect(screen.getByText('93%')).toBeInTheDocument()
    expect(screen.getByAltText('')?.getAttribute('src')).toContain('pup-logo')
  })

  it('shows the static breakdown under reduced motion and confetti otherwise', () => {
    const { container, rerender } = render(<KioskFinale summary={summary} subjectName="SW" />)
    const pieces = container.querySelectorAll('.kiosk-confetti, .absolute.-top-16')

    const animated = document.querySelectorAll('[class*="kiosk-confetti-fall"]')
    expect(animated).toHaveLength(FINALE_CONFETTI_COUNT)
    animated.forEach((piece) => {
      expect(piece.className).toContain('motion-reduce:hidden')
    })
    // Deterministic scatter: nth piece always lands at the same left offset.
    const firstStyle = (animated[0] as HTMLElement).style.left
    const tenthStyle = (animated[9] as HTMLElement).style.left
    expect(firstStyle).toBe(`${confettiPiece(0).leftPercent}%`)
    expect(tenthStyle).toBe(`${confettiPiece(9).leftPercent}%`)

    rerender(<KioskFinale summary={summary} subjectName="SW" />)
    expect(container.querySelectorAll('[class*="kiosk-confetti-fall"]')).toHaveLength(FINALE_CONFETTI_COUNT)
    void pieces
  })
})


