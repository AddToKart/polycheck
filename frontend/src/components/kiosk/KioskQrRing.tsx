'use client'

import Image from 'next/image'
import { pupColors } from '@/lib/colors'

/**
 * F1 projector kiosk — the countdown ring around the session QR.
 *
 * The ring animates `stroke-dashoffset` over the token's validity window:
 * a full circle at start, drained to zero as the token expires, and the
 * stroke turns from golden to maroon once under 20% remains. Ring math is
 * extracted so the kiosk test can assert the dashoffset derivation.
 */

export const QR_RING_RADIUS = 47
export const QR_RING_CIRCUMFERENCE = 2 * Math.PI * QR_RING_RADIUS

/** Normalized [0,1] remaining-fraction of the validity window. */
export function qrRingProgress(remainingMs: number, totalMs: number): number {
  if (!Number.isFinite(remainingMs) || !Number.isFinite(totalMs) || totalMs <= 0) return 0
  if (remainingMs <= 0) return 0
  return Math.min(1, remainingMs / totalMs)
}

/** SVG `stroke-dashoffset` for the ring at the given remaining window. */
export function qrRingDashOffset(remainingMs: number, totalMs: number): number {
  return QR_RING_CIRCUMFERENCE * (1 - qrRingProgress(remainingMs, totalMs))
}

export interface KioskQrRingProps {
  qrDataUrl: string | null
  /** Remaining validity in milliseconds; null when nothing is armed. */
  remainingMs: number | null
  /** Full validity window in milliseconds. */
  totalMs: number | null
  /** Seconds-only countdown label under the ring (e.g. "00:34"). */
  countdownLabel?: string | null
  sizePx?: number
  ariaLabel?: string
}

export default function KioskQrRing({
  qrDataUrl,
  remainingMs,
  totalMs,
  countdownLabel,
  sizePx = 320,
  ariaLabel = 'Session QR validity ring',
}: KioskQrRingProps) {
  const progress = totalMs === null || remainingMs === null ? 0 : qrRingProgress(remainingMs, totalMs)
  const dashOffset = qrRingDashOffset(remainingMs ?? 0, totalMs ?? 0)
  const stroke = progress < 0.2 ? pupColors.maroon : pupColors.golden

  return (
    <figure
      className="relative m-0"
      style={{ width: sizePx, height: sizePx }}
      role="img"
      aria-label={`${ariaLabel}: ${countdownLabel ?? 'not armed'}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden="true"
      >
        {/* Under-track keeps the low-time maroon state readable on the stage. */}
        <circle
          cx="50"
          cy="50"
          r={QR_RING_RADIUS}
          fill="none"
          stroke={pupColors.white}
          strokeOpacity={0.35}
          strokeWidth={2.5}
        />
        <circle
          data-testid="kiosk-qr-ring-track"
          cx="50"
          cy="50"
          r={QR_RING_RADIUS}
          fill="none"
          stroke={pupColors.maroonDark}
          strokeOpacity={0.9}
          strokeWidth={6}
        />
        <circle
          data-testid="kiosk-qr-ring"
          cx="50"
          cy="50"
          r={QR_RING_RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth={6}
          strokeLinecap="butt"
          strokeDasharray={QR_RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-[9%] flex items-center justify-center bg-white p-[6px] shadow-2xl">
        {qrDataUrl ? (
          <Image
            src={qrDataUrl}
            width={sizePx}
            height={sizePx}
            unoptimized
            alt="Scannable session QR code"
            className="h-full w-full object-contain"
          />
        ) : (
          <p className="px-6 text-center text-sm font-bold uppercase tracking-widest text-zinc-400">
            QR not armed
          </p>
        )}
      </div>
      {countdownLabel ? (
        <figcaption className="absolute inset-x-0 -bottom-14 text-center">
          <span
            data-testid="kiosk-qr-countdown"
            className="border border-golden/50 bg-maroon-dark/70 px-4 py-1 text-2xl font-bold tracking-widest tabular-nums text-golden"
          >
            {countdownLabel}
          </span>
        </figcaption>
      ) : null}
    </figure>
  )
}
