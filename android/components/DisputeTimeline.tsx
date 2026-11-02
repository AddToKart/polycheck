import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import type { DisputeRecommendation, RecordTimeline, RecordTimelineEvent } from '@polycheck/shared'
import { DISPUTE_RECOMMENDATION_LABELS, RECORD_TIMELINE_EVENT_KIND_LABELS } from '@polycheck/shared'
import { api } from '../services/api-client'
import { pupColors } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'

// ── Pure render model (unit-tested in __tests__/dispute-timeline.test.ts) ──

export type TimelineNodeTone = 'golden' | 'danger' | 'muted'
export type TimelineChipTone = 'golden' | 'success' | 'danger' | 'muted'
export type RecommendationTone = 'accept' | 'review' | 'reject'

export interface TimelineChip {
  key: string
  label: string
  tone: TimelineChipTone
}

export interface RecommendationChipModel {
  heading: string
  rationale: string
  tone: RecommendationTone
}

export type TimelineState =
  | { phase: 'loading' }
  | { phase: 'ready'; timeline: RecordTimeline }
  | { phase: 'error'; message: string }

const pad2 = (value: number): string => String(value).padStart(2, '0')

/**
 * `HH:MM:SS` wall-clock for one forensic event. DM Sans ships no mono cut, so
 * the rail renders the time in the project's bold sans token instead.
 */
export function formatTimelineClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

const eventTime = (event: RecordTimelineEvent): number => {
  const time = new Date(event.at).getTime()
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
}

/** The backend sorts and de-dupes, but the rail never trusts arrival order. */
export function orderTimelineEvents(events: RecordTimelineEvent[]): RecordTimelineEvent[] {
  return [...events].sort((a, b) => eventTime(a) - eventTime(b) || a.kind.localeCompare(b.kind))
}

/** Golden for verified events, red for anomaly evidence, zinc for pipeline noise. */
export function timelineNodeTone(event: RecordTimelineEvent): TimelineNodeTone {
  if (event.detail?.mocked === true || event.detail?.insideGeofence === false) return 'danger'
  if (event.kind === 'queue' || event.kind === 'network' || event.kind === 'sync') return 'muted'
  return 'golden'
}

export function timelineEvidenceChips(event: RecordTimelineEvent): TimelineChip[] {
  const chips: TimelineChip[] = []
  const detail = event.detail
  if (detail?.mocked === true) {
    chips.push({ key: 'mocked', label: 'Mocked GPS reported', tone: 'danger' })
  }
  if (detail?.insideGeofence === true) {
    chips.push({ key: 'inside', label: 'Inside geofence', tone: 'success' })
  } else if (detail?.insideGeofence === false) {
    chips.push({ key: 'outside', label: 'Outside geofence', tone: 'danger' })
  }
  if (typeof detail?.distanceMeters === 'number') {
    const radius = typeof detail.radiusMeters === 'number' ? ` · ${Math.round(detail.radiusMeters)} m radius` : ''
    chips.push({ key: 'distance', label: `${Math.round(detail.distanceMeters)} m from room${radius}`, tone: 'muted' })
  }
  if (event.kind === 'signature') {
    chips.push({ key: 'signature', label: 'ED25519 signature verified', tone: 'golden' })
  }
  if (detail?.pinVerified === true) {
    chips.push({ key: 'pin', label: 'Meeting PIN verified', tone: 'golden' })
  }
  if (event.kind === 'queue') {
    chips.push({ key: 'offline', label: 'Offline · queued', tone: 'muted' })
  }
  if (typeof detail?.receiptId === 'string' && detail.receiptId) {
    chips.push({ key: 'receipt', label: `Receipt ${detail.receiptId}`, tone: 'muted' })
  }
  if (typeof detail?.channel === 'string' && detail.channel) {
    chips.push({ key: 'channel', label: `Channel: ${detail.channel}`, tone: 'muted' })
  }
  if (typeof detail?.deviceIdMasked === 'string' && detail.deviceIdMasked) {
    chips.push({ key: 'device', label: `Device ${detail.deviceIdMasked}`, tone: 'muted' })
  }
  if (event.kind === 'scan') {
    chips.push({ key: 'clock', label: 'Device clock · offset-corrected', tone: 'muted' })
  }
  return chips
}

