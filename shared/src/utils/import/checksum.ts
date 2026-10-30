/**
 * Deterministic 16-hex-character checksum used to bind an import execute
 * request to the exact row set that was validated. Order-independent so a
 * re-sorted export produces the same fingerprint.
 */
export function computeRowChecksum(rows: Array<Record<string, unknown>>): string {
  const canonical = rows
    .map((row) => {
      const entries = Object.entries(row)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([left], [right]) => left.localeCompare(right))
      return JSON.stringify(entries)
    })
    .sort()
    .join('\n')

  let first = 0x811c9dc5
  let second = 5381
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index)
    first ^= code
    first = Math.imul(first, 0x01000193)
    second = Math.imul(second, 33) ^ code
  }
  return `${hex32(first)}${hex32(second)}`
}

function hex32(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0')
}
