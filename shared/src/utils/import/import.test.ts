import { describe, expect, it } from 'vitest'
import { computeRowChecksum } from './checksum'
import { suggestColumnMapping } from './map'
import { parseCsv } from './parse'
import { buildEnrollRows, buildStudentRows } from './rows'

const PUP_CSV = [
  '\uFEFF"Student No.","Name","Program","Year Level","College/Department","Email Address"',
  '"2024-00001-MN-0","Dela Cruz, Juan M.","BSIT","1st Year","CCIS","JUAN@PUP.EDU.PH"',
  '"2024-00002-MN-0","Santos, Maria L.","BSIT","2nd Year","CCIS","maria@pup.edu.ph"',
].join('\r\n')

describe('PUP master-list parsing', () => {
  it('parses BOM/CRLF exports and auto-maps PUP SIS headers', () => {
    const parsed = parseCsv(PUP_CSV)
    expect(parsed.errors).toEqual([])
    expect(parsed.headers).toEqual([
      'Student No.',
      'Name',
      'Program',
      'Year Level',
      'College/Department',
      'Email Address',
    ])
    expect(parsed.rows).toHaveLength(2)

    const mapping = suggestColumnMapping(parsed.headers)
    expect(mapping).toEqual({
      studentId: 0,
      fullName: 1,
      program: 2,
      yearLevel: 3,
      department: 4,
      email: 5,
    })

    const built = buildStudentRows(parsed.rows, mapping)
    expect(built.issues).toEqual([])
    expect(built.rows).toEqual([
      {
        rowNumber: 2,
        studentId: '2024-00001-MN-0',
        fullName: 'Dela Cruz, Juan M.',
        email: 'juan@pup.edu.ph',
        program: 'BSIT',
        yearLevel: 1,
        department: 'CCIS',
      },
      {
        rowNumber: 3,
        studentId: '2024-00002-MN-0',
        fullName: 'Santos, Maria L.',
        email: 'maria@pup.edu.ph',
        program: 'BSIT',
        yearLevel: 2,
        department: 'CCIS',
      },
    ])
  })

  it('flags Excel-mangled student numbers with remediation copy', () => {
    const csv = ['Student No.,Name', '202400001,Juan Dela Cruz', '2024-01-01,Maria Santos'].join('\n')
    const parsed = parseCsv(csv)
    const built = buildStudentRows(parsed.rows, suggestColumnMapping(parsed.headers))

    expect(built.rows).toHaveLength(0)
    expect(built.issues.map((issue) => issue.code)).toEqual([
      'EXCEL_MANGLED_STUDENT_NUMBER',
      'EXCEL_MANGLED_STUDENT_NUMBER',
    ])
    expect(built.issues[0].message).toContain('formatted as text')
  })

  it('keeps the first occurrence and flags duplicates in the file', () => {
    const csv = [
      'Student No.,Name',
      '2024-00001-MN-0,Juan Dela Cruz',
      '2024-00001-MN-0,Juan Dela Cruz',
    ].join('\n')
    const parsed = parseCsv(csv)
    const built = buildStudentRows(parsed.rows, suggestColumnMapping(parsed.headers))

    expect(built.rows).toHaveLength(1)
    expect(built.issues).toEqual([
      {
        rowNumber: 3,
        column: 'studentId',
        code: 'DUPLICATE_IN_FILE',
        message: 'Duplicate of row 2.',
      },
    ])
  })

  it('handles quoted multiline names and ignores unmapped optional columns', () => {
    const csv = ['Student No.,Name,Sex', '"2024-00003-MN-0","Reyes, Ana\nMarie",F'].join('\n')
    const parsed = parseCsv(csv)
    const built = buildStudentRows(parsed.rows, suggestColumnMapping(parsed.headers))

    expect(built.rows[0].fullName).toBe('Reyes, Ana Marie')
    expect(built.rows[0]).not.toHaveProperty('department')
  })

  it('flags invalid optional fields but keeps the row importable', () => {
    const csv = ['Student No.,Name,Email,Year Level', '2024-00004-MN-0,Juan Dela Cruz,not-an-email,12th Year'].join('\n')
    const parsed = parseCsv(csv)
    const built = buildStudentRows(parsed.rows, suggestColumnMapping(parsed.headers))

    expect(built.rows).toHaveLength(1)
    expect(built.rows[0].email).toBeUndefined()
    expect(built.rows[0].yearLevel).toBeUndefined()
    expect(built.issues.map((issue) => issue.code).sort()).toEqual(['INVALID_EMAIL', 'YEAR_LEVEL_OUT_OF_RANGE'])
  })

  it('builds enrollment rows with verification-only fields', () => {
    const parsed = parseCsv(PUP_CSV)
    const built = buildEnrollRows(parsed.rows, suggestColumnMapping(parsed.headers))
    expect(built.issues).toEqual([])
    expect(built.rows[0]).toMatchObject({
      rowNumber: 2,
      studentId: '2024-00001-MN-0',
      studentName: 'Dela Cruz, Juan M.',
      expectedProgram: 'BSIT',
      expectedYearLevel: 1,
    })
  })

  it('parses a 5,000-row master list', () => {
    const lines = ['Student No.,Name']
    for (let index = 1; index <= 5000; index += 1) {
      lines.push(`2024-${String(index).padStart(5, '0')}-MN-0,Student ${index}`)
    }
    const parsed = parseCsv(lines.join('\n'))
    expect(parsed.rows).toHaveLength(5000)
    const built = buildStudentRows(parsed.rows, suggestColumnMapping(parsed.headers))
    expect(built.rows).toHaveLength(5000)
    expect(built.issues).toHaveLength(0)
  })
})

describe('row checksum', () => {
  it('is order-independent and changes when a row changes', () => {
    const first = [
      { studentId: '2024-00001-MN-0', fullName: 'A' },
      { studentId: '2024-00002-MN-0', fullName: 'B' },
    ]
    expect(computeRowChecksum(first)).toBe(computeRowChecksum([...first].reverse()))
    expect(computeRowChecksum(first)).not.toBe(
      computeRowChecksum([{ ...first[0], fullName: 'C' }, first[1]]),
    )
    expect(computeRowChecksum(first)).toMatch(/^[a-f0-9]{16}$/)
  })
})
