'use client'

import { useEffect, useState } from 'react'
import {
  Archive,
  BadgeCheck,
  CloudDownload,
  Fingerprint,
  HeartHandshake,
  KeyRound,
  MessageSquareWarning,
  RefreshCw,
  ScanLine,
  WifiOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DISPUTE_RECOMMENDATION_LABELS,
  RECORD_TIMELINE_EVENT_KIND_LABELS,
} from '@polycheck/shared'
import type {
  DisputeRecommendation,
  RecordTimeline,
  RecordTimelineEvent,
  RecordTimelineEventKind,
} from '@polycheck/shared'
import { api } from '@/lib/api-client'

interface DisputeTimelineProps {
  recordId: string
  open: boolean
}

// Rails whose displayed timestamp is produced by a client device clock: the
// scan moment claimed by the phone, the device-side queue time, and the
// signed `issuedAt` minted by the teacher device. Server-clock rails
// (activation, network arrival, sync, dispute/decision stamps, audits) carry
// no provenance chip - the rail stays honest about where each second came from.
const CLIENT_SOURCED_KINDS: ReadonlySet<RecordTimelineEventKind> = new Set([
  'scan',
  'queue',
  'signature',
])

const KIND_ICONS: Record<RecordTimelineEventKind, LucideIcon> = {
  activation: KeyRound,
  scan: ScanLine,
  signature: Fingerprint,
  queue: Archive,
  network: WifiOff,
  sync: CloudDownload,
  dispute: MessageSquareWarning,
  decision: BadgeCheck,
  excuse: HeartHandshake,
}

const CHIP_TONES = {
  info: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-1 dark:ring-zinc-700',
  positive: 'bg-golden text-maroon-dark',
  warning:
    'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-1 dark:ring-amber-800/60',
  danger:
    'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 dark:ring-1 dark:ring-red-900/60',
} as const

type ChipTone = keyof typeof CHIP_TONES

const RECOMMENDATION_CHIP_STYLES: Record<DisputeRecommendation['verdict'], string> = {
  accept: 'bg-golden text-maroon-dark',
  review:
    'border border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  reject: 'bg-red-600 text-white',
}

function timeOfDay(iso: string) {
  const match = iso.match(/T(\d{2}:\d{2}:\d{2})/)
  return match ? match[1] : '—'
}

function isAnomalyEvent(event: RecordTimelineEvent) {
  return (
    event.detail?.mocked === true ||
    event.detail?.insideGeofence === false ||
    (event.kind === 'scan' && event.label.startsWith('Scan denied'))
  )
}

interface TimelineChip {
  text: string
  tone: ChipTone
}

function evidenceChips(event: RecordTimelineEvent): TimelineChip[] {
  const chips: TimelineChip[] = []
  const detail = event.detail

  if (event.kind === 'signature') {
    chips.push({ text: 'ED25519 signature verified', tone: 'positive' })
  }
  if (detail?.distanceMeters != null && detail.insideGeofence != null) {
    const meters = Math.round(detail.distanceMeters)
    chips.push(
      detail.insideGeofence
        ? { text: `${meters}m inside geofence`, tone: 'positive' }
        : { text: `${meters}m outside geofence`, tone: 'danger' },
    )
  }
  if (detail?.mocked) {
    chips.push({ text: 'Mocked GPS detected', tone: 'danger' })
  }
  if (detail?.pinVerified === true) {
    chips.push({ text: 'PIN verified', tone: 'positive' })
  } else if (detail?.pinVerified === false) {
    chips.push({ text: 'PIN not verified', tone: 'danger' })
  }
  if (event.kind === 'queue') {
    chips.push({ text: 'offline · queued', tone: 'warning' })
  }
  if (detail?.receiptId) {
    chips.push({ text: `Receipt ${detail.receiptId}`, tone: 'info' })
  }
  if (detail?.channel) {
    chips.push({ text: `Channel: ${detail.channel}`, tone: 'info' })
  }
  if (detail?.deviceIdMasked) {
    chips.push({ text: `Device ${detail.deviceIdMasked}`, tone: 'info' })
  }
  if (CLIENT_SOURCED_KINDS.has(event.kind)) {
    chips.push({ text: 'device clock (offset-corrected)', tone: 'info' })
  }
  return chips
}

