/** Limits for a class meeting's time window, enforced by the server and both apps. */
export const SESSION_MIN_DURATION_MINUTES = 15
export const SESSION_MAX_DURATION_MINUTES = 12 * 60
export const SESSION_ROOM_MAX_LENGTH = 100

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/

const minutesOfDay = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))

/** What is wrong with a start/end pair, in words people can act on, or null when it is fine. */
export function sessionTimeIssue(startTime: string, endTime: string): string | null {
  if (!TIME_OF_DAY.test(startTime) || !TIME_OF_DAY.test(endTime)) {
    return 'Enter both times as HH:mm, for example 09:00.'
  }
  const length = minutesOfDay(endTime) - minutesOfDay(startTime)
  if (length <= 0) return 'End time must be after start time.'
  if (length < SESSION_MIN_DURATION_MINUTES) {
    return `A class must be at least ${SESSION_MIN_DURATION_MINUTES} minutes long.`
  }
  if (length > SESSION_MAX_DURATION_MINUTES) {
    return `A class can be at most ${SESSION_MAX_DURATION_MINUTES / 60} hours long.`
  }
  return null
}
