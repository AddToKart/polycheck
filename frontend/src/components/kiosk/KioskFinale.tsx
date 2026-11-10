'use client'

import Image from 'next/image'
import { Lock, PartyPopper } from 'lucide-react'
import type { FinaleCountStatus, SessionFinaleSummary } from '@polycheck/shared'
import { pupColors } from '@/lib/colors'

/**
 * F1 projector kiosk — the end-of-class finale.
 *
 * On `session:finale` the QR freezes into a lock, CSS confetti (gold/maroon
 * rectangles; hidden entirely under prefers-reduced-motion so the "static
 * breakdown" carries the moment) rains past the stage, and the finalized
 * counts card renders beside the PUP seal. Confetti placement is a pure,
 * index-seeded function so tests and renders stay deterministic.
 */

export const FINALE_CONFETTI_COUNT = 28

export interface ConfettiPiece {
  leftPercent: number
  delaySeconds: number
  durationSeconds: number
  widthPx: number
  heightPx: number
  color: string
}

const CONFETTI_PALETTE = [pupColors.golden, pupColors.white, pupColors.goldenDark]

/** Deterministic scatter: nth piece always lands identically. */
export function confettiPiece(index: number, total = FINALE_CONFETTI_COUNT): ConfettiPiece {
  void total
  return {
    leftPercent: 2 + ((index * 61) % 96),
    delaySeconds: (index % 7) * 0.35,
    durationSeconds: 2.6 + (index % 5) * 0.4,
    widthPx: 6 + (index % 4) * 2,
    heightPx: 10 + (index % 3) * 4,
    color: CONFETTI_PALETTE[index % CONFETTI_PALETTE.length],
  }
}

/**
 * Attendance rate per the standing-evaluation policy:
 * numerator = present + late; denominator = present + late + incomplete +
 * absent; excused rows leave the denominator (with the caveat shown), and
 * pending/disputed rows stay out of the rate entirely.
 */
export function finaleAttendancePercent(counts: Record<FinaleCountStatus, number>): number | null {
  const present = counts.present ?? 0
  const late = counts.late ?? 0
  const incomplete = counts.incomplete ?? 0
  const absent = counts.absent ?? 0
  const denominator = present + late + incomplete + absent
  if (denominator <= 0) return null
  return Math.round(((present + late) / denominator) * 100)
}

export interface KioskFinaleProps {
  summary: SessionFinaleSummary
  subjectName: string
  sectionLabel?: string
}

const COUNT_ROWS: Array<{ key: FinaleCountStatus; label: string; tone: string }> = [
  { key: 'present', label: 'Present', tone: 'text-maroon-dark' },
  { key: 'late', label: 'Late', tone: 'text-maroon' },
  { key: 'absent', label: 'Absent', tone: 'text-red-700' },
  { key: 'excused', label: 'Excused (E)', tone: 'text-maroon' },
  { key: 'incomplete', label: 'Incomplete (I)', tone: 'text-amber-700' },
  { key: 'disputed', label: 'Disputed', tone: 'text-zinc-500' },
  { key: 'pending', label: 'Pending', tone: 'text-zinc-500' },
]

export default function KioskFinale({ summary, subjectName, sectionLabel }: KioskFinaleProps) {
  const rate = finaleAttendancePercent(summary.counts)
  const rateLabel = rate === null ? '—' : `${rate}%`

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
      {/* Confetti (decorative, reduced-motion users get the static card only) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: FINALE_CONFETTI_COUNT }, (_, index) => {
          const piece = confettiPiece(index)
          return (
            <span
              key={index}
              className="absolute -top-16 rounded-[2px] animate-[kiosk-confetti-fall_2.6s_linear_infinite] motion-reduce:hidden"
              style={{
                left: `${piece.leftPercent}%`,
                width: piece.widthPx,
                height: piece.heightPx,
                backgroundColor: piece.color,
                animationDelay: `${piece.delaySeconds}s`,
                animationDuration: `${piece.durationSeconds}s`,
              }}
            />
          )
        })}
      </div>

      <section className="relative z-10 w-[92vw] max-w-2xl border-2 border-golden bg-white p-8 text-maroon-dark shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b-4 border-maroon pb-4">
          <div className="flex items-center gap-3">
            <Image src="/pup-logo.png" width={52} height={52} unoptimized alt="" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-maroon">
                Polytechnic University of the Philippines
              </p>
              <h2 className="font-heading text-2xl font-bold leading-tight text-maroon-dark">
                {subjectName}
                {sectionLabel ? <span className="text-lg font-normal"> · {sectionLabel}</span> : null}
              </h2>
            </div>
          </div>
          <span className="flex items-center gap-1.5 border border-maroon px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
            <Lock className="h-3 w-3" aria-hidden="true" /> Final
          </span>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COUNT_ROWS.map((row) => (
            <div key={row.key} data-testid="kiosk-finale-count" data-status={row.key} className="text-center">
              <p className={`text-3xl font-bold tabular-nums ${row.tone}`}>{summary.counts[row.key] ?? 0}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{row.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
          <p className="text-4xl font-bold tabular-nums text-maroon">
            {rateLabel}
            <span className="ml-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              attendance rate
            </span>
          </p>
          <p className="text-xs text-zinc-500">
            {summary.capacity} enrolled · ended{' '}
            <span className="tabular-nums">
              {new Date(summary.endedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-400">
          <PartyPopper className="h-3 w-3" aria-hidden="true" />
          The same records the registrar will audit — server-authoritative, hash-chained.
        </p>
      </section>
    </div>
  )
}
