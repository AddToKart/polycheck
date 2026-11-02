'use client'

import { useEffect, useState } from 'react'
import {
  buildWatermarkLine,
  formatLiveUtcStamp,
  maskDeviceChip,
} from '@polycheck/shared'
import { getServerClockOffset } from '@/lib/offline/store'

/**
 * F3 anti-screenshot hologram layer for surfaces that display a digital
 * student ID card.
 *
 * Three decorative strata (all `pointer-events-none`, `aria-hidden`) render
 * above the card artwork but below any interactive controls:
 *
 * 1. A diagonal gradient sweep band (~34% width, rotated 22°) gliding across
 *    the card via the shared `hologram-sweep` CSS keyframes. Under
 *    `prefers-reduced-motion` the animation is disabled and the band rests as
 *    a static centered sheen (`motion-reduce:left-[33%]`).
 * 2. A live UTC watermark line repeated diagonally, re-stamped every second
 *    from `Date.now() + getServerClockOffset()` — the offline store's trusted
 *    clock rule — so the stamp never trusts the bare device clock. `null`
 *    offsets (no captured clock, stale capture, failed read) resolve to 0 and
 *    the layer keeps ticking on device time. `tabular-nums` keeps the
 *    per-second digits from jiggle-shifting the layout.
 * 3. A masked device-binding chip: never the full installation id, only an
 *    alphanumeric last-4 tail (`DEVICE-BOUND •·•·xxxx`), or `WEB-SESSION`
 *    when the ID is not device-bound.
 *
 * The watermark opacity/colors stay subtle (≤0.35 band tint, thin 10px
 * marks) so the photo, QR, and card details remain readable beneath.
 */

type HologramTone = 'light' | 'dark'

interface HologramOverlayProps {
  /** Bound device installation id; nullish values render the `WEB-SESSION` chip. */
  deviceId?: string | null
  /**
   * `light` — white/paper card faces (auto-shifts to the golden sheen under
   * dark mode); `dark` — faces that stay maroon/dark in both color schemes.
   */
  tone?: HologramTone
}

const WATERMARK_ROW_COUNT = 8
const WATERMARK_COLUMN_COUNT = 4
const WATERMARK_TICK_MS = 1000

const TONE_STYLES: Record<HologramTone, { band: string; mark: string }> = {
  light: {
    band: 'bg-gradient-to-r from-transparent via-maroon/30 dark:via-golden/30 to-transparent mix-blend-multiply dark:mix-blend-screen',
    mark: 'text-maroon/50 dark:text-golden/70',
  },
  dark: {
    band: 'bg-gradient-to-r from-transparent via-golden/30 to-transparent mix-blend-screen',
    mark: 'text-golden/70',
  },
}

export function HologramOverlay({ deviceId, tone = 'light' }: HologramOverlayProps) {
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    getServerClockOffset()
      .then((offset) => {
        // A captured server-clock offset is trusted; every other outcome
        // (no capture, stale capture, failed read) resolves to 0.
        if (alive && typeof offset === 'number') {
          setClockOffsetMs(offset)
        }
      })
      .catch(() => {
        /* Trusted clock unavailable: keep ticking on device time. */
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), WATERMARK_TICK_MS)
    return () => window.clearInterval(intervalId)
  }, [])

  const watermarkLine = buildWatermarkLine(
    formatLiveUtcStamp(nowMs, clockOffsetMs),
    maskDeviceChip(deviceId),
  )
  const { band, mark } = TONE_STYLES[tone]

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className={`absolute -inset-y-[30%] left-0 w-[34%] rotate-[22deg] motion-reduce:left-[33%] animate-[hologram-sweep_5s_linear_infinite] motion-reduce:animate-none ${band}`}
      />
      <div className="absolute -inset-[60%] flex rotate-[22deg] flex-col justify-center gap-[126px]">
        {Array.from({ length: WATERMARK_ROW_COUNT }).map((_, row) => (
          <div key={row} className="flex gap-x-10 whitespace-nowrap">
            {Array.from({ length: WATERMARK_COLUMN_COUNT }).map((_, column) => (
              <span
                key={column}
                className={`text-[10px] leading-[14px] font-sans font-bold uppercase tracking-widest tabular-nums ${mark}`}
              >
                {watermarkLine}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
