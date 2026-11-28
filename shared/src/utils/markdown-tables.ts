/**
 * Wide tables are unreadable in a phone-sized chat: every column shrinks to a few letters. The assistant
 * is told not to send them, and both apps turn any that still arrive into a list, one entry per row.
 * Mirrored in `polycheck_mobile/lib/src/core/utils/markdown_tables.dart`.
 */
export function flattenMarkdownTables(markdown: string): string {
  const lines = markdown.split('\n')
  const out: string[] = []
  let fenced = false
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    if (fenced || !isRow(line) || !isDivider(lines[index + 1])) {
      out.push(line)
      continue
    }
    const headers = cells(line)
    const rows: string[][] = []
    let next = index + 2
    while (next < lines.length && isRow(lines[next])) {
      rows.push(cells(lines[next]))
      next += 1
    }
    if (out.length && out[out.length - 1].trim()) out.push('')
    if (rows.length === 0) out.push(headers.filter(Boolean).join(' · '))
    for (const row of rows) out.push(entry(headers, row))
    if (next < lines.length && lines[next].trim()) out.push('')
    index = next - 1
  }
  return out.join('\n')
}

const EMPTY = new Set(['', '-', '–', '—'])

function entry(headers: string[], row: string[]): string {
  const title = plain(row[0] ?? '') || '(blank)'
  const details = headers
    .slice(1)
    .map((header, column) => ({ header: plain(header), value: row[column + 1] ?? '' }))
    .filter(({ value }) => !EMPTY.has(value))
  if (details.length === 0) return `- **${title}**`
  // A two-column table is a list of names and values.
  if (headers.length === 2) return `- **${title}**: ${details[0].value}`
  const facts = details.map(({ header, value }) => (header ? `${header}: ${value}` : value)).join(' · ')
  // Two trailing spaces start a new line inside the same list item.
  return `- **${title}**  \n  ${facts}`
}

/** Bold markers would break the bold title they are placed in. */
const plain = (value: string) => value.replace(/\*\*|__/g, '')

/** A table row has at least one column separator; the outer pipes are optional. */
function isRow(line: string | undefined): boolean {
  return line !== undefined && /(?<!\\)\|/.test(line)
}

function isDivider(line: string | undefined): boolean {
  return isRow(line) && cells(line as string).every((cell) => /^:?-+:?$/.test(cell))
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim())
}
