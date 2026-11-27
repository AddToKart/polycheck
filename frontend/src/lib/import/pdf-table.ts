import { suggestColumnMapping } from '@polycheck/shared'

/**
 * Turns the positioned text of a text-based PDF master list into `{ headers, rows }`.
 *
 * Pure layout logic (no PDF engine), so every heuristic is unit-testable. The anchor is the student
 * number (`2024-00001-MN-0`): a very strong signal that a line starts a record. Columns come from the x
 * positions of the header row; lines without a student number that sit right under a record are wrapped
 * continuations (long names) and are merged into it.
 */

export interface PdfTextItem {
  str: string
  /** Left edge in PDF units. */
  x: number
  /** Baseline in PDF units (larger = higher on the page). */
  y: number
  /** Rendered width in PDF units. */
  width: number
}

export interface PdfPage {
  items: PdfTextItem[]
}

export interface PdfTable {
  headers: string[]
  rows: string[][]
  headerRecognized: boolean
  warnings: string[]
}

const STUDENT_NUMBER = /\b\d{4}-\d{5}-[A-Za-z]{2}-\d\b/
/** Vertical distance (PDF units) within which two items count as the same line. */
const LINE_TOLERANCE = 3
/** Items closer than this belong to the same cell; further apart start a new column fragment. */
const CELL_GAP = 4
/** Text runs closer than this are parts of one word (an email split at the "@", a name split at an accent). */
const WORD_GAP = 1
/** How far left of a column's header a fragment may start and still belong to it. */
const COLUMN_TOLERANCE = 6

interface Fragment {
  text: string
  /** The last text run ended with a space of its own. */
  openSpace: boolean
  x: number
  /** Right edge, grown as adjacent items merge into the fragment. */
  right: number
}
interface Line {
  y: number
  fragments: Fragment[]
  pageIndex: number
}

const compact = (value: string) => value.replace(/\s+/g, ' ').trim()

/** Group a page's items into visual lines, each split into cell fragments. */
export function linesFromPage(page: PdfPage, pageIndex: number): Line[] {
  const items = page.items.filter((item) => compact(item.str) !== '')
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)

  const groups: PdfTextItem[][] = []
  for (const item of sorted) {
    const current = groups[groups.length - 1]
    if (current && Math.abs(current[0].y - item.y) <= LINE_TOLERANCE) current.push(item)
    else groups.push([item])
  }

  return groups.map((group) => {
    const ordered = [...group].sort((a, b) => a.x - b.x)
    const fragments: Fragment[] = []
    for (const item of ordered) {
      const last = fragments[fragments.length - 1]
      if (last && item.x - last.right < CELL_GAP) {
        const sameWord = item.x - last.right < WORD_GAP && !last.openSpace && !/^\s/.test(item.str)
        last.text = compact(`${last.text}${sameWord ? '' : ' '}${item.str}`)
        last.openSpace = /\s$/.test(item.str)
        last.right = Math.max(last.right, item.x + item.width)
      } else {
        fragments.push({
          text: compact(item.str),
          openSpace: /\s$/.test(item.str),
          x: item.x,
          right: item.x + item.width,
        })
      }
    }
    return { y: group[0].y, fragments, pageIndex }
  })
}

const NOISE = [
  /^page\s*\d+(\s*(of|\/)\s*\d+)?$/i,
  /^\d+\s*\/\s*\d+$/,
  /^-\s*\d+\s*-$/,
  /^printed\b/i,
  /^date\s*(printed|generated)\b/i,
]
const FOOTER = /^(prepared|checked|noted|approved|certified|verified|reviewed|total\b|instructor|adviser|registrar|signature|page\b)/i

function lineText(line: Line): string {
  return compact(line.fragments.map((fragment) => fragment.text).join(' '))
}

const isNoise = (line: Line) => NOISE.some((pattern) => pattern.test(lineText(line)))
const hasStudentNumber = (line: Line) => line.fragments.some((fragment) => STUDENT_NUMBER.test(fragment.text))

/** How many import fields a line's fragments would map onto: the header line maps the most. */
function headerScore(line: Line): number {
  return Object.keys(suggestColumnMapping(line.fragments.map((fragment) => fragment.text))).length
}

function columnIndex(columns: number[], x: number): number {
  let index = 0
  for (let column = 0; column < columns.length; column += 1) {
    if (columns[column] <= x + COLUMN_TOLERANCE) index = column
  }
  return index
}

export function tableFromPdfPages(pages: PdfPage[]): PdfTable {
  const lines = pages.flatMap((page, index) => linesFromPage(page, index)).filter((line) => !isNoise(line))
  const warnings: string[] = []

  const headerLine = lines.find((line) => !hasStudentNumber(line) && headerScore(line) >= 2)
  const headerRecognized = headerLine !== undefined

  let headers: string[]
  let columns: number[]
  if (headerLine) {
    headers = headerLine.fragments.map((fragment) => fragment.text)
    columns = headerLine.fragments.map((fragment) => fragment.x)
  } else {
    // No header row: anchor on the first record's fragment positions and let the admin map the columns.
    const firstRecord = lines.find(hasStudentNumber)
    if (!firstRecord) return { headers: [], rows: [], headerRecognized: false, warnings }
    headers = firstRecord.fragments.map((_, index) => `Column ${index + 1}`)
    columns = firstRecord.fragments.map((fragment) => fragment.x)
    warnings.push('No header row was recognised in the PDF, so the columns are unnamed. Map them carefully.')
  }
  const headerKey = headerLine ? lineText(headerLine).toLowerCase() : null

  const rows: string[][] = []
  let current: string[] | null = null
  let lastY: number | null = null
  let lastPage = -1
  const gaps: number[] = []

  const place = (cells: string[], line: Line) => {
    for (const fragment of line.fragments) {
      const index = columnIndex(columns, fragment.x)
      cells[index] = compact(`${cells[index] ?? ''} ${fragment.text}`)
    }
  }

  for (const line of lines) {
    if (headerLine && line === headerLine) continue
    if (headerKey && lineText(line).toLowerCase() === headerKey) continue // header repeated on later pages

    if (hasStudentNumber(line)) {
      const cells = headers.map(() => '')
      place(cells, line)
      rows.push(cells)
      if (current && lastY !== null && lastPage === line.pageIndex) gaps.push(Math.abs(lastY - line.y))
      current = cells
      lastY = line.y
      lastPage = line.pageIndex
      continue
    }

    // A wrapped continuation sits directly under its record, on the same page, and is narrower than a full row.
    if (!current || lastY === null || lastPage !== line.pageIndex) {
      current = null
      continue
    }
    const text = lineText(line)
    const typicalGap = gaps.length > 0 ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 14
    const closeEnough = Math.abs(lastY - line.y) <= typicalGap * 1.6
    if (FOOTER.test(text) || !closeEnough || line.fragments.length > headers.length) {
      current = null
      continue
    }
    place(current, line)
    lastY = line.y
  }

  return { headers, rows, headerRecognized, warnings }
}
