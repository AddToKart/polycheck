const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Minutes between two `HH:mm` strings; negative when end < start. */
export function sessionDurationMinutes(startTime: string, endTime: string): number {
  const start = TIME_PATTERN.exec(startTime)
  const end = TIME_PATTERN.exec(endTime)
  if (!start || !end) return 0
  const startMinutes = Number(start[1]) * 60 + Number(start[2])
  const endMinutes = Number(end[1]) * 60 + Number(end[2])
  return endMinutes - startMinutes
}
