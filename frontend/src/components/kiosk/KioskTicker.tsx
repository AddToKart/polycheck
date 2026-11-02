'use client'

/**
 * F1 projector kiosk — the live check-in ticker.
 *
 * Chips spring in from the right (`kiosk-ticker-in`), stay ≤ 5 visible and
 * expire after 12 s. The polygons below (`addTickerEntry`, `pruneTicker`,
 * `formatTickerTime`) are pure so the kiosk test can cover add/expiry math
 * without the DOM.
 */

export interface KioskTickerEntry {
  id: string
  name: string
  time: string
  late: boolean
  addedAt: number
}

export const TICKER_MAX_VISIBLE = 5
export const TICKER_TTL_MS = 12_000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local `HH:MM:SS` from an ISO timestamp; unparseable input renders as dashes. */
export function formatTickerTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—:—:—'
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export interface TickerEventInput {
  recordId: string
  studentName?: string
  status: string
  timestamp: string
}

/** Prepends a check-in as the newest chip; duplicates (re-broadcasts) no-op. */
export function addTickerEntry(
  entries: KioskTickerEntry[],
  event: TickerEventInput,
  nowMs: number,
): KioskTickerEntry[] {
  if (!event.recordId) return entries
  if (entries.some((entry) => entry.id === event.recordId)) return entries
  const latest: KioskTickerEntry = {
    id: event.recordId,
    name: event.studentName?.trim() || 'A student',
    time: formatTickerTime(event.timestamp),
    late: event.status === 'late',
    addedAt: nowMs,
  }
  return [latest, ...entries]
}

/** Drops chips older than the TTL and caps the visible list. */
export function pruneTicker(entries: KioskTickerEntry[], nowMs: number): KioskTickerEntry[] {
  return entries
    .filter((entry) => nowMs - entry.addedAt <= TICKER_TTL_MS)
    .slice(0, TICKER_MAX_VISIBLE)
}

export interface KioskTickerProps {
  entries: KioskTickerEntry[]
}

export default function KioskTicker({ entries }: KioskTickerProps) {
  const latest = entries[0]
  return (
    <div className="relative">
      {/* Polite live region summarizes the feed without reading every chip. */}
      <p aria-live="polite" className="sr-only">
        {latest
          ? `${entries.length} recent check-in${entries.length === 1 ? '' : 's'} — latest: ${latest.name} at ${latest.time}${latest.late ? ' (late)' : ''}`
          : 'Waiting for the first check-in'}
      </p>
      <ul aria-hidden="true" className="flex flex-row-reverse justify-end items-center gap-2 overflow-hidden py-1">
        {entries.length === 0 ? (
          <li className="text-xs font-semibold uppercase tracking-widest text-zinc-300">
            Waiting for the first check-in…
          </li>
        ) : (
          entries.map((entry) => (
            <li
              key={entry.id}
              data-testid="kiosk-ticker-chip"
              data-late={entry.late ? 'true' : 'false'}
              className={`flex shrink-0 animate-[kiosk-ticker-in_0.45s_cubic-bezier(0.16,1,0.3,1)_both] items-center gap-1.5 border px-3 py-1.5 text-xs motion-reduce:animate-none ${
                entry.late ? 'border-amber-300/80 bg-amber-400/10 text-amber-100' : 'border-zinc-500/40 bg-white/10 text-white'
              }`}
            >
              <span className={`font-bold ${entry.late ? 'text-amber-200' : 'text-golden'}`}>✓</span>
              <span className="font-semibold">{entry.name}</span>
              <span className="text-zinc-300 tabular-nums">· {entry.time}</span>
              {entry.late ? (
                <span className="border border-amber-200/70 bg-maroon px-1 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                  Late
                </span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