export function recommendationChip(recommendation: DisputeRecommendation): RecommendationChipModel {
  const verdictLabel = DISPUTE_RECOMMENDATION_LABELS[recommendation.verdict]
  return {
    heading: `RECOMMENDATION: ${verdictLabel.toUpperCase()} DISPUTE`,
    rationale: recommendation.rationale,
    tone: recommendation.verdict,
  }
}

export function timelineErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Unable to load the forensic timeline. Check your connection and try again.'
}

/** Fetch → state shaping, split out so the retry path is unit-testable. */
export async function loadTimelineState(
  recordId: string,
  fetcher: (id: string) => Promise<RecordTimeline>,
): Promise<TimelineState> {
  try {
    return { phase: 'ready', timeline: await fetcher(recordId) }
  } catch (error) {
    return { phase: 'error', message: timelineErrorMessage(error) }
  }
}

// ── Token-styled variant maps ──

export const TIMELINE_NODE_TONE_CLASSES: Record<TimelineNodeTone, string> = {
  golden: 'bg-golden',
  danger: 'bg-red-500',
  muted: 'bg-zinc-400 dark:bg-zinc-600',
}

export const TIMELINE_CHIP_TONE_CLASSES: Record<TimelineChipTone, string> = {
  golden: 'border-golden/60 bg-golden/15',
  success: 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950',
  danger: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950',
  muted: 'border-line bg-zinc-100 dark:border-line-dark dark:bg-white/5',
}

export const TIMELINE_CHIP_TEXT_TONE_CLASSES: Record<TimelineChipTone, string> = {
  golden: 'text-maroon dark:text-golden',
  success: 'text-emerald-800 dark:text-emerald-300',
  danger: 'text-red-800 dark:text-red-300',
  muted: 'text-muted dark:text-zinc-300',
}

export const RECOMMENDATION_TONE_CLASSES: Record<RecommendationTone, string> = {
  accept: 'border-golden bg-maroon dark:bg-golden',
  review: 'border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-950',
  reject: 'border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-950',
}

export const RECOMMENDATION_TEXT_TONE_CLASSES: Record<RecommendationTone, string> = {
  accept: 'text-golden dark:text-maroon-dark',
  review: 'text-amber-900 dark:text-amber-200',
  reject: 'text-red-800 dark:text-red-200',
}

const RECOMMENDATION_ICONS: Record<RecommendationTone, keyof typeof MaterialIcons.glyphMap> = {
  accept: 'verified',
  review: 'fact-check',
  reject: 'block',
}

// ── Component ──

