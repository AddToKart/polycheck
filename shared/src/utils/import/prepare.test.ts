import { describe, expect, it } from 'vitest'
import { suggestColumnMapping } from './map'
import { prepareImportTable } from './prepare'
import { buildEnrollRows, buildStudentRows } from './rows'

// Made-up people in the two layouts a registrar actually sends.
const SPLIT_NAMES = {
  headers: ['"Student Number"', 'Last Name', 'First Name', 'Middle Name', 'Subject Code', 'Section Code', 'Email'],
  rows: [
    ['2023-00101-SM-0', 'DELA PEÑA', 'JUAN CARLO', 'REYES', 'INTE 401', 'BSIT-SM 4-1', 'juan@example.com'],
    ['2023-00102-SM-0', 'SANTOS', 'MARIA', '', 'INTE 401', 'BSIT-SM 4-1', 'maria@example.com'],
  ],
}
const COMBINED = {
  headers: ['Name', 'Email Address', 'Mobile', 'Delivery'],
  rows: [
    ['2023-00101-SM-0 Dela Peña, Juan Carlo Reyes', 'juan99 @example.com', '09170000001', 'Online'],
    ['2023-00102-SM-0Santos, Maria', 'maria@exam ple.com', '09170000002', 'Online'],
  ],
}

describe('prepareImportTable', () => {
  it('joins separate name columns and reads program and year from the section code', () => {
    const table = prepareImportTable(SPLIT_NAMES.headers, SPLIT_NAMES.rows)
    const mapping = suggestColumnMapping(table.headers, table.rows)

    expect(buildStudentRows(table.rows, mapping).rows[0]).toEqual({
      rowNumber: 2,
      studentId: '2023-00101-SM-0',
      fullName: 'DELA PEÑA, JUAN CARLO REYES',
      email: 'juan@example.com',
      program: 'BSIT',
      yearLevel: 4,
    })
    expect(buildStudentRows(table.rows, mapping).rows[1].fullName).toBe('SANTOS, MARIA')
    expect(buildEnrollRows(table.rows, mapping).rows[0]).toEqual(
      expect.objectContaining({ studentId: '2023-00101-SM-0', studentName: 'DELA PEÑA, JUAN CARLO REYES' }),
    )
    expect(table.headers[0]).toBe('Student Number')
    expect(table.notes).toHaveLength(2)
  })

  it('separates a student number that shares a cell with the name, and cleans spaced emails', () => {
    const table = prepareImportTable(COMBINED.headers, COMBINED.rows)
    const built = buildStudentRows(table.rows, suggestColumnMapping(table.headers, table.rows))

    expect(built.issues).toEqual([])
    expect(built.rows.map((row) => [row.studentId, row.fullName, row.email])).toEqual([
      ['2023-00101-SM-0', 'Dela Peña, Juan Carlo Reyes', 'juan99@example.com'],
      ['2023-00102-SM-0', 'Santos, Maria', 'maria@example.com'],
    ])
    // Nothing names the program here, so it is left for the person to choose.
    expect(built.rows[0].program).toBeUndefined()
    expect(built.rows[0].yearLevel).toBeUndefined()
  })

  it('drops only the bad address or the second use of a shared one', () => {
    const rows = [
      ['2023-00101-SM-0', 'One', 'shared@example.com'],
      ['2023-00102-SM-0', 'Two', 'shared@example.com'],
      ['2023-00103-SM-0', 'Three', 'someone..else@example.com'],
    ]
    const built = buildStudentRows(rows, { studentId: 0, fullName: 1, email: 2 })

    expect(built.rows.map((row) => [row.rowNumber, row.email])).toEqual([
      [2, 'shared@example.com'],
      [4, undefined],
    ])
    expect(built.issues.map((issue) => [issue.rowNumber, issue.code])).toEqual([
      [3, 'DUPLICATE_IN_FILE'],
      [4, 'INVALID_EMAIL'],
    ])
  })

  it('leaves an already well-formed list alone', () => {
    const headers = ['Student No.', 'Name', 'Program', 'Year Level', 'Section']
    const rows = [['2023-00101-SM-0', 'Santos, Maria', 'BSHM', '2', 'BSIT 4-1']]

    expect(prepareImportTable(headers, rows)).toEqual({ headers, rows, notes: [] })
  })

  it('does not read a room or subject code as a section code', () => {
    const table = prepareImportTable(['Student No.', 'Name', 'Subject Code'], [['2023-00101-SM-0', 'A Person', 'INTE 401']])
    expect(table.headers).toHaveLength(3)
  })
})