export function DisputeTimeline({ recordId, open }: DisputeTimelineProps) {
  const [timeline, setTimeline] = useState<RecordTimeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getRecordTimeline(recordId)
      .then((data) => {
        if (!cancelled) setTimeline(data)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setTimeline(null)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to load the forensic timeline.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, recordId, attempt])

  if (!open) return null

  if (loading) {
    return (
      <div
        role="status"
        data-testid="timeline-loading"
        className="flex items-center gap-2 py-3 text-xs text-zinc-500 dark:text-zinc-400"
      >
        <span
          aria-hidden="true"
          data-testid="timeline-spinner"
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-maroon/20 border-t-maroon motion-reduce:animate-none dark:border-golden/25 dark:border-t-golden"
        />
        Building forensic timeline…
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        data-testid="timeline-error"
        className="rounded-none border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
      >
        <p className="text-xs font-semibold text-red-700 dark:text-red-300">
          {error}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-2 inline-flex items-center gap-1.5 border border-red-300 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-700 hover:bg-red-100 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry
        </button>
      </div>
    )
  }

  if (!timeline) return null

  const { events, recommendation } = timeline
  const verdictLabel = DISPUTE_RECOMMENDATION_LABELS[recommendation.verdict]

  return (
    <div data-testid="dispute-timeline-root" className="min-w-0">
      {/* Advisory recommendation - pinned above the rail, never binds a decision. */}
      <p
        data-testid="timeline-recommendation"
        className={`w-fit max-w-full rounded-none px-3 py-2 text-[11px] leading-snug tracking-wide break-words ${RECOMMENDATION_CHIP_STYLES[recommendation.verdict]}`}
      >
        <span className="font-bold uppercase">
          {`RECOMMENDATION: ${verdictLabel} ${recommendation.verdict === 'review' ? 'evidence' : 'dispute'}`}
        </span>{' '}
        <span className="font-medium">— {recommendation.rationale}</span>
      </p>
      <p className="mt-1.5 text-[10px] italic text-zinc-500 dark:text-zinc-400">
        Advisory only — the final decision stays with the teacher.
      </p>

      {events.length === 0 ? (
        <p className="py-4 text-xs text-zinc-500 dark:text-zinc-400">
          No forensic events were recorded for this attendance record.
        </p>
      ) : (
        <ol
          aria-label="Forensic timeline events, oldest first"
          className="mt-4 max-h-72 min-w-0 overflow-y-auto pr-1"
        >
          {events.map((event, index) => {
            const anomaly = isAnomalyEvent(event)
            const KindIcon = KIND_ICONS[event.kind]
            const chips = evidenceChips(event)
            return (
              <li
                key={`${event.at}-${event.kind}-${index}`}
                data-testid="timeline-event"
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                {index < events.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[5px] top-4 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700"
                  />
                )}
                <span
                  aria-hidden="true"
                  data-testid="timeline-node"
                  className={`relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    anomaly
                      ? 'bg-red-500'
                      : 'bg-golden ring-1 ring-maroon/20 dark:ring-golden/40'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <time
                      dateTime={event.at}
                      className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-200"
                    >
                      {timeOfDay(event.at)}
                    </time>
                    {anomaly ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
                        <KindIcon className="h-3 w-3" aria-hidden="true" />
                        {RECORD_TIMELINE_EVENT_KIND_LABELS[event.kind]}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                        <KindIcon className="h-3 w-3" aria-hidden="true" />
                        {RECORD_TIMELINE_EVENT_KIND_LABELS[event.kind]}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-0.5 min-w-0 text-xs break-words ${
                      anomaly
                        ? 'font-medium text-red-700 dark:text-red-300'
                        : 'text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {event.label}
                  </p>
                  {chips.length > 0 && (
                    <div className="mt-1.5 flex min-w-0 flex-wrap gap-1">
                      {chips.map((chip) => (
                        <span
                          key={chip.text}
                          className={`rounded-none px-1.5 py-0.5 text-[10px] font-semibold ${CHIP_TONES[chip.tone]}`}
                        >
                          {chip.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
