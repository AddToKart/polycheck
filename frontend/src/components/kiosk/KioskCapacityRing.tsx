'use client'

import { pupColors } from '@/lib/colors'

/**
 * F1 projector kiosk — the class-capacity ring: verified check-ins against
 * the official roster, e.g. `38 / 42 · 90%`, golden progress on a maroon
 * track. Pure percentage math is exported for the kiosk test.
 */

const RADIUS = 44
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function capacityPct(verified: number, capacity: number): number {
  if (!Number.isFinite(verified) || !Number.isFinite(capacity) || capacity <= 0) return 0
  const pct = Math.round((Math.max(0, verified) / capacity) * 100)
  return Math.min(100, Math.max(0, pct))
}

export interface KioskCapacityRingProps {
  verified: number
  capacity: number
}

export default function KioskCapacityRing({ verified, capacity }: KioskCapacityRingProps) {
  const pct = capacityPct(verified, capacity)
  const dashOffset = CIRCUMFERENCE * (1 - pct / 100)

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 100 100"
        className="h-20 w-20 -rotate-90"
        role="img"
        aria-label={`Capacity ring: ${pct} percent of the roster verified`}
      >
        <circle
          data-testid="kiosk-capacity-track"
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={pupColors.maroonDark}
          strokeWidth={9}
        />
        <circle
          data-testid="kiosk-capacity-ring"
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={pupColors.golden}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div>
        <p
          data-testid="kiosk-capacity-text"
          className="text-3xl font-bold text-white tabular-nums"
        >
          {verified} / {capacity}
          <span className="ml-2 text-golden">· {pct}%</span>
        </p>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-200">
          Verified check-ins · reconciled against the official roster
        </p>
      </div>
    </div>
  )
}
