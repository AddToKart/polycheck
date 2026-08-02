const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  return date
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null
}
