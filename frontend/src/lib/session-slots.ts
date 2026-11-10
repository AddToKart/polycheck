import { formatCampusDate, type BulkSessionSlot } from '@polycheck/shared'

/**
 * Slot helpers for the create-session form.
 *
 * A section's schedule normally contains one entry per class meeting
 * (e.g. Mon 08:00–10:30 + Wed 09:00–12:30). The single-session form must let
 * the teacher pick which meeting they are creating, and bulk creation must
 * sweep each meeting's weekday with that meeting's own times instead of
 * stamping one global pair on every selected day.
 */

export interface SessionSlot {
  day: string
  startTime: string
  endTime: string
  room?: string
}

export interface BulkSlotRow extends SessionSlot {
  selected: boolean
}

/** Select value that means "the chosen date is not a scheduled class day". */
export const CUSTOM_SLOT_VALUE = 'custom'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const pad = (value: number): string => String(value).padStart(2, '0')

const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * Parses a `YYYY-MM-DD` civil date into a local Date pinned at noon, which
 * keeps day arithmetic stable across DST transitions. Returns null for
 * malformed and overflow dates (e.g. `2026-02-31`).
 */
export function parseCampusDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr?.trim() ?? '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null
  }
  return parsed
}

/** Short weekday code (`Mon` … `Sun`) for a campus date string. */
export function dayOfWeek(dateStr: string): string | null {
  const parsed = parseCampusDate(dateStr)
  return parsed ? (DAY_NAMES[parsed.getDay()] ?? null) : null
}

/**
 * Next date on or after `fromDateStr` whose weekday matches `day`.
 *
 * Today is returned when it already matches; otherwise the next upcoming
 * instance is returned (wrapping across week, month, and year boundaries).
 */
export function nextOccurrenceDate(
  day: string,
  fromDateStr: string = formatCampusDate(),
): string {
  const target = DAY_INDEX[day]
  if (target === undefined) return fromDateStr
  const start = parseCampusDate(fromDateStr)
  if (!start) return fromDateStr
  start.setDate(start.getDate() + ((target - start.getDay() + 7) % 7))
  return formatLocalDate(start)
}

/** `Mon 08:00–10:30 (CCIS Lab 3)`; the room is omitted when absent. */
export function slotLabel(slot: SessionSlot): string {
  const room = slot.room?.trim()
  const base = `${slot.day} ${slot.startTime}–${slot.endTime}`
  return room ? `${base} (${room})` : base
}

/** Index of the schedule entry matching the date's weekday, or -1. */
export function slotMatchingDateIndex(
  schedule: ReadonlyArray<Pick<SessionSlot, 'day'>>,
  dateStr: string,
): number {
  const weekday = dayOfWeek(dateStr)
  if (!weekday) return -1
  return schedule.findIndex((slot) => slot.day === weekday)
}

/**
 * Initial selection when a section is chosen: the slot matching the current
 * date's weekday, else the first slot (the pre-slot-selector behavior), and
 * the neutral custom option only when there is no schedule at all.
 */
export function defaultSlotSelection(
  schedule: ReadonlyArray<Pick<SessionSlot, 'day'>>,
  dateStr: string,
): string {
  const index = slotMatchingDateIndex(schedule, dateStr)
  if (index >= 0) return String(index)
  return schedule.length > 0 ? '0' : CUSTOM_SLOT_VALUE
}

/**
 * Selection that truthfully represents a date: the matching slot when the
 * weekday is scheduled, otherwise the custom option (make-up class).
 */
export function slotSelectionForDate(
  schedule: ReadonlyArray<Pick<SessionSlot, 'day'>>,
  dateStr: string,
): string {
  const index = slotMatchingDateIndex(schedule, dateStr)
  return index >= 0 ? String(index) : CUSTOM_SLOT_VALUE
}

/** Bulk-mode rows derived from the section schedule, all selected by default. */
export function buildBulkRows(
  schedule: ReadonlyArray<SessionSlot>,
  fallbackRoom?: string,
): BulkSlotRow[] {
  const defaultRoom = fallbackRoom?.trim() || undefined
  return schedule.map((slot) => {
    const room = slot.room?.trim() || defaultRoom
    return {
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      ...(room ? { room } : {}),
      selected: true,
    }
  })
}

/**
 * Total sessions that will be created: each selected meeting contributes one
 * occurrence per matching weekday inside the inclusive date range.
 */
export function countSlotOccurrences(
  rows: ReadonlyArray<Pick<BulkSlotRow, 'day' | 'selected'>>,
  startDate: string,
  endDate: string,
): number {
  const start = parseCampusDate(startDate)
  const end = parseCampusDate(endDate)
  if (!start || !end || end.getTime() < start.getTime()) return 0

  let count = 0
  for (const row of rows) {
    if (!row.selected) continue
    const target = DAY_INDEX[row.day]
    if (target === undefined) continue
    const cursor = new Date(start)
    cursor.setDate(cursor.getDate() + ((target - cursor.getDay() + 7) % 7))
    while (cursor.getTime() <= end.getTime()) {
      count += 1
      cursor.setDate(cursor.getDate() + 7)
    }
  }
  return count
}

/** First selected row whose end time is not after its start time. */
export function firstInvalidSlotRow(
  rows: ReadonlyArray<BulkSlotRow>,
): BulkSlotRow | null {
  return (
    rows.find(
      (row) =>
        row.selected &&
        (!row.startTime || !row.endTime || row.endTime <= row.startTime),
    ) ?? null
  )
}

/** Payload shape for `BulkSessionInput.slots` (selected rows only). */
export function buildBulkSlots(rows: ReadonlyArray<BulkSlotRow>): BulkSessionSlot[] {
  return rows
    .filter((row) => row.selected)
    .map(({ day, startTime, endTime }) => ({ day, startTime, endTime }))
}
