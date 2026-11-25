import { describe, expect, it } from 'vitest'
import { tableFromPdfPages, type PdfPage, type PdfTextItem } from './pdf-table'

// Column x positions of a typical master list.
const COL = { no: 40, id: 70, name: 190, program: 380, year: 450, email: 520 }

const text = (str: string, x: number, y: number, width = str.length * 5): PdfTextItem => ({ str, x, y, width })

function header(y: number): PdfTextItem[] {
  return [
    text('No.', COL.no, y),
    text('Student No.', COL.id, y),
    text('Name', COL.name, y),
    text('Program', COL.program, y),
    text('Year Level', COL.year, y),
    text('Email', COL.email, y),
  ]
}

function record(y: number, n: number, id: string, name: string, program = 'BSIT', year = '1', email = ''): PdfTextItem[] {
  return [
    text(String(n), COL.no, y),
    text(id, COL.id, y),
    text(name, COL.name, y),
    text(program, COL.program, y),
    text(year, COL.year, y),
    ...(email ? [text(email, COL.email, y)] : []),
  ]
}

const page = (...groups: PdfTextItem[][]): PdfPage => ({ items: groups.flat() })

describe('tableFromPdfPages', () => {
  it('reads a simple table, using the header x positions as columns', () => {
    const table = tableFromPdfPages([
      page(
        header(700),
        record(684, 1, '2024-00001-MN-0', 'Alpha Student', 'BSIT', '1', 'alpha@example.com'),
        record(668, 2, '2024-00002-MN-0', 'Beta Student'),
      ),
    ])

    expect(table.headerRecognized).toBe(true)
    expect(table.headers).toEqual(['No.', 'Student No.', 'Name', 'Program', 'Year Level', 'Email'])
    expect(table.rows).toEqual([
      ['1', '2024-00001-MN-0', 'Alpha Student', 'BSIT', '1', 'alpha@example.com'],
      ['2', '2024-00002-MN-0', 'Beta Student', 'BSIT', '1', ''],
    ])
    expect(table.warnings).toEqual([])
  })

  it('ignores title lines above the header and signature blocks below the last record', () => {
    const table = tableFromPdfPages([
      page(
        [text('Republic of the Philippines', 200, 780)],
        [text('POLYTECHNIC UNIVERSITY OF THE PHILIPPINES - SANTA MARIA', 120, 765)],
        [text('MASTER LIST - BSIT 1-1', 220, 745)],
        header(700),
        record(684, 1, '2024-00001-MN-0', 'Alpha Student'),
        record(668, 2, '2024-00002-MN-0', 'Beta Student'),
        [text('Prepared by:', COL.id, 640), text('Checked by:', COL.program, 640)],
        [text('Registrar', COL.id, 628)],
      ),
    ])

    expect(table.rows).toHaveLength(2)
    expect(table.rows[1][2]).toBe('Beta Student')
    expect(JSON.stringify(table.rows)).not.toContain('Prepared')
    expect(JSON.stringify(table.rows)).not.toContain('Registrar')
  })

  it('merges a wrapped name into the record directly above it', () => {
    const table = tableFromPdfPages([
      page(
        header(700),
        record(684, 1, '2024-00001-MN-0', 'Maria Elena Concepcion de la'),
        [text('Santa Cruz y Reyes', COL.name, 670)],
        record(654, 2, '2024-00002-MN-0', 'Beta Student'),
      ),
    ])

    expect(table.rows).toHaveLength(2)
    expect(table.rows[0][2]).toBe('Maria Elena Concepcion de la Santa Cruz y Reyes')
    expect(table.rows[1][2]).toBe('Beta Student')
  })

  it('does not glue a distant stray line onto the last record', () => {
    const table = tableFromPdfPages([
      page(
        header(700),
        record(684, 1, '2024-00001-MN-0', 'Alpha Student'),
        record(668, 2, '2024-00002-MN-0', 'Beta Student'),
        [text('Some unrelated note far below the table', COL.name, 400)],
      ),
    ])
    expect(table.rows[1][2]).toBe('Beta Student')
  })

  it('handles several pages: repeated headers and page footers are dropped, records continue', () => {
    const table = tableFromPdfPages([
      page(
        header(700),
        record(684, 1, '2024-00001-MN-0', 'Alpha Student'),
        record(668, 2, '2024-00002-MN-0', 'Beta Student'),
        [text('Page 1 of 2', 280, 30)],
      ),
      page(
        header(700),
        record(684, 3, '2024-00003-MN-0', 'Gamma Student'),
        record(668, 4, '2024-00004-MN-0', 'Delta Student'),
        [text('Page 2 of 2', 280, 30)],
      ),
    ])

    expect(table.rows.map((row) => row[1])).toEqual([
      '2024-00001-MN-0',
      '2024-00002-MN-0',
      '2024-00003-MN-0',
      '2024-00004-MN-0',
    ])
    expect(JSON.stringify(table.rows)).not.toMatch(/Page \d/)
  })

  it('does not merge across a page break', () => {
    const table = tableFromPdfPages([
      page(header(700), record(684, 1, '2024-00001-MN-0', 'Alpha Student')),
      page([text('stray top-of-page line', COL.name, 760)], record(740, 2, '2024-00002-MN-0', 'Beta Student')),
    ])
    expect(table.rows[0][2]).toBe('Alpha Student')
    expect(table.rows[1][2]).toBe('Beta Student')
  })

  it('joins text items that belong to one cell but keeps separate cells apart', () => {
    const table = tableFromPdfPages([
      page(
        header(700),
        [
          text('1', COL.no, 684),
          text('2024-00001-MN-0', COL.id, 684),
          // One cell delivered as several tight text runs.
          text('Maria', COL.name, 684, 25),
          text('Elena', COL.name + 26, 684, 25),
          text('BSIT', COL.program, 684),
        ],
      ),
    ])
    expect(table.rows[0][2]).toBe('Maria Elena')
    expect(table.rows[0][3]).toBe('BSIT')
  })

  it('tolerates slightly misaligned baselines within one line', () => {
    const table = tableFromPdfPages([
      page(header(700), [
        text('1', COL.no, 684),
        text('2024-00001-MN-0', COL.id, 682.5),
        text('Alpha Student', COL.name, 685),
        text('BSIT', COL.program, 684.4),
      ]),
    ])
    expect(table.rows).toEqual([['1', '2024-00001-MN-0', 'Alpha Student', 'BSIT', '', '']])
  })

  it('falls back to unnamed columns, with a warning, when no header can be recognised', () => {
    const table = tableFromPdfPages([
      page(
        [text('Some list', 100, 740)],
        [text('2024-00001-MN-0', 60, 700), text('Alpha Student', 200, 700), text('BSIT', 400, 700)],
        [text('2024-00002-MN-0', 60, 684), text('Beta Student', 200, 684), text('BSIT', 400, 684)],
      ),
    ])

    expect(table.headerRecognized).toBe(false)
    expect(table.headers).toEqual(['Column 1', 'Column 2', 'Column 3'])
    expect(table.rows).toEqual([
      ['2024-00001-MN-0', 'Alpha Student', 'BSIT'],
      ['2024-00002-MN-0', 'Beta Student', 'BSIT'],
    ])
    expect(table.warnings[0]).toMatch(/No header row/)
  })

  it('returns an empty table when there are no student numbers at all', () => {
    expect(tableFromPdfPages([page([text('Just a letter', 100, 700)])])).toEqual({
      headers: [],
      rows: [],
      headerRecognized: false,
      warnings: [],
    })
    expect(tableFromPdfPages([])).toMatchObject({ headers: [], rows: [] })
  })

  it('never invents rows from header-only or blank-text input', () => {
    expect(tableFromPdfPages([page(header(700))]).rows).toEqual([])
    expect(tableFromPdfPages([page([text('   ', 10, 10)])]).rows).toEqual([])
  })
})
