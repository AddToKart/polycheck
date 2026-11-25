import { describe, expect, it } from 'vitest'
import { buildStudentRows, suggestColumnMapping } from '@polycheck/shared'
import {
  cellToText,
  detectSpreadsheetKind,
  MAX_SPREADSHEET_BYTES,
  parseSpreadsheetFile,
  SpreadsheetParseError,
  tableFromMatrix,
} from './spreadsheet-parser'
import { buildXlsx, xlsxFile } from './xlsx-fixture'

const HEADER = ['Student No.', 'Name', 'Program', 'Year Level', 'Email']
const DATA = [
  ['2024-00001-MN-0', 'Alpha Student', 'BSIT', 1, 'alpha@example.com'],
  ['2024-00002-MN-0', 'Beta Student', 'BSIT', 1, null],
]

describe('detectSpreadsheetKind', () => {
  it('trusts content, not the extension', () => {
    expect(detectSpreadsheetKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))).toBe('xlsx')
    expect(detectSpreadsheetKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toBe('xls')
    expect(detectSpreadsheetKind(new TextEncoder().encode('a,b,c'))).toBe('unknown')
    expect(detectSpreadsheetKind(new Uint8Array([0x50, 0x4b]))).toBe('unknown')
  })
})

describe('cellToText', () => {
  it('turns every cell kind into the text the importer expects', () => {
    expect(cellToText(null)).toBe('')
    expect(cellToText(undefined)).toBe('')
    expect(cellToText('  Maria   Elena ')).toBe('Maria Elena')
    expect(cellToText(3)).toBe('3')
    expect(cellToText(2.5)).toBe('2.5')
    expect(cellToText(Number.NaN)).toBe('')
    expect(cellToText(true)).toBe('true')
    expect(cellToText(new Date('2026-11-25T00:00:00.000Z'))).toBe('2026-11-25')
    expect(cellToText(new Date('nope'))).toBe('')
  })
})

describe('tableFromMatrix', () => {
  it('skips title lines above the table and finds the real header', () => {
    const table = tableFromMatrix([
      ['Republic of the Philippines'],
      ['POLYTECHNIC UNIVERSITY OF THE PHILIPPINES — SANTA MARIA'],
      [],
      ['Master list — BSIT 1-1'],
      HEADER,
      ...DATA,
    ])
    expect(table.headerRowIndex).toBe(4)
    expect(table.headers).toEqual(HEADER)
    expect(table.rows).toEqual([
      ['2024-00001-MN-0', 'Alpha Student', 'BSIT', '1', 'alpha@example.com'],
      ['2024-00002-MN-0', 'Beta Student', 'BSIT', '1', ''],
    ])
  })

  it('drops blank rows, pads short rows and trims trailing blank header columns', () => {
    const table = tableFromMatrix([
      ['Student No.', 'Name', '', ''],
      ['2024-00001-MN-0', 'Alpha'],
      [null, null, null],
      ['2024-00002-MN-0', 'Beta', 'extra', 'ignored'],
    ])
    expect(table.headers).toEqual(['Student No.', 'Name'])
    expect(table.rows).toEqual([
      ['2024-00001-MN-0', 'Alpha'],
      ['2024-00002-MN-0', 'Beta'],
    ])
  })

  it('falls back to the first multi-cell row when no header is recognizable', () => {
    const table = tableFromMatrix([['Class list'], ['Col A', 'Col B'], ['x', 'y']])
    expect(table.headers).toEqual(['Col A', 'Col B'])
    expect(table.rows).toEqual([['x', 'y']])
  })

  it('returns an empty table for an empty sheet', () => {
    expect(tableFromMatrix([[], [null]])).toEqual({ headers: [], rows: [], headerRowIndex: -1 })
  })
})

