import { IMPORT_MAX_ROWS, suggestColumnMapping } from '@polycheck/shared'

/**
 * Browser-side master-list reader for Excel files. Runs entirely in the admin's
 * browser (no server CPU, no student data leaves the page) and produces the same
 * `{ headers, rows }` shape the CSV parser does, so the existing
 * map → validate → confirm → report steps are unchanged.
 */

export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024
/** How many leading rows are searched for the real header (PUP lists start with title lines). */
const HEADER_SEARCH_ROWS = 25

export type SpreadsheetErrorCode =
  | 'too_large'
  | 'legacy_xls'
  | 'not_xlsx'
  | 'not_pdf'
  | 'too_many_pages'
  | 'scanned'
  | 'empty'
  | 'unreadable'

export class SpreadsheetParseError extends Error {
  constructor(
    readonly code: SpreadsheetErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SpreadsheetParseError'
  }
}

export type CellInput = string | number | boolean | Date | null | undefined

export interface SpreadsheetSheet {
  name: string
  /** Non-empty rows in the sheet (including the header row). */
  rowCount: number
}

export interface ParsedSpreadsheet {
  sheets: SpreadsheetSheet[]
  sheetName: string
  headers: string[]
  rows: string[][]
  /** Zero-based index (within the sheet) of the row used as the header. */
  headerRowIndex: number
  errors: string[]
}

export type SpreadsheetKind = 'xlsx' | 'xls' | 'unknown'

/** Magic-byte check: the extension and MIME type of an upload are not evidence of its content. */
export function detectSpreadsheetKind(bytes: Uint8Array): SpreadsheetKind {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'xlsx'
  }
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return 'xls'
  }
  return 'unknown'
}

/** Coerce one cell to the text the import pipeline expects. */
export function cellToText(value: CellInput): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  return value.replace(/\s+/g, ' ').trim()
}

const isBlank = (row: string[]) => row.every((cell) => cell === '')

/** How many import fields a row's cells would map onto: the header row maps the most. */
function headerScore(row: string[]): number {
  return Object.keys(suggestColumnMapping(row)).length
}

export interface MatrixTable {
  headers: string[]
  rows: string[][]
  headerRowIndex: number
}

/**
 * Turn a raw cell matrix into `{ headers, rows }`. The header is the leading row
 * (within the first {@link HEADER_SEARCH_ROWS}) whose cells map onto the most
 * import fields, so title lines such as "Republic of the Philippines" or
 * "Master list — BSIT 3-1" above the table are skipped.
 */
export function tableFromMatrix(matrix: CellInput[][]): MatrixTable {
  const text = matrix.map((row) => row.map(cellToText))
  const candidates = text.slice(0, HEADER_SEARCH_ROWS)

  let headerRowIndex = -1
  let bestScore = 0
  candidates.forEach((row, index) => {
    const score = headerScore(row)
    if (score > bestScore) {
      bestScore = score
      headerRowIndex = index
    }
  })
  if (bestScore < 2) {
    // No recognizable header: fall back to the first row that looks like a table header.
    headerRowIndex = candidates.findIndex((row) => row.filter((cell) => cell !== '').length >= 2)
    if (headerRowIndex === -1) headerRowIndex = candidates.findIndex((row) => !isBlank(row))
  }
  if (headerRowIndex === -1) return { headers: [], rows: [], headerRowIndex: -1 }

  const rawHeaders = text[headerRowIndex]
  // Drop trailing empty header columns (Excel pads sheets with blank cells).
  let width = rawHeaders.length
  while (width > 0 && rawHeaders[width - 1] === '') width -= 1
  const headers = rawHeaders.slice(0, width)

  const rows = text
    .slice(headerRowIndex + 1)
    .filter((row) => !isBlank(row))
    .map((row) => Array.from({ length: width }, (_, column) => row[column] ?? ''))
  return { headers, rows, headerRowIndex }
}

function sheetSummary(name: string, matrix: CellInput[][]): SpreadsheetSheet {
  return {
    name,
    rowCount: matrix.filter((row) => row.some((cell) => cellToText(cell) !== '')).length,
  }
}

/**
 * Read an `.xlsx` file. Picks the requested sheet, else the first sheet that has
 * data. Parser failures surface as {@link SpreadsheetParseError} (never a crash)
 * so the dialog can show a retry state.
 */
export async function parseSpreadsheetFile(file: File, sheetName?: string): Promise<ParsedSpreadsheet> {
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new SpreadsheetParseError('too_large', 'That file is larger than 10 MB. Split the master list into smaller files.')
  }
  const kind = detectSpreadsheetKind(new Uint8Array(await file.slice(0, 4).arrayBuffer()))
  if (kind === 'xls') {
    throw new SpreadsheetParseError(
      'legacy_xls',
      'This is an old .xls file. Open it in Excel and choose Save As → Excel Workbook (.xlsx) or CSV.',
    )
  }
  if (kind !== 'xlsx') {
    throw new SpreadsheetParseError('not_xlsx', 'That file is not a valid Excel (.xlsx) workbook.')
  }

  let sheets: { sheet: string; data: CellInput[][] }[]
  try {
    // Loaded on demand so the reader never weighs down the main bundle.
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    sheets = (await readXlsxFile(file)) as { sheet: string; data: CellInput[][] }[]
  } catch {
    throw new SpreadsheetParseError('unreadable', 'That workbook could not be read. Re-save it from Excel and try again.')
  }

  const summaries = sheets.map((entry) => sheetSummary(entry.sheet, entry.data))
  const chosen =
    (sheetName ? sheets.find((entry) => entry.sheet === sheetName) : undefined) ??
    sheets.find((entry) => entry.data.some((row) => row.some((cell) => cellToText(cell) !== '')))
  if (!chosen) throw new SpreadsheetParseError('empty', 'That workbook has no data.')

  const table = tableFromMatrix(chosen.data)
  if (table.headers.length === 0 || table.rows.length === 0) {
    throw new SpreadsheetParseError('empty', `No rows were found in the sheet "${chosen.sheet}".`)
  }
  const errors: string[] = []
  if (table.rows.length > IMPORT_MAX_ROWS) {
    errors.push(`This sheet has ${table.rows.length} rows; only the first ${IMPORT_MAX_ROWS} can be imported at once.`)
  }
  return {
    sheets: summaries,
    sheetName: chosen.sheet,
    headers: table.headers,
    rows: table.rows,
    headerRowIndex: table.headerRowIndex,
    errors,
  }
}