export function DisputeTimeline({ recordId }: { recordId: string }) {
  const { isDark } = useTheme()
  const [state, setState] = useState<TimelineState>({ phase: 'loading' })
  const attemptRef = useRef(0)

  const load = useCallback(() => {
    const attempt = ++attemptRef.current
    setState({ phase: 'loading' })
    void loadTimelineState(recordId, (id) => api.getRecordTimeline(id)).then((next) => {
      if (attemptRef.current === attempt) setState(next)
    })
  }, [recordId])

  useEffect(() => {
    load()
  }, [load])

  if (state.phase === 'loading') {
    return (
      <View accessibilityLiveRegion="polite" className="items-center gap-2 py-6" testID="dispute-timeline">
        <ActivityIndicator size="small" color={isDark ? pupColors.golden : pupColors.maroon} />
        <Text className="font-sans text-xs text-muted dark:text-zinc-400">Loading forensic timeline…</Text>
      </View>
    )
  }

  if (state.phase === 'error') {
    return (
      <View accessibilityLiveRegion="polite" className="gap-2 py-3" testID="dispute-timeline">
        <Text className="font-sans text-xs leading-5 text-red-800 dark:text-red-300">{state.message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry forensic timeline"
          onPress={load}
          className="min-h-11 items-center justify-center self-start rounded-xl border border-line bg-white px-4 dark:border-line-dark dark:bg-surface-dark"
        >
          <Text className="font-sans-bold text-xs text-maroon dark:text-golden">Retry</Text>
        </Pressable>
      </View>
    )
  }

  const events = orderTimelineEvents(state.timeline.events)
  const chip = recommendationChip(state.timeline.recommendation)
  const chipIconColor = chip.tone === 'accept'
    ? isDark ? pupColors.maroonDark : pupColors.golden
    : chip.tone === 'review' ? pupColors.warning : pupColors.danger

  return (
    <View className="gap-4 py-1" testID="dispute-timeline">
      <View
        testID="dispute-recommendation"
        className={`rounded-2xl border p-4 ${RECOMMENDATION_TONE_CLASSES[chip.tone]}`}
      >
        <View className="flex-row items-center gap-2">
          <MaterialIcons name={RECOMMENDATION_ICONS[chip.tone]} size={18} color={chipIconColor} />
          <Text className={`flex-1 font-sans-bold text-[11px] uppercase tracking-[1.2px] ${RECOMMENDATION_TEXT_TONE_CLASSES[chip.tone]}`}>{chip.heading}</Text>
        </View>
        <Text className={`mt-1.5 font-sans text-xs leading-5 ${RECOMMENDATION_TEXT_TONE_CLASSES[chip.tone]}`}>{chip.rationale}</Text>
        <Text className={`mt-2 font-sans-bold text-[9px] uppercase tracking-[1.2px] opacity-70 ${RECOMMENDATION_TEXT_TONE_CLASSES[chip.tone]}`}>Advisory only · the decision remains with you</Text>
      </View>

      {events.length === 0 ? (
        <Text className="py-2 font-sans text-xs text-muted dark:text-zinc-400">No forensic events recorded for this attendance record yet.</Text>
      ) : (
        <View>
          {events.map((event, index) => {
            const tone = timelineNodeTone(event)
            const chips = timelineEvidenceChips(event)
            const last = index === events.length - 1
            return (
              <View key={`${event.kind}-${event.at}-${index}`} className="flex-row gap-3">
                <View className="items-center">
                  <View className={`mt-1 h-3 w-3 rounded-full ${TIMELINE_NODE_TONE_CLASSES[tone]}`} />
                  {last ? null : <View className="w-0.5 flex-1 bg-line dark:bg-line-dark" />}
                </View>
                <View className={`flex-1 ${last ? 'pb-1' : 'pb-4'}`}>
                  <View className="flex-row flex-wrap items-baseline gap-2">
                    <Text className="font-sans-bold text-xs text-ink dark:text-white">{formatTimelineClock(event.at)}</Text>
                    <Text className="font-sans-bold text-[10px] uppercase tracking-[1px] text-maroon dark:text-golden">
                      {RECORD_TIMELINE_EVENT_KIND_LABELS[event.kind]}
                    </Text>
                  </View>
                  <Text className="mt-1 font-sans text-xs leading-5 text-muted dark:text-zinc-300">{event.label}</Text>
                  {chips.length ? (
                    <View className="mt-2 flex-row flex-wrap gap-1.5">
                      {chips.map((item) => (
                        <View key={item.key} className={`rounded-full border px-2 py-0.5 ${TIMELINE_CHIP_TONE_CLASSES[item.tone]}`}>
                          <Text className={`font-sans-semibold text-[10px] leading-4 ${TIMELINE_CHIP_TEXT_TONE_CLASSES[item.tone]}`}>{item.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