describe('parseSpreadsheetFile', () => {
  it('reads a real .xlsx workbook into the same shape as the CSV parser', async () => {
    const file = xlsxFile(buildXlsx([{ name: 'BSIT 1-1', rows: [HEADER, ...DATA] }]))
    const parsed = await parseSpreadsheetFile(file)

    expect(parsed.sheetName).toBe('BSIT 1-1')
    expect(parsed.headers).toEqual(HEADER)
    expect(parsed.rows).toEqual([
      ['2024-00001-MN-0', 'Alpha Student', 'BSIT', '1', 'alpha@example.com'],
      ['2024-00002-MN-0', 'Beta Student', 'BSIT', '1', ''],
    ])
    expect(parsed.sheets).toEqual([{ name: 'BSIT 1-1', rowCount: 3 }])

    // It feeds the existing mapper/normalizer unchanged.
    const built = buildStudentRows(parsed.rows, suggestColumnMapping(parsed.headers))
    expect(built.rows.map((row) => row.studentId)).toEqual(['2024-00001-MN-0', '2024-00002-MN-0'])
    expect(built.rows[0]).toMatchObject({ fullName: 'Alpha Student', program: 'BSIT', yearLevel: 1 })
  })

  it('handles a title block above the table', async () => {
    const file = xlsxFile(
      buildXlsx([{ name: 'Sheet1', rows: [['PUP Santa Maria'], ['Master List'], [], HEADER, ...DATA] }]),
    )
    const parsed = await parseSpreadsheetFile(file)
    expect(parsed.headerRowIndex).toBe(3)
    expect(parsed.rows).toHaveLength(2)
  })

  it('lists every sheet, defaults to the first one with data, and honors an explicit choice', async () => {
    const bytes = buildXlsx([
      { name: 'Cover', rows: [] },
      { name: 'BSIT 1-1', rows: [HEADER, ...DATA] },
      { name: 'BSHM 1-1', rows: [HEADER, ['2024-00009-MN-0', 'Gamma Student', 'BSHM', 2, 'g@example.com']] },
    ])

    const first = await parseSpreadsheetFile(xlsxFile(bytes))
    expect(first.sheets.map((sheet) => sheet.name)).toEqual(['Cover', 'BSIT 1-1', 'BSHM 1-1'])
    expect(first.sheetName).toBe('BSIT 1-1')

    const chosen = await parseSpreadsheetFile(xlsxFile(bytes), 'BSHM 1-1')
    expect(chosen.sheetName).toBe('BSHM 1-1')
    expect(chosen.rows).toEqual([['2024-00009-MN-0', 'Gamma Student', 'BSHM', '2', 'g@example.com']])
  })

  it('keeps text student numbers intact (dashes stay, nothing becomes a date or number)', async () => {
    const parsed = await parseSpreadsheetFile(xlsxFile(buildXlsx([{ name: 'S', rows: [HEADER, ...DATA] }])))
    expect(parsed.rows.every((row) => /^\d{4}-\d{5}-[A-Z]{2}-\d$/.test(row[0]))).toBe(true)
  })

  it('rejects oversized, legacy .xls, non-Excel and corrupt files with a clear code', async () => {
    const big = new File([new Uint8Array(MAX_SPREADSHEET_BYTES + 1)], 'big.xlsx')
    await expect(parseSpreadsheetFile(big)).rejects.toMatchObject({ code: 'too_large' })

    const legacy = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])], 'old.xls')
    await expect(parseSpreadsheetFile(legacy)).rejects.toMatchObject({ code: 'legacy_xls' })

    const renamedCsv = new File(['Student No.,Name\n2024-00001-MN-0,Alpha'], 'list.xlsx')
    await expect(parseSpreadsheetFile(renamedCsv)).rejects.toMatchObject({ code: 'not_xlsx' })

    const corrupt = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4])], 'broken.xlsx')
    await expect(parseSpreadsheetFile(corrupt)).rejects.toMatchObject({ code: 'unreadable' })
    await expect(parseSpreadsheetFile(corrupt)).rejects.toBeInstanceOf(SpreadsheetParseError)
  })

  it('reports an empty workbook and an empty sheet distinctly from a read failure', async () => {
    await expect(parseSpreadsheetFile(xlsxFile(buildXlsx([{ name: 'Empty', rows: [] }])))).rejects.toMatchObject({
      code: 'empty',
    })
    await expect(
      parseSpreadsheetFile(xlsxFile(buildXlsx([{ name: 'HeaderOnly', rows: [HEADER] }]))),
    ).rejects.toMatchObject({ code: 'empty' })
  })
})
