import { formatCampusDate, type Session } from '@polycheck/shared'

export type SessionSort = '' | 'oldest' | 'upcoming' | 'subject'

export const SESSION_SORT_OPTIONS: ReadonlyArray<{ value: SessionSort; label: string }> = [
  { value: '', label: 'Newest date first' },
  { value: 'oldest', label: 'Oldest date first' },
  { value: 'upcoming', label: 'Next class first' },
  { value: 'subject', label: 'Subject (A to Z)' },
]

type Sortable = Pick<Session, 'date' | 'startTime' | 'subjectName' | 'sectionId'>

const byWhen = (left: Sortable, right: Sortable) =>
  left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime)

/** Returns a sorted copy. "Next class first" lists today onwards, then past classes, latest first. */
export function sortSessions<T extends Sortable>(
  sessions: readonly T[],
  sort: string,
  today = formatCampusDate(),
): T[] {
  const copy = [...sessions]
  if (sort === 'oldest') return copy.sort(byWhen)
  if (sort === 'subject') {
    return copy.sort(
      (left, right) =>
        left.subjectName.localeCompare(right.subjectName) ||
        left.sectionId.localeCompare(right.sectionId) ||
        byWhen(right, left),
    )
  }
  if (sort === 'upcoming') {
    return copy.sort((left, right) => {
      const leftPast = left.date < today
      if (leftPast !== right.date < today) return leftPast ? 1 : -1
      return leftPast ? byWhen(right, left) : byWhen(left, right)
    })
  }
  return copy.sort((left, right) => byWhen(right, left))
}

/** A class can be moved until it has been started. */
export function canReschedule(
  session: Pick<Session, 'isActive' | 'endedAt' | 'qrToken' | 'startQrToken' | 'endQrToken' | 'autoEndAt'>,
): boolean {
  return !(
    session.isActive ||
    session.endedAt ||
    session.qrToken ||
    session.startQrToken ||
    session.endQrToken ||
    session.autoEndAt
  )
}
