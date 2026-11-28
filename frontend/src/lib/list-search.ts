/** True when every word typed appears in at least one of the fields, in any order. */
export function matchesQuery(query: string, fields: ReadonlyArray<string | null | undefined>): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = fields.filter(Boolean).join(' ').toLowerCase()
  return words.every((word) => haystack.includes(word))
}
